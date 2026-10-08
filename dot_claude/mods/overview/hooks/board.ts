export type Task = { title?: unknown; state?: unknown; waitsFor?: unknown }

export type Status = {
  tasks?: Task[]
  pending?: unknown[]
  isWorking?: unknown
  idleSince?: unknown
  updatedAt?: unknown
}

export type Main = {
  workspace: string
  pane: string
  tabId?: string
  mark?: string
  status: Status
}

export type Blocked = { workspace: string; tabId: string; name: string; label: string }

export type Column = 'reply' | 'working' | 'review' | 'done'

export type Card = { column: Column; title: string; workspace: string; mark: string; tabId: string; elapsedMs?: number }

export type Board = Record<Column, Card[]>

const today = (left: number, right: number) => {
  const a = new Date(left)
  const b = new Date(right)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const card = (column: Column, main: Main, title: string): Card | undefined =>
  main.tabId === undefined ? undefined : { column, title, workspace: main.workspace, mark: main.mark ?? '', tabId: main.tabId }

export const cards = (mains: Main[], blocked: Blocked[], now: number): Board => {
  const reply = blocked.map(agent => ({ column: 'reply' as const, title: agent.name, workspace: agent.workspace, mark: agent.label, tabId: agent.tabId }))
  const pending: Card[] = []
  const working: Card[] = []
  const review: Card[] = []
  const done: Card[] = []

  for (const main of mains) {
    const { status } = main
    if (status.isWorking === false && Array.isArray(status.pending)) {
      const elapsedMs = typeof status.idleSince === 'number' ? Math.max(0, now - status.idleSince) : undefined
      for (const title of status.pending) {
        if (typeof title !== 'string') continue
        const next = card('reply', main, title)
        if (next !== undefined) pending.push({ ...next, ...(elapsedMs !== undefined && { elapsedMs }) })
      }
    }

    for (const task of status.tasks ?? []) {
      if (typeof task.title !== 'string') continue
      if (task.state === 'doing') {
        const next = card('working', main, task.title)
        if (next !== undefined) working.push(next)
      }
      if (task.state === 'waiting' && task.waitsFor === 'others') {
        const next = card('review', main, task.title)
        if (next !== undefined) review.push(next)
      }
      if (task.state === 'done' && typeof status.updatedAt === 'number' && today(status.updatedAt, now)) {
        const next = card('done', main, task.title)
        if (next !== undefined) done.push(next)
      }
    }
  }

  pending.sort((a, b) => (b.elapsedMs ?? -1) - (a.elapsedMs ?? -1))
  return { reply: [...reply, ...pending], working, review, done }
}
