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
  tasks: [{ title: 'ログイン画面を直す', state: 'waiting', detail: '', owner: 'I1', waitsOn: '' }],
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

type World = { agents: string; paneGet?: string; space?: string; screenReply?: (n: number) => Promise<string>; store?: Record<string, unknown>; files?: Record<string, string> }

function standIn(on: On, selfLabel: string, env: Record<string, string>, world: World = { agents: AGENTS }) {
  const prompts: string[] = []
  const statuses: (string | undefined)[] = []
  const toasts: string[] = []
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
  on('session.id', () => ({ value: 'sess-1' }))
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
  on('process.run', (_$, e) => {
    const key = e.argv.slice(1).join(' ')
    const out: Record<string, string> = {
      [`tab list --workspace ${world.space ?? 'wW'}`]: tabsOut(selfLabel),
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
    const text = !isScreen ? JSON.stringify(SUMMARY) : world.screenReply ? await world.screenReply(screens) : 'ログイン方式について質問中'
    return { value: { isAnswered: true as const, text, usage: NO_USAGE } }
  })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return { prompts, statuses, toasts, clock, store }
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
