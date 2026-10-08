import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'imadoko',
  component: 'Pane' as const,
  requestId: 'imadoko',
  props: { title: 'imadoko', isFocused: true, bodyColumns: 80, placement: 'inline' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} },
}

const NO_USAGE = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

const SUMMARY = {
  purpose: 'チケットを片付ける',
  status: '実装を待っている',
  tasks: [{ title: 'ログイン画面を直す', state: 'waiting', detail: '', owner: 'I1', waitsOn: '', waitsFor: '' }],
  decisions: [],
  pending: [],
}

const tabsOut = (selfLabel: string) =>
  JSON.stringify({ result: { tabs: [{ tab_id: 't1', label: selfLabel }, { tab_id: 't2', label: 'impl-dots-x-codex' }, { tab_id: 't3', label: 'review-dots-1-claude' }] } })

const AGENTS = JSON.stringify({
  result: {
    agents: [
      { pane_id: 'p1', tab_id: 't1', agent: 'claude', agent_status: 'working' },
      { pane_id: 'p2', tab_id: 't2', agent: 'codex', agent_status: 'blocked' },
      { pane_id: 'p3', tab_id: 't3', agent: 'claude', agent_status: 'working' },
    ],
  },
})

type World = { agents: string; tabs?: string; paneGet?: string; space?: string; screenReply?: (n: number) => Promise<string>; store?: Record<string, unknown>; files?: Record<string, string>; summary?: typeof SUMMARY; pullView?: string | Promise<string>; unresolved?: string | Promise<string>; session?: { id: string } }

function standIn(on: On, selfLabel: string, env: Record<string, string>, world: World = { agents: AGENTS }) {
  const prompts: string[] = []
  const statuses: (string | undefined)[] = []
  const toasts: string[] = []
  const runs: string[][] = []
  mock.env(on, env)
  const clock = mock.clock(on, { now: 1_790_000_000_000 })
  const store = new Map<string, unknown>(Object.entries(world.store ?? {}))
  on('store.get', (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', (_$, e) => {
    store.set(e.key, JSON.parse(JSON.stringify(e.value)))
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...store.keys()] }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('session.id', () => ({ value: world.session?.id ?? 'sess-1' }))
  on('session.messages', () => ({ value: [] }))
  on('settings.read', () => ({ value: { language: '日本語' } }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.status', (_$, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('process.run', async (_$, e) => {
    runs.push(e.argv)
    if (e.argv[0] === 'gh' && e.argv[1] === 'pr' && e.argv[2] === 'view') {
      const stdout = await world.pullView
      return { value: { exitCode: stdout === undefined ? 1 : 0, stdout: stdout ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    if (e.argv[0] === 'gh' && e.argv[1] === 'api' && e.argv[2] === 'graphql') {
      const stdout = await world.unresolved
      return { value: { exitCode: stdout === undefined ? 1 : 0, stdout: stdout ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    const key = e.argv.slice(1).join(' ')
    const out: Record<string, string> = {
      [`tab list --workspace ${world.space ?? 'wW'}`]: world.tabs ?? tabsOut(selfLabel),
      'agent list': world.agents,
      'pane read p2': '? Which login provider should I use?',
      'pane read p3': '? Should I block on the naming nits?',
      ...(world.paneGet === undefined ? {} : { 'pane get p1': world.paneGet }),
    }
    return { value: { exitCode: key in out ? 0 : 1, stdout: out[key] ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.read', (_$, e) => {
    const file = Object.entries(world.files ?? {}).find(([end]) => e.path.endsWith(end))
    if (file) return { value: file[1] }
    if (e.path.endsWith('/herdr-team/wW/t2.json')) return { value: '{"task":"ログイン画面を直す"}' }
    if (e.path.endsWith('/imadoko/wW/p3.json')) return { value: JSON.stringify({ status: 'レビュー指摘を読んでいる', savedAt: 1_790_000_000_000 - 1000 }) }
    throw new Error('ENOENT')
  })
  on('fs.write', () => ({ value: undefined }))
  let screens = 0
  on('model.complete', async (_$, e) => {
    prompts.push(e.prompt)
    const isScreen = e.prompt.includes('<screen>')
    if (isScreen) screens += 1
    const text = !isScreen ? JSON.stringify(world.summary ?? SUMMARY) : world.screenReply ? await world.screenReply(screens) : 'ログイン方式について質問中'
    return { value: { isAnswered: true as const, text, usage: NO_USAGE } }
  })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return { prompts, statuses, toasts, runs, clock, store }
}

const ENV = { HERDR_ENV: '1', HERDR_WORKSPACE_ID: 'wW', HERDR_PANE_ID: 'p1', HOME: '/h' }

test('in the main tab the pane shows each member with its state and what it is doing', async ($, on) => {
  const seen = standIn(on, 'main', ENV)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ text: /I1 · 実装 · codex/ })).toBeDefined()
    expect(await ui.find({ text: /質問待ち · ログイン方式について質問中/ })).toBeDefined()
    expect(await ui.find({ text: /R1 · レビュー · claude/ })).toBeDefined()
    expect(await ui.find({ text: /作業中 · レビュー指摘を読んでいる/ })).toBeDefined()
    expect(await ui.find({ text: /ログイン画面を直す/ })).toBeDefined()
    expect(!!(await ui.find({ type: 'Raster' }))).toBe(surface === 'terminal')
    await ui.unmount()
  }
  expect(seen.statuses.at(-1)).toBe('team ⚙️1 ❗1')
  expect(seen.prompts.filter(p => p.includes('<screen>')).length).toBe(1)
})

test('pressing a member focuses its tab', async ($, on) => {
  const seen = standIn(on, 'main', ENV)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'focus:t2' })
  await ui.unmount()
  expect(seen.runs).toContainEqual(['herdr', 'tab', 'focus', 't2'])
})

test('the summary names task owners by the members marks', async ($, on) => {
  const seen = standIn(on, 'main', ENV)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.turn.start({ turnId: 't', text: '実装を頼んで' })
  await $.turn.complete({ turnId: 't', answer: '頼みました', durationMs: 1000, isAborted: false, reason: 'answer' })
  await seen.clock.settle()
  const ask = seen.prompts.find(p => p.includes('<members>'))
  expect(ask).toContain('I1: 実装 · codex · ログイン画面を直す')
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /担当: I1 · ❗ 質問待ち/ })).toBeDefined()
  await ui.unmount()
})

test('a tab other than main keeps no team', async ($, on) => {
  const seen = standIn(on, 'impl-dots-y-claude', ENV)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /I1 · 実装/ })).toBeUndefined()
  await ui.unmount()
  expect(seen.statuses.filter(Boolean)).toEqual([])
})

test('a pane moved to another workspace reads the team of the workspace it is in now', async ($, on) => {
  standIn(on, 'main', ENV, { agents: AGENTS, space: 'wX', paneGet: JSON.stringify({ result: { pane: { tab_id: 't1', workspace_id: 'wX' } } }) })
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /I1 · 実装 · codex/ })).toBeDefined()
  await ui.unmount()
})

test('a summary that comes back after the member moved on is dropped and the member is read again', async ($, on) => {
  let release: (text: string) => void = () => {}
  const first = new Promise<string>(resolve => {
    release = resolve
  })
  const world: World = { agents: AGENTS, screenReply: async n => (n === 1 ? first : '返答を待って待機中') }
  const seen = standIn(on, 'main', ENV, world)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await seen.clock.advance(0)
  expect(seen.prompts.filter(p => p.includes('<screen>')).length).toBe(1)
  world.agents = AGENTS.replace('"blocked"', '"idle"')
  await seen.clock.advance(3000)
  release('ログイン方式について質問中')
  await seen.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /待機中 · 返答を待って待機中/ })).toBeDefined()
  expect(await ui.find({ text: /ログイン方式について質問中/ })).toBeUndefined()
  await ui.unmount()
})

test('marks come back from the store after a /resume emptied the session state', async ($, on) => {
  const book = { marks: { t9: 'I1', t2: 'I2' }, next: { impl: 2 } }
  const seen = standIn(on, 'main', ENV, { agents: AGENTS, store: { 'imadoko-marks': { wW: { book, savedAt: 1 } } } })
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /I2 · 実装 · codex/ })).toBeDefined()
  expect(await ui.find({ text: /R1 · レビュー · claude/ })).toBeDefined()
  await ui.unmount()
  expect(seen.store.get('imadoko-marks')).toEqual({ wW: { book: { marks: { t9: 'I1', t2: 'I2', t3: 'R1' }, next: { impl: 2, review: 1 } }, savedAt: 1_790_000_000_000 } })
})

test('a status file the member wrote wins over a screen summary still in flight', async ($, on) => {
  let release: (text: string) => void = () => {}
  const first = new Promise<string>(resolve => {
    release = resolve
  })
  const world: World = { agents: AGENTS, screenReply: async () => first, files: {} }
  const seen = standIn(on, 'main', ENV, world)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await seen.clock.advance(0)
  world.files = { '/imadoko/wW/p2.json': JSON.stringify({ status: 'ログイン方式を決めて実装中', savedAt: 1_790_000_000_000 }) }
  await seen.clock.advance(3000)
  release('ログイン方式について質問中')
  await seen.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /ログイン方式を決めて実装中/ })).toBeDefined()
  expect(await ui.find({ text: /ログイン方式について質問中/ })).toBeUndefined()
  await ui.unmount()
})

test('after a pane move the task records of both the old and the current workspace are read', async ($, on) => {
  standIn(on, 'main', ENV, {
    agents: AGENTS,
    space: 'wX',
    paneGet: JSON.stringify({ result: { pane: { tab_id: 't1', workspace_id: 'wX' } } }),
    files: { '/herdr-team/wX/t3.json': '{"task":"PR を見る"}' },
  })
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /ログイン画面を直す/ })).toBeDefined()
  expect(await ui.find({ text: /PR を見る/ })).toBeDefined()
  await ui.unmount()
})

test('a state change after the member last wrote its status file is read off the screen', async ($, on) => {
  const world: World = { agents: AGENTS, screenReply: async n => (n === 1 ? 'ログイン方式について質問中' : '指摘の扱いを質問中') }
  const seen = standIn(on, 'main', ENV, world)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await seen.clock.advance(0)
  world.agents = AGENTS.replace(/("pane_id":"p3","tab_id":"t3","agent":"claude","agent_status":)"working"/, '$1"blocked"')
  await seen.clock.advance(3000)
  await seen.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /質問待ち · 指摘の扱いを質問中/ })).toBeDefined()
  expect(await ui.find({ text: /レビュー指摘を読んでいる/ })).toBeUndefined()
  await ui.unmount()
})

test('a status file written between two polls counts as written after the state change', async ($, on) => {
  const world: World = { agents: AGENTS, files: {} }
  const seen = standIn(on, 'main', ENV, world)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await seen.clock.advance(0)
  world.agents = AGENTS.replace(/("pane_id":"p2","tab_id":"t2","agent":"codex","agent_status":)"blocked"/, '$1"idle"')
  world.files = { '/imadoko/wW/p2.json': JSON.stringify({ status: 'ログイン画面を直して PR を出した', savedAt: 1_790_000_000_000 + 1500 }) }
  await seen.clock.advance(3000)
  await seen.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /待機中 · ログイン画面を直して PR を出した/ })).toBeDefined()
  await ui.unmount()
})

test('a screen read that gives no line is tried again a little later', async ($, on) => {
  const world: World = { agents: AGENTS, screenReply: async n => (n === 1 ? '' : 'ログイン方式について質問中') }
  const seen = standIn(on, 'main', ENV, world)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await seen.clock.advance(0)
  await seen.clock.settle()
  await seen.clock.advance(30_000)
  await seen.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /質問待ち · ログイン方式について質問中/ })).toBeDefined()
  await ui.unmount()
})

test('a queued read still runs when the read in flight fails', async ($, on) => {
  let fail: (e: Error) => void = () => {}
  const first = new Promise<string>((_, reject) => {
    fail = reject
  })
  const world: World = { agents: AGENTS, screenReply: async n => (n === 1 ? first : '返答を待って待機中') }
  const seen = standIn(on, 'main', ENV, world)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await seen.clock.advance(0)
  world.agents = AGENTS.replace('"blocked"', '"idle"')
  await seen.clock.advance(3000)
  fail(new Error('model down'))
  await seen.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /待機中 · 返答を待って待機中/ })).toBeDefined()
  await ui.unmount()
})

test('a member whose agent left drops the line a read in flight would have given', async ($, on) => {
  let release: (text: string) => void = () => {}
  const first = new Promise<string>(resolve => {
    release = resolve
  })
  const world: World = { agents: AGENTS, screenReply: async () => first }
  const seen = standIn(on, 'main', ENV, world)
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await seen.clock.advance(0)
  world.agents = AGENTS.replace(/\{"pane_id":"p2"[^}]*\},/, '')
  await seen.clock.advance(3000)
  release('ログイン方式について質問中')
  await seen.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /I1 · 実装 · codex/ })).toBeDefined()
  expect(await ui.find({ text: /ログイン方式について質問中/ })).toBeUndefined()
  await ui.unmount()
})

test('a member whose state herdr cannot tell is still read off its screen', async ($, on) => {
  const seen = standIn(on, 'main', ENV, { agents: AGENTS.replace('"blocked"', '"unknown"') })
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await seen.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /不明 · ログイン方式について質問中/ })).toBeDefined()
  await ui.unmount()
})

test('pressing Section headings folds and unfolds their bodies', async ($, on) => {
  const seen = standIn(on, 'main', ENV, { agents: AGENTS, summary: { ...SUMMARY, decisions: ['OAuth を使う'] } })
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.turn.start({ turnId: 't', text: '実装を頼んで' })
  await $.turn.complete({ turnId: 't', answer: '頼みました', durationMs: 1000, isAborted: false, reason: 'answer' })
  await seen.clock.settle()
  const press = async (key: string) => {
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    await ui.press({ key })
    await ui.unmount()
  }

  await press('section:purpose')
  let ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /チケットを片付ける/ })).toBeUndefined()
  expect((await ui.find({ key: 'section:purpose' }))?.props.label).toBe('▸')
  await ui.unmount()
  await press('section:decisions')
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /- OAuth を使う/ })).toBeUndefined()
  expect((await ui.find({ key: 'section:decisions' }))?.props.label).toBe('▸')
  await ui.unmount()
  await press('section:purpose')
  await press('section:decisions')
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /チケットを片付ける/ })).toBeDefined()
  expect(await ui.find({ text: /- OAuth を使う/ })).toBeDefined()
  expect((await ui.find({ key: 'section:purpose' }))?.props.label).toBe('▾')
  expect((await ui.find({ key: 'section:decisions' }))?.props.label).toBe('▾')
  await ui.unmount()
})

test('a pull request the session opened shows in the pane', async ($, on) => {
  const seen = standIn(on, 'main', ENV, {
    agents: AGENTS,
    pullView: JSON.stringify({ title: 'ブランチ強制削除を防ぐ', url: 'https://github.com/0ta2/dots/pull/171', state: 'OPEN', mergeStateStatus: 'CLEAN', statusCheckRollup: [] }),
    unresolved: JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: { nodes: [{ isResolved: false }] } } } } }),
  })
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: 'https://github.com/0ta2/dots/pull/171\n', stderr: '', interrupted: false } }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'gh pr create --title x' })
  await seen.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /dots#171/ })).toBeDefined()
  expect(await ui.find({ text: /ブランチ強制削除を防ぐ/ })).toBeDefined()
  expect(await ui.find({ text: /未解決 1/ })).toBeDefined()
  expect(await ui.find({ text: /マージ可/ })).toBeDefined()
  await ui.unmount()
})

test('a short tab with a matching review record is shown as the reviewer', async ($, on) => {
  const seen = standIn(on, 'main', ENV, {
    agents: JSON.stringify({ result: { agents: [{ pane_id: 'p1', tab_id: 't1', agent: 'claude', agent_status: 'working' }, { pane_id: 'p2', tab_id: 't2', agent: 'codex', agent_status: 'working' }] } }),
    tabs: JSON.stringify({ result: { tabs: [{ tab_id: 't1', label: 'main' }, { tab_id: 't2', label: 'R2' }] } }),
    files: { '/herdr-team/wW/t2.json': '{"task":"t","role":"review","kind":"codex","pr":{"owner":"0ta2","repo":"dots","number":171}}' },
    pullView: JSON.stringify({ title: 't', url: 'https://github.com/0ta2/dots/pull/171', state: 'OPEN', mergeStateStatus: 'CLEAN', statusCheckRollup: [] }),
    unresolved: '0',
  })
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: 'https://github.com/0ta2/dots/pull/171\n', stderr: '', interrupted: false } }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'gh pr create --title x' })
  await seen.clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /R2 · レビュー · codex/ })).toBeDefined()
  expect(await ui.find({ text: /レビュー担当: R2/ })).toBeDefined()
  await ui.unmount()
})

test('a merged pull request leaves the pane', async ($, on) => {
  const world: World = {
    agents: AGENTS,
    pullView: JSON.stringify({ title: 'ブランチ強制削除を防ぐ', url: 'https://github.com/0ta2/dots/pull/171', state: 'OPEN', mergeStateStatus: 'CLEAN', statusCheckRollup: [] }),
    unresolved: JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: { nodes: [] } } } } }),
  }
  const seen = standIn(on, 'main', ENV, world)
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: 'https://github.com/0ta2/dots/pull/171\n', stderr: '', interrupted: false } }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'gh pr create --title x' })
  await seen.clock.settle()
  let ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /dots#171/ })).toBeDefined()
  await ui.unmount()
  world.pullView = JSON.stringify({ title: 'ブランチ強制削除を防ぐ', url: 'https://github.com/0ta2/dots/pull/171', state: 'MERGED', mergeStateStatus: 'CLEAN', statusCheckRollup: [] })
  await seen.clock.advance(60_000)
  await seen.clock.settle()
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /dots#171/ })).toBeUndefined()
  await ui.unmount()
})

test('pull request records follow the conversation', async ($, on) => {
  const session = { id: 'sess-1' }
  const seen = standIn(on, 'main', ENV, {
    agents: AGENTS,
    session,
    pullView: JSON.stringify({ title: 'ブランチ強制削除を防ぐ', url: 'https://github.com/0ta2/dots/pull/171', state: 'OPEN', mergeStateStatus: 'CLEAN', statusCheckRollup: [] }),
    unresolved: JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: { nodes: [] } } } } }),
  })
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: 'https://github.com/0ta2/dots/pull/171\n', stderr: '', interrupted: false } }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'gh pr create --title x' })
  await seen.clock.settle()
  await $.session.end({ reason: 'resume', sessionId: 'sess-1', resume: { id: 'sess-1' } })
  let ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /dots#171/ })).toBeUndefined()
  await ui.unmount()
  session.id = 'sess-2'
  await seen.clock.advance(500)
  await seen.clock.settle()
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /dots#171/ })).toBeUndefined()
  await ui.unmount()
  await $.session.end({ reason: 'resume', sessionId: 'sess-2', resume: { id: 'sess-2' } })
  session.id = 'sess-1'
  await seen.clock.advance(500)
  await seen.clock.settle()
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /dots#171/ })).toBeDefined()
  await ui.unmount()
})

test('a new pull request is loading before its view arrives', async ($, on) => {
  let release: (text: string) => void = () => {}
  const pullView = new Promise<string>(resolve => {
    release = resolve
  })
  const seen = standIn(on, 'main', ENV, {
    agents: AGENTS,
    pullView,
    unresolved: JSON.stringify({ data: { repository: { pullRequest: { reviewThreads: { nodes: [] } } } } }),
  })
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: 'https://github.com/0ta2/dots/pull/171\n', stderr: '', interrupted: false } }))

  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'gh pr create --title x' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /読み込み中…/ })).toBeDefined()
  expect(await ui.find({ text: /読めません/ })).toBeUndefined()
  await ui.unmount()
  release(JSON.stringify({ title: 'ブランチ強制削除を防ぐ', url: 'https://github.com/0ta2/dots/pull/171', state: 'OPEN', mergeStateStatus: 'CLEAN', statusCheckRollup: [] }))
})
