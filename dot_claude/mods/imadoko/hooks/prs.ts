import type { Checks, Merge, PullRef, PullView } from '../types'

export const pullKey = (p: PullRef) => `${p.owner}/${p.repo}#${p.number}`

export function pullsCreated(command: string, stdout: string): PullRef[] {
  if (!/\bgh\s+pr\s+create\b/.test(command)) return []
  return [...stdout.matchAll(/https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/g)].map(m => ({
    owner: m[1]!,
    repo: m[2]!,
    number: Number(m[3]),
  }))
}

export function mergeOf(status: string | undefined): Merge {
  if (status === 'CLEAN' || status === 'HAS_HOOKS' || status === 'UNSTABLE') return 'clean'
  if (status === 'DIRTY') return 'conflict'
  if (status === 'BLOCKED' || status === 'BEHIND') return 'blocked'
  return 'unknown'
}

const FAILED = ['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE']

export function checksOf(rollup: unknown): Checks | undefined {
  if (!Array.isArray(rollup) || rollup.length === 0) return undefined
  const latest = new Map<string, { one: { conclusion?: unknown; state?: unknown; name?: unknown; context?: unknown; completedAt?: unknown; startedAt?: unknown }; at: string }>()
  rollup.forEach((check, index) => {
    const one = check as { conclusion?: unknown; state?: unknown; name?: unknown; context?: unknown; completedAt?: unknown; startedAt?: unknown }
    const key = typeof one.name === 'string' ? `name:${one.name}` : typeof one.context === 'string' ? `context:${one.context}` : `run:${index}`
    const at = typeof one.completedAt === 'string' && !one.completedAt.startsWith('0001-') ? one.completedAt : typeof one.startedAt === 'string' ? one.startedAt : ''
    const previous = latest.get(key)
    if (previous === undefined || at >= previous.at) latest.set(key, { one, at })
  })
  const results = [...latest.values()].map(({ one }) => {
    return String(one.conclusion || one.state || '').toUpperCase()
  })
  if (results.some(r => FAILED.includes(r))) return 'fail'
  if (results.some(r => r === '' || r === 'PENDING' || r === 'EXPECTED' || r === 'STALE')) return 'pending'
  return 'pass'
}

export function parseView(text: string): PullView | undefined {
  try {
    const v = JSON.parse(text) as { title?: unknown; url?: unknown; state?: unknown; mergeStateStatus?: unknown; statusCheckRollup?: unknown }
    if (typeof v.title !== 'string' || typeof v.url !== 'string' || typeof v.state !== 'string') return undefined
    const checks = checksOf(v.statusCheckRollup)
    return { title: v.title, url: v.url, state: v.state, merge: mergeOf(typeof v.mergeStateStatus === 'string' ? v.mergeStateStatus : undefined), ...(checks && { checks }) }
  } catch {
    return undefined
  }
}

export function parseUnresolved(text: string): number | undefined {
  const counts = text.trim().split(/\s+/)
  if (counts.length > 0 && counts.every(count => /^\d+$/.test(count))) return counts.reduce((total, count) => total + Number(count), 0)
  try {
    const nodes = (JSON.parse(text) as { data?: { repository?: { pullRequest?: { reviewThreads?: { nodes?: { isResolved?: unknown }[] } } } } })
      .data?.repository?.pullRequest?.reviewThreads?.nodes
    return Array.isArray(nodes) ? nodes.filter(n => n.isResolved === false).length : undefined
  } catch {
    return undefined
  }
}

export const isReviewerOf = (member: { label: string; record?: { pr?: PullRef } }, p: PullRef) =>
  member.record?.pr === undefined ? member.label.startsWith(`review-${p.repo}-${p.number}-`) : member.record.pr.owner === p.owner && member.record.pr.repo === p.repo && member.record.pr.number === p.number
