import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { cards, type Board, type Main, type Status } from './board'

const PANE = 'overview'
const EMPTY: Board = { reply: [], working: [], review: [], done: [] }
const board = atom({ plugin: 'overview', key: 'board' } as const, EMPTY)
const isOpen = atom({ plugin: 'overview', key: 'isOpen' } as const, false)
const POLL_MS = 30_000
const FRESH_MS = 24 * 60 * 60 * 1000

type Json = Record<string, unknown>
type Pane = { pane: string; workspace: string; tabId: string }
type Agent = { pane: string; tabId: string; name: string; status: string }

const string = (value: unknown) => (typeof value === 'string' && value ? value : undefined)

const result = (text: string): Json | undefined => {
  try {
    const value = JSON.parse(text) as { result?: unknown }
    return value.result && typeof value.result === 'object' ? value.result as Json : undefined
  } catch {
    return undefined
  }
}

const records = (text: string, key: string): Json[] => {
  const value = result(text)?.[key]
  return Array.isArray(value) ? value.filter((item): item is Json => !!item && typeof item === 'object') : []
}

const panesOf = (text: string): Pane[] =>
  records(text, 'panes').flatMap(item => {
    const pane = string(item.pane_id)
    const workspace = string(item.workspace_id)
    const tabId = string(item.tab_id)
    return pane && workspace && tabId ? [{ pane, workspace, tabId }] : []
  })

const tabsOf = (text: string): { tabId: string; label: string }[] =>
  records(text, 'tabs').flatMap(item => {
    const tabId = string(item.tab_id)
    return tabId ? [{ tabId, label: string(item.label) ?? string(item.name) ?? '' }] : []
  })

const agentsOf = (text: string): Agent[] =>
  records(text, 'agents').flatMap(item => {
    const pane = string(item.pane_id)
    const tabId = string(item.tab_id)
    return pane && tabId ? [{ pane, tabId, name: string(item.agent) ?? '', status: (string(item.agent_status) ?? string(item.status) ?? '').toLowerCase() }] : []
  })

const stateOf = (text: string): (Status & { isLead: boolean; updatedAt: number }) | undefined => {
  try {
    const value = JSON.parse(text) as Json
    return value.isLead === true && typeof value.updatedAt === 'number' ? value as Status & { isLead: boolean; updatedAt: number } : undefined
  } catch {
    return undefined
  }
}

const taskOf = (text: string): string | undefined => {
  try {
    const task = (JSON.parse(text) as Json).task
    return typeof task === 'string' && task.trim() ? task.trim() : undefined
  } catch {
    return undefined
  }
}

const herdr = async ($: EngineInterface, args: string[]) => {
  const response = await $.process.run(['herdr', ...args], { timeoutMs: 10_000 }).catch(() => undefined)
  return response?.exitCode === 0 && !response.isStdoutTruncated ? response.stdout : undefined
}

const key = (workspace: string, tabId: string) => `${workspace}\u0000${tabId}`

async function mainsOf($: EngineInterface, home: string, panes: Pane[], labels: Map<string, string>, now: number): Promise<Main[]> {
  const live = new Map(panes.map(pane => [pane.pane, pane]))
  const root = `${home}/.local/state/imadoko`
  const workspaces = (await $.fs.list(root).catch(() => [])).filter(entry => entry.kind === 'directory')
  const candidates = await Promise.all(
    workspaces.map(async workspace =>
      Promise.all(
        (await $.fs.list(`${root}/${workspace.name}`).catch(() => []))
          .filter(entry => entry.kind === 'file' && entry.name.endsWith('.json'))
          .map(async entry => ({ pane: entry.name.slice(0, -'.json'.length), state: stateOf(await $.fs.read(`${root}/${workspace.name}/${entry.name}`).catch(() => '')) })),
      ),
    ),
  )
  const newest = new Map<string, Status & { isLead: boolean; updatedAt: number }>()
  for (const candidate of candidates.flat()) {
    const previous = newest.get(candidate.pane)
    if (candidate.state && live.has(candidate.pane) && now - candidate.state.updatedAt >= 0 && now - candidate.state.updatedAt <= FRESH_MS && (previous === undefined || previous.updatedAt < candidate.state.updatedAt)) {
      newest.set(candidate.pane, candidate.state)
    }
  }
  return [...newest].flatMap(([paneId, status]) => {
    const pane = live.get(paneId)!
    return [{ workspace: pane.workspace, pane: pane.pane, tabId: pane.tabId, mark: labels.get(key(pane.workspace, pane.tabId)) ?? '', status }]
  })
}

async function refresh($: EngineInterface) {
  const now = await $.clock.now()
  const [home, paneText, agentText] = await Promise.all([$.env.get('HOME'), herdr($, ['pane', 'list']), herdr($, ['agent', 'list'])])
  if (!home || !paneText || !agentText) return
  const panes = panesOf(paneText)
  const workspaces = [...new Set(panes.map(pane => pane.workspace))]
  const tabTexts = await Promise.all(workspaces.map(workspace => herdr($, ['tab', 'list', '--workspace', workspace])))
  const labels = new Map(tabTexts.flatMap((text, index) => text === undefined ? [] : tabsOf(text).map(tab => [key(workspaces[index]!, tab.tabId), tab.label] as const)))
  const blocked = await Promise.all(
    agentsOf(agentText)
      .filter(agent => agent.status === 'blocked')
      .flatMap(agent => {
        const pane = panes.find(item => item.pane === agent.pane && item.tabId === agent.tabId)
        return pane ? [{ agent, pane }] : []
      })
      .map(async ({ agent, pane }) => ({
        workspace: pane.workspace,
        tabId: agent.tabId,
        name: agent.name,
        label: labels.get(key(pane.workspace, agent.tabId)) ?? '',
        task: taskOf(await $.fs.read(`${home}/.local/state/herdr-team/${pane.workspace}/${agent.tabId}.json`).catch(() => '')),
      })),
  )
  const mains = await mainsOf($, home, panes, labels, now)
  await update($, board, () => cards(mains, blocked, now))
}

let poll: { cancel: () => void } | undefined

const startPolling = ($: EngineInterface) => {
  poll?.cancel()
  let busy = false
  poll = $.clock.every(POLL_MS, () => {
    if (busy) return
    busy = true
    void refresh($).finally(() => {
      busy = false
    })
  })
}

const elapsed = (ms: number | undefined) => {
  if (ms === undefined) return '—'
  if (ms < 60_000) return `${Math.floor(ms / 1000)}秒`
  if (ms < 60 * 60_000) return `${Math.floor(ms / 60_000)}分`
  return `${Math.floor(ms / (60 * 60_000))}時間`
}

export const register: Register = on => {
  on('session.start', async ($, event, next) => {
    await $.command.register({ name: 'overview', description: 'herdr の全 main をカンバンで表示する' })
    return next(event)
  })

  on('command.run', { command: 'overview' }, async $ => {
    if ((await $.env.get('HERDR_ENV')) === '1') {
      await refresh($)
      await update($, isOpen, () => true)
      startPolling($)
    }
    await $.ui.open({ id: PANE, title: 'overview', columns: 200, closeOnEscape: true })
    return { text: 'Overview pane opened.' }
  })

  on('ui.close', { id: PANE }, async ($, event, next) => {
    await update($, isOpen, () => false)
    poll?.cancel()
    poll = undefined
    return next(event)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, event) => {
    const { Box, Button, Text } = $.ui.resolve(event)
    if ((await $.env.get('HERDR_ENV')) !== '1') return <Text>herdr の中で開いてください</Text>
    const current = await read($, board)
    const columns = [
      ['reply', '要返信', 'warning'],
      ['working', '作業中', undefined],
      ['review', 'レビュー待ち', undefined],
      ['done', '完了', undefined],
    ] as const
    return (
      <Box flexDirection="row" gap={2}>
        {columns.map(([column, title, color]) => (
          <Box key={column} flexDirection="column" flexGrow={1}>
            <Text bold color={color}>{`${title} (${current[column].length})`}</Text>
            {current[column].map((card, index) => (
              <Box key={`box:${column}:${index}`} flexDirection="column">
                <Button key={`card:${column}:${index}`} plain label={card.title} onPress={() => herdr($, ['tab', 'focus', card.tabId])} />
                <Text dimColor>{`${card.workspace} · ${card.mark} · ${elapsed(card.elapsedMs)}`}</Text>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    )
  })
}
