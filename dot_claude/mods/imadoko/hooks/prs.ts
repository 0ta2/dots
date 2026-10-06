export type PullRef = { owner: string; repo: string; number: number }
export type Merge = 'clean' | 'conflict' | 'blocked' | 'unknown'
export type Checks = 'pass' | 'fail' | 'pending'
export type PullView = { title: string; url: string; state: string; merge: Merge; checks?: Checks }

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
  const results = rollup.map(c => {
    const one = c as { conclusion?: unknown; state?: unknown }
    return String(one.conclusion || one.state || '').toUpperCase()
  })
  if (results.some(r => FAILED.includes(r))) return 'fail'
  if (results.some(r => r === '' || r === 'PENDING' || r === 'EXPECTED')) return 'pending'
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
  try {
    const nodes = (JSON.parse(text) as { data?: { repository?: { pullRequest?: { reviewThreads?: { nodes?: { isResolved?: unknown }[] } } } } })
      .data?.repository?.pullRequest?.reviewThreads?.nodes
    return Array.isArray(nodes) ? nodes.filter(n => n.isResolved === false).length : undefined
  } catch {
    return undefined
  }
}

export const isReviewerOf = (label: string, p: PullRef) => label.startsWith(`review-${p.repo}-${p.number}-`)
