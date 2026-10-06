import { expect, test } from 'claude-code/testing'

import { checksOf, isReviewerOf, mergeOf, parseUnresolved, parseView, pullsCreated } from './prs'

test('recognizes pull requests created by gh', () => {
  expect(pullsCreated('gh pr create --title x', 'https://github.com/0ta2/dots/pull/171\n')).toEqual([{ owner: '0ta2', repo: 'dots', number: 171 }])
  expect(pullsCreated('gh pr view 171', 'https://github.com/0ta2/dots/pull/171')).toEqual([])
})

test('maps merge states', () => {
  expect(mergeOf('CLEAN')).toBe('clean')
  expect(mergeOf('DIRTY')).toBe('conflict')
  expect(mergeOf('BLOCKED')).toBe('blocked')
  expect(mergeOf(undefined)).toBe('unknown')
})

test('summarizes checks', () => {
  expect(checksOf([])).toBeUndefined()
  expect(checksOf([{ conclusion: 'SUCCESS' }])).toBe('pass')
  expect(checksOf([{ conclusion: 'SUCCESS' }, { conclusion: 'FAILURE' }])).toBe('fail')
  expect(checksOf([{ status: 'IN_PROGRESS', conclusion: '' }])).toBe('pending')
})

test('parses pull request views', () => {
  expect(parseView('{"title":"t","url":"u","state":"OPEN","mergeStateStatus":"CLEAN","statusCheckRollup":[]}')).toEqual({ title: 't', url: 'u', state: 'OPEN', merge: 'clean' })
  expect(parseView('{')).toBeUndefined()
})

test('counts unresolved review threads', () => {
  expect(parseUnresolved('{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[{"isResolved":true},{"isResolved":false}]}}}}}')).toBe(1)
  expect(parseUnresolved('2\n3\n')).toBe(5)
  expect(parseUnresolved('{')).toBeUndefined()
})

test('recognizes a matching reviewer label', () => {
  const pull = { owner: '0ta2', repo: 'dots', number: 171 }
  expect(isReviewerOf('review-dots-171-codex', pull)).toBe(true)
  expect(isReviewerOf('review-dots-1710-codex', pull)).toBe(false)
})
