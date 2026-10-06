import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Asked, FileChange, RepoSnapshot } from '../types'
import { dirsInCommand, fitHunks, pickLines, snapshot, type Git } from './git.ts'

const PANE = 'unmerged'
const CODE_LIMIT = 10000
const UNTRACKED_LIMIT = 1_000_000
const CONTEXT_LIMIT = 32_000
const GIT_ARGS = ['--no-optional-locks', '-c', 'core.quotePath=false', '-c', 'diff.relative=false']
const repos = atom({ plugin: 'unmerged', key: 'repos' } as const, [])
const snapshots = atom({ plugin: 'unmerged', key: 'snapshots' } as const, [])
const selected = atom({ plugin: 'unmerged', key: 'selected' } as const, null)
const isOpen = atom({ plugin: 'unmerged', key: 'isOpen' } as const, false)
const asked = atom({ plugin: 'unmerged', key: 'asked' } as const, null)
const expanded = atom({ plugin: 'unmerged', key: 'expanded' } as const, {})

const gitOf = ($: EngineInterface, okCodes = [0]): Git => async (dir, args) => {
  const r = await $.process.run(['git', '-C', dir, ...GIT_ARGS, ...args]).catch(() => undefined)
  return r && okCodes.includes(r.exitCode ?? -1) && !r.isStdoutTruncated ? r.stdout : undefined
}

async function rootsOf(git: Git, dirs: string[]): Promise<string[]> {
  const roots = await Promise.all(dirs.map(async d => (await git(d, ['rev-parse', '--show-toplevel']))?.trim()))
  return roots.filter((r): r is string => !!r)
}

async function track($: EngineInterface, dirs: string[]) {
  const roots = await rootsOf(gitOf($), dirs)
  if (roots.length) await update($, repos, list => [...new Set([...(list ?? []), ...roots])])
}

export function parseRepos(text: string): { path: string; task?: string }[] {
  try {
    const { repos, task } = JSON.parse(text) as { repos?: unknown; task?: unknown }
    return Array.isArray(repos)
      ? repos.filter((path): path is string => typeof path === 'string').map(path => ({ path, ...(typeof task === 'string' && { task }) }))
      : []
  } catch {
    return []
  }
}

async function delegatedRepos($: EngineInterface): Promise<{ path: string; task?: string }[]> {
  const [home, workspace] = await Promise.all([$.env.get('HOME'), $.env.get('HERDR_WORKSPACE_ID')])
  if (!home || !workspace) return []
  const dir = `${home}/.local/state/herdr-team/${workspace}`
  const entries = await $.fs.list(dir).catch(() => [])
  const lists = await Promise.all(
    entries
      .filter(f => f.kind === 'file' && f.name.endsWith('.json'))
      .map(async f => parseRepos(await $.fs.read(`${dir}/${f.name}`).catch(() => ''))),
  )
  return lists.flat()
}

async function diffOf($: EngineInterface, snap: RepoSnapshot, file: FileChange): Promise<string> {
  const opts = ['--no-textconv', '--no-ext-diff']
  let diff: string | undefined
  if (file.isUntracked) {
    const stat = await $.fs.stat(`${snap.root}/${file.path}`).catch(() => undefined)
    if (!stat || (!stat.isLink && stat.size > UNTRACKED_LIMIT)) return ''
    diff = await gitOf($, [0, 1])(snap.root, ['diff', '--no-index', ...opts, '--', '/dev/null', file.path])
  } else {
    diff = await gitOf($)(snap.root, ['diff', '--no-renames', ...opts, snap.mergeBase, '--', file.path])
  }
  return !diff || diff.includes('\0') ? '' : diff
}

let selection = 0
let delegatedTasks = new Map<string, string | undefined>()

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
  const delegated = await Promise.all(
    (await delegatedRepos($)).map(async ({ path, task }) => {
      const root = (await git(path, ['rev-parse', '--show-toplevel']))?.trim()
      return root ? { root, task } : undefined
    }),
  )
  delegatedTasks = new Map(delegated.filter((repo): repo is { root: string; task?: string } => !!repo).map(({ root, task }) => [root, task]))
  const list = [...new Set([...((await read($, repos)) ?? []), ...delegatedTasks.keys()])]
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
  const what = at.range ? `${at.range.isOld ? 'removed ' : ''}lines ${spanOf(at.range)} of the diff` : 'the diff'
  const head = `The user attached ${what} of ${at.path} in ${at.root} (since its merge base with ${snap.base}) from the unmerged pane to this prompt:\n`
  const diff = at.range?.source ?? (await diffOf($, snap, file))
  const whole = fitHunks(diff, room - head.length)
  const fit = whole?.isCut ? fitHunks(diff, room - head.length - CUT_NOTE.length) : whole
  return { name, text: fit?.source ? head + fit.source + (fit.isCut ? CUT_NOTE : '') : undefined }
}

const askedName = (at: Asked) =>
  `${basename(at.root)}/${at.path}${at.range ? `（${at.range.isOld ? '削除した ' : ''}${spanOf(at.range)} 行）` : ''}`
const spanOf = (r: { from: number; to: number }) => (r.from === r.to ? `${r.from}` : `${r.from}–${r.to}`)
const STATUS_COLORS: Record<string, string> = { A: 'success', M: 'warning', T: 'warning', D: 'error', U: 'error' }
type Count = { text: string; color?: string }
const counts = (f: FileChange): Count[] =>
  f.isUntracked
    ? []
    : f.added === null
      ? [{ text: 'bin' }]
      : [
          ...(f.added ? [{ text: `+${f.added}`, color: 'success' }] : []),
          ...(f.removed ? [{ text: `-${f.removed}`, color: 'error' }] : []),
        ]
const countsWidth = (c: Count[]) => c.reduce((w, { text }) => w + text.length, Math.max(c.length - 1, 0))

const dirname = (p: string) => p.slice(0, p.lastIndexOf('/')) || '/'
const basename = (p: string) => p.slice(p.lastIndexOf('/') + 1)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'unmerged', description: 'このセッションで触ったリポジトリのマージ前の差分を表示する' })
    await track($, [await $.session.cwd()])
    if (await read($, isOpen)) startPolling($)
    return next(e)
  })

  on('command.run', { command: 'unmerged' }, async $ => {
    await refresh($)
    await update($, isOpen, () => true)
    startPolling($)
    await $.ui.open({ id: PANE, title: 'Unmerged' })
    return { text: 'Unmerged pane opened.' }
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

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const at = await read($, asked)
    if (!at || e.props.hasSurvey) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={1}>
        <Text>{`📎 ${askedName(at)}${at.range ? '' : ' '}を次の送信に添付`}</Text>
        <Button key="unask" label="外す" onPress={() => update($, asked, () => null)} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Code } = $.ui.resolve(e)
    const snaps = (await read($, snapshots)) ?? []
    const sel = await read($, selected)
    const at = await read($, asked)
    const opened = (await read($, expanded)) ?? {}
    const isAsked = isSame(at, sel)
    const fit = sel?.diff ? fitHunks(sel.diff, CODE_LIMIT) : undefined
    const isExpanded = (root: string) => opened[root] ?? (snaps.length < 2 || sel?.root === root)
    const selectedDiff = sel && (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Button
            key="ask"
            label={isAsked ? '添付を外す' : '添付'}
            onPress={async () => {
              await $.ui.status(undefined)
              if (isAsked) return update($, asked, () => null)
              const picked = await $.ui.selection()
              const range = sel.diff && picked && !picked.requestId ? pickLines(sel.diff, picked.text) : undefined
              await update($, asked, () => ({ root: sel.root, path: sel.path, ...(range && { range }) }))
            }}
          />
          <Text bold>
            {basename(sel.root)}/{sel.path}
          </Text>
        </Box>
        {sel.diff === null ? (
          <Text dimColor>読み込み中…</Text>
        ) : fit?.source ? (
          <Box flexDirection="column">
            {fit.source.split(/(?=^@@ )/m).map((hunk, index) => {
              const range = pickLines(sel.diff, hunk)
              const isAskedHunk = !!range && isSame(at, sel) && at?.range?.source === range.source
              return (
                <Box key={`hunk-box:${index}`} flexDirection="column">
                  <Button
                    key={`hunk:${index}`}
                    label={isAskedHunk ? '添付を外す' : '添付'}
                    onPress={async () => {
                      await $.ui.status(undefined)
                      if (!range) return
                      await update($, asked, now =>
                        isSame(now, sel) && now?.range?.source === range.source
                          ? null
                          : { root: sel.root, path: sel.path, range },
                      )
                    }}
                  />
                  <Code source={hunk} format="diff" path={sel.path} />
                </Box>
              )
            })}
            {fit.isCut && <Text dimColor>(長いので以降のハンクを省略しました)</Text>}
          </Box>
        ) : fit ? (
          <Text dimColor>差分が大きすぎて表示できません</Text>
        ) : (
          <Text dimColor>表示できる差分がありません (バイナリ・大きすぎる差分など)</Text>
        )}
      </Box>
    )

    return (
      <Box flexDirection="column">
        {snaps.length === 0 && <Text dimColor>マージ前の変更はありません</Text>}
        {snaps.map(snap => {
          const isOpenRepo = isExpanded(snap.root)
          const width = Math.max(...snap.files.map(f => countsWidth(counts(f))))
          const marks = isOpenRepo ? '' : `${at?.root === snap.root ? ' 📎' : ''}${sel?.root === snap.root ? ' (表示中)' : ''}`
          const task = delegatedTasks.get(snap.root)
          const delegatedMark = delegatedTasks.has(snap.root) ? ` · 委譲${task ? `: ${task}` : ''}` : ''
          return (
            <Box key={`group:${snap.root}`} flexDirection="column" marginBottom={isOpenRepo ? 1 : 0}>
              <Button
                key={`repo:${snap.root}`}
                plain
                label={`${isOpenRepo ? '▾' : '▸'} ${basename(snap.root)} (${snap.files.length})${marks}${delegatedMark}`}
                onPress={() => update($, expanded, now => ({ ...now, [snap.root]: !isOpenRepo }))}
              />
              {isOpenRepo && (
                <Text dimColor>
                  {snap.branch} · {snap.ahead} commits ahead of {snap.base}
                </Text>
              )}
              {isOpenRepo &&
                snap.files.map(f => {
                  const id = `${snap.root}:${f.isUntracked ? 'untracked' : 'tracked'}:${f.path}`
                  return (
                    <Box key={`row:${id}`} flexDirection="column">
                      <Box flexDirection="row" gap={1}>
                        <Text color={STATUS_COLORS[f.status]} dimColor={f.isUntracked}>
                          {f.status}
                        </Text>
                        {width > 0 && (
                          <Box width={width} flexShrink={0} flexDirection="row" gap={1}>
                            {counts(f).map(c => (
                              <Text key={c.text} color={c.color} dimColor={!c.color}>
                                {c.text}
                              </Text>
                            ))}
                          </Box>
                        )}
                        <Button
                          key={`file:${id}`}
                          plain
                          label={`${at?.root === snap.root && at.path === f.path ? '📎 ' : ''}${f.path}`}
                          onPress={() =>
                            sel?.root === snap.root && sel.path === f.path && sel.isUntracked === f.isUntracked
                              ? unselect($)
                              : select($, snap, f)
                          }
                        />
                      </Box>
                      {sel?.root === snap.root && sel.path === f.path && sel.isUntracked === f.isUntracked && selectedDiff}
                    </Box>
                  )
                })}
            </Box>
          )
        })}
      </Box>
    )
  })
}
