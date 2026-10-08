import { expect, test } from 'claude-code/testing'

import { cards, type Main } from './board'

const now = new Date(2026, 9, 8, 12).valueOf()

const main = (status: Main['status'], extra: Partial<Main> = {}): Main => ({
  workspace: 'dots',
  pane: 'p1',
  tabId: 't1',
  mark: 'main',
  status,
  ...extra,
})

test('blocked agents use their task or tab label for reply cards', () => {
  expect(cards([], [{ workspace: 'harness', tabId: 't2', name: 'claude', label: 'I1', task: '質問に回答する' }], now).reply).toEqual([
    { column: 'reply', title: '質問に回答する', workspace: 'harness', mark: 'I1', tabId: 't2' },
  ])
  expect(cards([], [{ workspace: 'harness', tabId: 't2', name: 'claude', label: 'I1' }], now).reply[0]?.title).toBe('I1')
})

test('each pending item on an idle main becomes a reply card', () => {
  const status = { tasks: [], pending: ['権限を許可してください', '対象を選んでください'], isWorking: false, idleSince: now - 3_000, updatedAt: now }
  expect(cards([main(status)], [], now).reply).toEqual([
    { column: 'reply', title: '権限を許可してください', workspace: 'dots', mark: 'main', tabId: 't1', elapsedMs: 3_000 },
    { column: 'reply', title: '対象を選んでください', workspace: 'dots', mark: 'main', tabId: 't1', elapsedMs: 3_000 },
  ])
})

test('pending items on a working main stay out of reply', () => {
  expect(cards([main({ tasks: [], pending: ['待っている質問'], isWorking: true, idleSince: null, updatedAt: now })], [], now).reply).toEqual([])
})

test('doing tasks become working cards', () => {
  const status = { tasks: [{ title: 'カンバンを作る', state: 'doing', waitsFor: '', detail: '' }], pending: [], isWorking: true, idleSince: null, updatedAt: now }
  expect(cards([main(status)], [], now).working).toEqual([
    { column: 'working', title: 'カンバンを作る', workspace: 'dots', mark: 'main', tabId: 't1' },
  ])
})

test('only waiting tasks for others become review cards', () => {
  const status = {
    tasks: [
      { title: 'CI を待つ', state: 'waiting', waitsFor: 'others', detail: '' },
      { title: '回答を待つ', state: 'waiting', waitsFor: 'you', detail: '' },
    ],
    pending: [],
    isWorking: false,
    idleSince: now,
    updatedAt: now,
  }
  expect(cards([main(status)], [], now).review).toEqual([
    { column: 'review', title: 'CI を待つ', workspace: 'dots', mark: 'main', tabId: 't1' },
  ])
})

test('only tasks completed today become done cards', () => {
  const task = { title: '実装を終えた', state: 'done' as const, waitsFor: '', detail: '' }
  const yesterday = new Date(2026, 9, 7, 12).valueOf()
  expect(cards([main({ tasks: [task], pending: [], isWorking: false, idleSince: now, updatedAt: now }), main({ tasks: [task], pending: [], isWorking: false, idleSince: now, updatedAt: yesterday }, { tabId: 't2' })], [], now).done).toEqual([
    { column: 'done', title: '実装を終えた', workspace: 'dots', mark: 'main', tabId: 't1' },
  ])
})

test('reply cards keep blocked agents first and then sort idle mains by oldest wait', () => {
  const idle = (title: string, idleSince: number, tabId: string) => main({ tasks: [], pending: [title], isWorking: false, idleSince, updatedAt: now }, { tabId })
  expect(cards([idle('new', now - 1_000, 'new'), idle('old', now - 5_000, 'old')], [{ workspace: 'harness', tabId: 'blocked', name: 'claude', label: 'I1', task: '承認待ち' }], now).reply.map(card => card.title)).toEqual(['承認待ち', 'old', 'new'])
})
