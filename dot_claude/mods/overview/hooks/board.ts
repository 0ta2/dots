export type Task = { title?: unknown; state?: unknown; waitsFor?: unknown }

export type Status = {
  purpose?: unknown
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
  purpose?: string
  status: Status
}

export type Blocked = { workspace: string; tabId: string; name: string; label: string; task?: string }

export type Column = 'reply' | 'working' | 'review' | 'done'

export type Card = { column: Column; title: string; workspace: string; mark: string; tabId: string; elapsedMs?: number }

export type Board = Record<Column, Card[]>

const card = (column: Column, main: Main, title: string): Card | undefined =>
  main.tabId === undefined ? undefined : { column, title, workspace: main.workspace, mark: main.mark ?? '', tabId: main.tabId }

export const cards = (mains: Main[], blocked: Blocked[], now: number): Board => {
  const reply = blocked.map(agent => ({ column: 'reply' as const, title: agent.task ?? agent.label, workspace: agent.workspace, mark: agent.label, tabId: agent.tabId }))
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

    const tasks = status.tasks ?? []
    for (const task of tasks) {
      if (typeof task.title !== 'string') continue
      if (task.state === 'doing') {
        const next = card('working', main, task.title)
        if (next !== undefined) working.push(next)
      }
      if (task.state === 'waiting' && task.waitsFor === 'others') {
        const next = card('review', main, task.title)
        if (next !== undefined) review.push(next)
      }
    }
    if (tasks.length > 0 && tasks.every(task => task.state === 'done') && Array.isArray(status.pending) && status.pending.length === 0) {
      const next = card('done', main, main.purpose?.trim() || (main.mark ?? ''))
      if (next !== undefined) done.push(next)
    }
  }

  pending.sort((a, b) => (b.elapsedMs ?? -1) - (a.elapsedMs ?? -1))
  return { reply: [...reply, ...pending], working, review, done }
}

const ALIASES: Readonly<Record<string, string>> = { busy: 'working', running: 'working', waiting: 'blocked', finished: 'done' }

export const agentStateOf = (raw: string | undefined): string => {
  const state = (raw ?? '').toLowerCase()
  return Object.hasOwn(ALIASES, state) ? ALIASES[state]! : state
}
