export type OverviewColumn = 'reply' | 'working' | 'review' | 'done'
export type OverviewCard = { column: OverviewColumn; title: string; workspace: string; mark: string; tabId: string; elapsedMs?: number }
export type OverviewBoard = Record<OverviewColumn, OverviewCard[]>

declare module 'claude-code' {
  interface PluginState {
    'overview': { board: OverviewBoard; isOpen: boolean }
  }
}
