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

function standIn(on: On, selfLabel: string, env: Record<string, string>) {
  const prompts: string[] = []
  const statuses: (string | undefined)[] = []
  const toasts: string[] = []
  mock.env(on, env)
  const clock = mock.clock(on, { now: 1_790_000_000_000 })
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('store.keys', () => ({ value: [] }))
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
      'tab list --workspace wW': tabsOut(selfLabel),
      'agent list': AGENTS,
      'pane read p2': '? Which login provider should I use?',
    }
    return { value: { exitCode: key in out ? 0 : 1, stdout: out[key] ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.list', (_$, e) =>
    e.path?.endsWith('/herdr-team/wW') ? { value: [{ name: 't2.json', kind: 'file' as const, size: 10, mtimeMs: 0, isLink: false }] } : { value: [] },
  )
  on('fs.read', (_$, e) => {
    if (e.path.endsWith('/herdr-team/wW/t2.json')) return { value: '{"task":"ログイン画面を直す"}' }
    if (e.path.endsWith('/imadoko/wW/p3.json')) return { value: JSON.stringify({ status: 'レビュー指摘を読んでいる', savedAt: 1_790_000_000_000 - 1000 }) }
    throw new Error('ENOENT')
  })
  on('fs.write', () => ({ value: undefined }))
  on('model.complete', (_$, e) => {
    prompts.push(e.prompt)
    const text = e.prompt.includes('<screen>') ? 'ログイン方式について質問中' : JSON.stringify(SUMMARY)
    return { value: { isAnswered: true as const, text, usage: NO_USAGE } }
  })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return { prompts, statuses, toasts, clock }
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
