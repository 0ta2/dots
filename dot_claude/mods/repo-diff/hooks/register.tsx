import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { FileChange, RepoSnapshot } from '../types'
import { dirsInCommand, fitHunks, snapshot, type Git } from './git.ts'

const PANE = 'repo-diff'
const CODE_LIMIT = 10000
const UNTRACKED_LIMIT = 1_000_000
const GIT_ARGS = ['--no-optional-locks', '-c', 'core.quotePath=false', '-c', 'diff.relative=false']
const repos = atom({ plugin: 'repo-diff', key: 'repos' } as const, [])
const snapshots = atom({ plugin: 'repo-diff', key: 'snapshots' } as const, [])
const selected = atom({ plugin: 'repo-diff', key: 'selected' } as const, null)
const isOpen = atom({ plugin: 'repo-diff', key: 'isOpen' } as const, false)

const gitOf = ($: EngineInterface): Git => async (dir, args) => {
  const r = await $.process.run(['git', '-C', dir, ...GIT_ARGS, ...args]).catch(() => undefined)
  return r?.exitCode === 0 && !r.isStdoutTruncated ? r.stdout : undefined
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
    const path = `${snap.root}/${file.path}`
    const stat = await $.fs.stat(path).catch(() => undefined)
    if (!stat || stat.size > UNTRACKED_LIMIT) return ''
    const text = await $.fs.read(path).catch(() => '')
    const lines = text.replace(/\n$/, '').split('\n')
    return `@@ -0,0 +1,${lines.length} @@\n${lines.map(l => `+${l}`).join('\n')}`
  }
  return (await gitOf($)(snap.root, ['diff', '--no-renames', snap.mergeBase, '--', file.path])) ?? ''
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

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const snaps = (await read($, snapshots)) ?? []
    const sel = await read($, selected)
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
            <Text bold>
              {basename(sel.root)}/{sel.path}
            </Text>
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
