export type FileChange = { path: string; added: number | null; removed: number | null; isUntracked: boolean }

export type RepoSnapshot = { root: string; branch: string; base: string; ahead: number; mergeBase: string; files: FileChange[] }

export type Asked = { root: string; path: string }

export type Selection = { root: string; path: string; isUntracked: boolean; diff: string | null }

declare module 'claude-code' {
  interface PluginState {
    'unmerged': { repos: string[]; snapshots: RepoSnapshot[]; selected: Selection | null; isOpen: boolean; asked: Asked | null }
  }
}
