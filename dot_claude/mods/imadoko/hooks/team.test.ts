import { expect, test } from 'claude-code/testing'

import { cells, HEIGHT, pixels, WIDTH } from './sprite'
import { assignMarks, changes, cleanNote, EMPTY_BOOK, freshStatus, isLead, marksOf, members, needsNote, notePrompt, parseAgents, parseTabs, roleOf, savedBooksOf, stateOf, summary, teamWordsFor, withBook } from './team'

const TABS = JSON.stringify({
  result: {
    tabs: [
      { tab_id: 't1', label: 'main' },
      { tab_id: 't2', label: 'impl-dots-20261005-1200-codex' },
      { tab_id: 't3', label: 'review-dots-163-claude' },
      { tab_id: 't4', label: 'shell' },
      { tab_id: 't5', label: 'scratch' },
    ],
  },
})

const AGENTS = JSON.stringify({
  result: {
    agents: [
      { pane_id: 'p1', tab_id: 't1', agent: 'claude', agent_status: 'working' },
      { pane_id: 'p2', tab_id: 't2', agent: 'codex', agent_status: 'blocked' },
      { pane_id: 'p5', tab_id: 't5', agent: 'claude', agent_status: 'idle' },
      { pane_id: 'p9', tab_id: 'other-ws', agent: 'claude', agent_status: 'working' },
    ],
  },
})

const JA = teamWordsFor('日本語')

test('roles come from the tab label, the main tab leads and is left out, and each member gets a mark', () => {
  expect(roleOf('impl-dots-x-codex')).toEqual({ role: 'impl', kind: 'codex' })
  expect(roleOf('review-dots-163-claude')).toEqual({ role: 'review', kind: 'claude' })
  expect(isLead(parseTabs(TABS), 't1')).toBe(true)
  expect(isLead(parseTabs(TABS), 't2')).toBe(false)
  const { list } = assignMarks(members(parseTabs(TABS), parseAgents(AGENTS), { t2: { task: 'ログイン画面を直す' } }, 't1'), EMPTY_BOOK)
  expect(list.map(m => [m.mark, m.role, m.status, m.paneId])).toEqual([
    ['I1', 'impl', 'blocked', 'p2'],
    ['R1', 'review', 'absent', undefined],
    ['M1', 'member', 'idle', 'p5'],
  ])
  expect(marksOf(list, JA)[0]).toEqual({ mark: 'I1', about: '実装 · codex · ログイン画面を直す' })
})

test('short tab labels use their records for role and kind while old labels stay compatible', () => {
  const tabs = [
    { tabId: 'main', label: 'main' },
    { tabId: 'r2', label: 'R2' },
    { tabId: 'i1', label: 'I1' },
    { tabId: 'old', label: 'review-dots-1-claude' },
  ]
  const agents = [
    { paneId: 'p2', tabId: 'r2', status: 'working' as const },
    { paneId: 'p1', tabId: 'i1', status: 'working' as const, kind: 'codex' },
    { paneId: 'p3', tabId: 'old', status: 'working' as const },
  ]
  const { list } = assignMarks(
    members(tabs, agents, {
      r2: { task: 't', role: 'review', kind: 'codex', pr: { owner: '0ta2', repo: 'dots', number: 174 } },
      i1: { task: 't' },
    }, 'main'),
    EMPTY_BOOK,
  )
  expect(list.map(member => [member.mark, member.role, member.kind])).toEqual([
    ['I1', 'impl', 'codex'],
    ['R2', 'review', 'codex'],
    ['R1', 'review', 'claude'],
  ])
})

test('a mark stays with its tab and is never handed to another one', () => {
  const tabs = parseTabs(TABS)
  const first = assignMarks(members(tabs, parseAgents(AGENTS), {}, 't1'), EMPTY_BOOK)
  const extra = [...tabs.filter(t => t.tabId !== 't2'), { tabId: 't6', label: 'impl-dots-later-claude' }, { tabId: 't7', label: 'impl-dots-a-codex' }]
  const second = assignMarks(members(extra, parseAgents(AGENTS), {}, 't1'), first.book)
  expect(second.list.map(m => [m.tabId, m.mark])).toEqual([
    ['t7', 'I2'],
    ['t6', 'I3'],
    ['t3', 'R1'],
    ['t5', 'M1'],
  ])
})

test('broken herdr output gives no members', () => {
  expect(parseTabs('not json')).toEqual([])
  expect(parseAgents('{"result":{}}')).toEqual([])
})

test('a member turning blocked or finishing is announced once', () => {
  const { list } = assignMarks(members(parseTabs(TABS), parseAgents(AGENTS), {}, 't1'), EMPTY_BOOK)
  const before = new Map(list.map(m => [m.tabId, m.status] as const))
  expect(changes(new Map(), list, JA)).toEqual([])
  before.set('t2', 'working')
  expect(changes(before, list.map(m => (m.tabId === 't2' ? { ...m, status: 'idle' as const } : m)), JA)).toEqual([
    '✅ I1 impl-dots-20261005-1200-codex の手が止まりました',
  ])
  before.set('t2', 'idle')
  expect(changes(before, list, JA)).toEqual(['❗ I1 impl-dots-20261005-1200-codex が質問待ちです'])
  expect(summary(list, JA)).toBe('team ❗1 💤1')
  expect(summary([], JA)).toBeUndefined()
})

test('a member is read off its screen when its state changes, and every 90 s while it works', () => {
  const [impl] = members(parseTabs(TABS), parseAgents(AGENTS), {}, 't1')
  expect(needsNote(undefined, impl!, undefined, 0)).toBe(true)
  expect(needsNote('blocked', impl!, 0, 999_999)).toBe(false)
  const working = { ...impl!, status: 'working' as const }
  expect(needsNote('working', working, 0, 60_000)).toBe(false)
  expect(needsNote('working', working, 0, 90_000)).toBe(true)
  expect(notePrompt(working, 'x'.repeat(5000), '日本語').prompt).toContain('x'.repeat(4000) + '\n</screen>')
  expect(cleanNote('「DB スキーマについて質問中」\n補足')).toBe('DB スキーマについて質問中')
  expect(cleanNote('  ')).toBeUndefined()
})

test('a member status file stands in for the screen only while it is recent', () => {
  const text = JSON.stringify({ status: 'テストを直している', savedAt: 1000 })
  expect(freshStatus(text, 1000 + 60_000)?.status).toBe('テストを直している')
  expect(freshStatus(text, 1000 + 11 * 60_000)).toBeUndefined()
  expect(freshStatus('{', 0)).toBeUndefined()
})

test('every sprite is a full grid, animates, and differs by agent', () => {
  for (const kind of [undefined, 'claude', 'codex']) {
    for (const role of ['impl', 'review', 'member'] as const) {
      for (const status of ['working', 'blocked', 'idle', 'done', 'unknown', 'absent'] as const) {
        const rows = pixels(role, status, 0, kind)
        expect(rows.length).toBe(HEIGHT)
        expect(rows.every(r => r.length === WIDTH)).toBe(true)
        expect(cells(role, status, 0, kind).length).toBe(Math.ceil((WIDTH * (HEIGHT / 2) * 12) / 3) * 4)
      }
    }
  }
  expect(pixels('impl', 'working', 0, 'codex')).not.toEqual(pixels('impl', 'working', 1, 'codex'))
  expect(pixels('review', 'blocked', 0, 'claude')).not.toEqual(pixels('review', 'blocked', 1, 'claude'))
  expect(pixels('impl', 'idle', 0, 'claude')).not.toEqual(pixels('impl', 'idle', 0, 'codex'))
})

test('saved mark books drop what does not parse and keep the most recently changed', () => {
  const book = { marks: { t2: 'I1' }, next: { impl: 1 } }
  expect(savedBooksOf({ wA: { book, savedAt: 5 }, wB: { book: 'x', savedAt: 1 }, wC: { book: { marks: { t: 1 }, next: { bad: 2 } }, savedAt: 2 } })).toEqual({
    wA: { book, savedAt: 5 },
    wC: { book: { marks: {}, next: {} }, savedAt: 2 },
  })
  expect(savedBooksOf('nope')).toEqual({})
  let saved = {}
  for (let i = 0; i < 25; i++) saved = withBook(saved, `w${i}`, book, i)
  expect(Object.keys(saved).length).toBe(20)
  expect(Object.keys(saved)).not.toContain('w4')
  expect(Object.keys(saved)).toContain('w24')
})

test('the state is read from other field names and words herdr uses', () => {
  expect(['working', 'Busy', 'waiting', 'finished', 'idle', 'constructor', undefined].map(stateOf)).toEqual(['working', 'working', 'blocked', 'done', 'idle', 'unknown', 'unknown'])
  const one = (agent: Record<string, string>) => parseAgents(JSON.stringify({ result: { agents: [{ pane_id: 'p', tab_id: 't', ...agent }] } }))[0]?.status
  expect([one({ agent_status: 'idle' }), one({ status: 'busy' }), one({ state: 'waiting' })]).toEqual(['idle', 'working', 'blocked'])
})
