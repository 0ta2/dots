import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Asked, FileChange, RepoSnapshot } from '../types'
import { dirsInCommand, fitHunks, snapshot, type Git } from './git.ts'

const PANE = 'repo-diff'
const CODE_LIMIT = 10000
const UNTRACKED_LIMIT = 1_000_000
const CONTEXT_LIMIT = 32_000
const GIT_ARGS = ['--no-optional-locks', '-c', 'core.quotePath=false', '-c', 'diff.relative=false']
const repos = atom({ plugin: 'repo-diff', key: 'repos' } as const, [])
const snapshots = atom({ plugin: 'repo-diff', key: 'snapshots' } as const, [])
const selected = atom({ plugin: 'repo-diff', key: 'selected' } as const, null)
const isOpen = atom({ plugin: 'repo-diff', key: 'isOpen' } as const, false)
const asked = atom({ plugin: 'repo-diff', key: 'asked' } as const, null)

const gitOf = ($: EngineInterface, okCodes = [0]): Git => async (dir, args) => {
  const r = await $.process.run(['git', '-C', dir, ...GIT_ARGS, ...args]).catch(() => undefined)
  return r && okCodes.includes(r.exitCode ?? -1) && !r.isStdoutTruncated ? r.stdout : undefined
}

async function track($: EngineInterface, dirs: string[]) {
  const git = gitOf($)
  const roots = (await Promise.all(dirs.map(async d => (await git(d, ['rev-parse', '--show-toplevel']))?.trim()))).filter(
    (r): r is string => !!r,
  )
  if (roots.length) await update($, repos, list => [...new Set([...(list ?? []), ...roots])])
}

async function diffOf($: EngineInterface, snap: RepoSnapshot, file: FileChange): Promise<string> {
  if (file.isUntracked) {
    const stat = await $.fs.stat(`${snap.root}/${file.path}`).catch(() => undefined)
    if (!stat || (!stat.isLink && stat.size > UNTRACKED_LIMIT)) return ''
    return (await gitOf($, [0, 1])(snap.root, ['diff', '--no-index', '--no-textconv', '--no-ext-diff', '--', '/dev/null', file.path])) ?? ''
  }
  return (await gitOf($)(snap.root, ['diff', '--no-renames', '--no-textconv', '--no-ext-diff', snap.mergeBase, '--', file.path])) ?? ''
}

let selection = 0

async function select($: EngineInterface, snap: RepoSnapshot, file: FileChange) {
  const mine = ++selection
  const at = { root: snap.root, path: file.path, isUntracked: file.isUntracked }
  await update($, selected, () => ({ ...at, diff: null }))
  const diff = await diffOf($, snap, file)
  if (mine === selection) await update($, selected, () => ({ ...at, diff }))
}

async function unselect($: EngineInterface) {
  selection++
  await update($, selected, () => null)
}

async function refresh($: EngineInterface) {
  const git = gitOf($)
  const list = (await read($, repos)) ?? []
  const snaps = (await Promise.all(list.map(root => snapshot(git, root)))).filter(
    (s): s is RepoSnapshot => !!s,
  )
  await update($, snapshots, () => snaps)
  const sel = await read($, selected)
  if (!sel) return
  const snap = snaps.find(s => s.root === sel.root)
  const file = snap?.files.find(f => f.path === sel.path && f.isUntracked === sel.isUntracked)
  if (snap && file) await select($, snap, file)
  else await unselect($)
}

const POLL_MS = 5000
let poll: { cancel: () => void } | undefined

function startPolling($: EngineInterface) {
  poll?.cancel()
  let isBusy = false
  poll = $.clock.every(POLL_MS, () => {
    if (isBusy) return
    isBusy = true
    void refresh($).finally(() => {
      isBusy = false
    })
  })
}

const CUT_NOTE = '\n(The rest of this diff was cut: it did not fit in the prompt.)'
let carrying = false
const isSame = (a: Asked | null, b: Asked | null) => !!a && !!b && a.root === b.root && a.path === b.path

async function askText($: EngineInterface, at: Asked, room: number): Promise<{ name: string; text?: string }> {
  const name = `${basename(at.root)}/${at.path}`
  const snap = await snapshot(gitOf($), at.root)
  const file = snap?.files.findLast(f => f.path === at.path)
  if (!snap || !file) return { name }
  const head = `The user attached the diff of ${at.path} in ${at.root} (since its merge base with ${snap.base}) from the repo-diff pane to this prompt:\n`
  const diff = await diffOf($, snap, file)
  const whole = fitHunks(diff, room - head.length)
  const fit = whole?.isCut ? fitHunks(diff, room - head.length - CUT_NOTE.length) : whole
  return { name, text: fit?.source ? head + fit.source + (fit.isCut ? CUT_NOTE : '') : undefined }
}

const dirname = (p: string) => p.slice(0, p.lastIndexOf('/')) || '/'
const basename = (p: string) => p.slice(p.lastIndexOf('/') + 1)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'repo-diff', description: 'このセッションで触ったリポジトリのマージ前の差分を表示する' })
    await track($, [await $.session.cwd()])
    if (await read($, isOpen)) startPolling($)
    return next(e)
  })

  on('command.run', { command: 'repo-diff' }, async $ => {
    await refresh($)
    await update($, isOpen, () => true)
    startPolling($)
    await $.ui.open({ id: PANE, title: 'Repo diff' })
    return { text: 'Repo diff pane opened.' }
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    await update($, isOpen, () => false)
    poll?.cancel()
    poll = undefined
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (e.tool === 'Edit' || e.tool === 'Write' || e.tool === 'NotebookEdit') {
      await track($, [dirname(e.tool === 'NotebookEdit' ? e.notebook_path : e.file_path)])
    } else if (e.tool === 'Bash') {
      await track($, dirsInCommand(e.command, await $.session.cwd(), (await $.env.get('HOME')) ?? ''))
    } else {
      return ran
    }
    if (await read($, isOpen)) await refresh($)
    return ran
  })

  on('prompt.submit', async ($, e, next) => {
    const at = await read($, asked)
    if (!at || carrying || (e.origin.kind !== 'composer' && e.origin.kind !== 'bridge')) return next(e)
    carrying = true
    try {
      const context = e.context ?? []
      const ask = await askText($, at, CONTEXT_LIMIT - context.reduce((n, c) => n + c.length, 0))
      const isSent = ask.text !== undefined
      const result = isSent ? await next({ ...e, context: [...context, ask.text!] }) : undefined
      if (!isSent || result?.drop === undefined) {
        await update($, asked, now => (isSame(now, at) ? null : now))
        await $.ui.status(isSent ? undefined : `${ask.name} の差分を添付できませんでした`)
      }
      return result ?? (await next(e))
    } finally {
      carrying = false
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const snaps = (await read($, snapshots)) ?? []
    const sel = await read($, selected)
    const at = await read($, asked)
    const isAsked = isSame(at, sel)
    const fit = sel?.diff ? fitHunks(sel.diff, CODE_LIMIT) : undefined

    return (
      <Box flexDirection="column">
        {snaps.length === 0 && <Text dimColor>マージ前の変更はありません</Text>}
        {snaps.map(snap => (
          <Box key={`repo:${snap.root}`} flexDirection="column" marginBottom={1}>
            <Text bold>{basename(snap.root)}</Text>
            <Text dimColor>
              {snap.branch} · {snap.ahead} commits ahead of {snap.base}
            </Text>
            {snap.files.map(f => (
              <Button
                key={`file:${snap.root}:${f.isUntracked ? 'untracked' : 'tracked'}:${f.path}`}
                plain
                label={`${f.isUntracked ? 'new' : f.added === null ? 'bin' : `+${f.added} -${f.removed}`}  ${f.path}`}
                onPress={() => select($, snap, f)}
              />
            ))}
          </Box>
        ))}
        {sel && (
          <Box flexDirection="column">
            <Box flexDirection="row" gap={1}>
              <Text bold>
                {basename(sel.root)}/{sel.path}
              </Text>
              <Button
                key="ask"
                label={isAsked ? 'asked ✓' : 'ask'}
                onPress={async () => {
                  const { root, path } = sel
                  await update($, asked, () => (isAsked ? null : { root, path }))
                  await $.ui.status(isAsked ? undefined : `${basename(root)}/${path} の差分を次のプロンプトに添付します`)
                }}
              />
            </Box>
            {sel.diff === null ? (
              <Text dimColor>読み込み中…</Text>
            ) : fit?.source ? (
              <Box flexDirection="column">
                <Code source={fit.source} format="diff" path={sel.path} />
                {fit.isCut && <Text dimColor>(長いので以降のハンクを省略しました)</Text>}
              </Box>
            ) : fit ? (
              <Text dimColor>差分が大きすぎて表示できません</Text>
            ) : (
              <Text dimColor>表示できる差分がありません (バイナリ・大きすぎる差分など)</Text>
            )}
          </Box>
        )}
      </Box>
    )
  })
}
