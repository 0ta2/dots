import { expect, mock, test, type TestBody } from 'claude-code/testing'

const NOW = 1_790_000_000_000
const PANE = { title: 'overview', isFocused: true, bodyColumns: 200, placement: 'inline' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} }

type On = Parameters<TestBody>[1]

const panes = JSON.stringify({ result: { panes: [{ pane_id: 'p1', workspace_id: 'ws1', tab_id: 't1' }, { pane_id: 'p2', workspace_id: 'ws1', tab_id: 't2' }] } })
const tabs = JSON.stringify({ result: { tabs: [{ tab_id: 't1', label: 'main' }, { tab_id: 't2', label: 'I1' }] } })
const agents = JSON.stringify({ result: { agents: [{ pane_id: 'p2', tab_id: 't2', agent: 'claude', agent_status: 'blocked' }] } })

function fake(on: On, environment: Record<string, string> = { HERDR_ENV: '1', HOME: '/home/u' }, agentList = true) {
  const calls: (readonly string[])[] = []
  const opened: unknown[] = []
  mock.env(on, environment)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', (_$, e) => {
    opened.push(e)
    return { value: { isPlaced: true as const } }
  })
  on('process.run', (_$, e) => {
    calls.push(e.argv)
    const action = `${e.argv[1]} ${e.argv[2]}`
    const stdout = action === 'pane list' ? panes : action === 'tab list' ? tabs : action === 'agent list' ? agents : ''
    return { value: { exitCode: action === 'agent list' && !agentList ? 1 : 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('fs.list', (_$, e) => {
    const value =
      e.path === '/home/u/.local/state/imadoko'
        ? [{ name: 'ws1', kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false }]
        : e.path === '/home/u/.local/state/imadoko/ws1'
          ? [
              { name: 'p1.json', kind: 'file' as const, size: 0, mtimeMs: 0, isLink: false },
              { name: 'p2.json', kind: 'file' as const, size: 0, mtimeMs: 0, isLink: false },
            ]
          : []
    return { value }
  })
  on('fs.read', (_$, e) => {
    const value =
      e.path === '/home/u/.local/state/imadoko/ws1/p1.json'
        ? JSON.stringify({ isLead: true, tasks: [], pending: ['返信してください'], isWorking: false, idleSince: NOW - 3_000, updatedAt: NOW })
        : e.path === '/home/u/.local/state/imadoko/ws1/p2.json'
          ? JSON.stringify({ isLead: false, tasks: [{ title: '表示しない', state: 'doing', waitsFor: '' }], pending: [], isWorking: true, idleSince: null, updatedAt: NOW })
          : e.path === '/home/u/.local/state/herdr-team/ws1/t2.json'
            ? JSON.stringify({ task: '承認を待つ' })
            : ''
    return { value }
  })
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return { calls, opened }
}

test('overview reads lead states and blocked tasks, draws cards, and focuses the selected tab', async ($, on) => {
  mock.clock(on, { now: NOW })
  const { calls, opened } = fake(on)

  await $.command.run({ command: 'overview', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })
  expect(opened).toEqual([{ id: 'overview', title: 'overview', columns: 200, closeOnEscape: true }])

  const ui = await $.ui.mount({ plugin: 'overview', surface: 'terminal', component: 'Pane', requestId: 'overview', props: PANE })
  expect((await ui.find({ key: 'card:reply:0' }))?.props.label).toBe('承認を待つ')
  expect((await ui.find({ key: 'card:reply:1' }))?.props.label).toBe('返信してください')
  expect(await ui.find({ text: '表示しない' })).toBeUndefined()
  await ui.press({ key: 'card:reply:0' })
  expect(calls.at(-1)).toEqual(['herdr', 'tab', 'focus', 't2'])
  await ui.unmount()
})

test('overview outside herdr shows only its instruction', async ($, on) => {
  const { calls } = fake(on, { HERDR_ENV: '', HOME: '/home/u' })

  await $.command.run({ command: 'overview', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })
  const ui = await $.ui.mount({ plugin: 'overview', surface: 'terminal', component: 'Pane', requestId: 'overview', props: PANE })
  expect(await ui.find({ text: 'herdr の中で開いてください' })).toBeDefined()
  expect(calls).toEqual([])
  await ui.unmount()
})

test('overview restores polling and refreshes when an open pane resumes', async ($, on) => {
  mock.clock(on, { now: NOW })
  const { calls } = fake(on)

  await $.command.run({ command: 'overview', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })
  const before = calls.length
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  expect(calls.length).toBeGreaterThan(before)
})

test('overview still updates mains when agent list fails', async ($, on) => {
  mock.clock(on, { now: NOW })
  fake(on, { HERDR_ENV: '1', HOME: '/home/u' }, false)

  await $.command.run({ command: 'overview', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 200 } })
  const ui = await $.ui.mount({ plugin: 'overview', surface: 'terminal', component: 'Pane', requestId: 'overview', props: PANE })
  expect((await ui.find({ key: 'card:reply:0' }))?.props.label).toBe('返信してください')
  await ui.unmount()
})
