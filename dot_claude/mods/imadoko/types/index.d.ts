export type PullRef = { owner: string; repo: string; number: number }
export type Merge = 'clean' | 'conflict' | 'blocked' | 'unknown'
export type Checks = 'pass' | 'fail' | 'pending'
export type PullView = { title: string; url: string; state: string; merge: Merge; checks?: Checks }

export type Question = { header: string; question: string }

export type QuestionAnswer = Question & {
  turn: number
  /** null while the question waits; '' when it was dismissed unanswered. */
  answer: string | null
}

export type TurnEntry = {
  turn: number
  /** null for a turn that began with no request (a continuation). */
  ask: string | null
  answer: string | null
  /** What the turn did with its tools, one line each (`Bash: Push the commits`). */
  activity: string[]
}

/** Where a task stands: finished, under way now, the one after it, or later on someone or something. */
export type TaskState = 'done' | 'doing' | 'next' | 'waiting'

/** One stop on the session's timeline. */
export type Task = {
  title: string
  state: TaskState
  /** One or two sentences: what it is and where it stands. */
  detail: string
  /** Who has it when this session does not: another Claude Code or Codex session, a herdr pane; '' otherwise. */
  owner: string
  /** What it waits on: a pull request merging, a review, a reply; '' when nothing. */
  waitsOn: string
  /** Who it waits for: the user, others, or neither. */
  waitsFor: 'you' | 'others' | ''
}

/** The imadoko summary Haiku keeps of the session, rewritten after every turn. */
export type Sections = {
  purpose: string
  status: string
  /** Oldest first: the newest done ones, the one under way, then what comes after. */
  tasks: Task[]
  decisions: string[]
  pending: string[]
}

/** The Haiku calls a session's imadoko summary took: how many, and the tokens they read and wrote. */
export type Usage = {
  calls: number
  inputTokens: number
  outputTokens: number
}

export type Imadoko = {
  turns: TurnEntry[]
  questions: QuestionAnswer[]
  sections: Sections | null
  /** The turn the sections were written after; an older reply never replaces them. */
  sectionsTurn: number
  /** What a compaction kept of the turns before it, read back on a resume. */
  background: string | null
  isWorking: boolean
  /** The session the imadoko summary is of; null until the mod has opened the conversation. */
  sessionId: string | null
  /** Counts the conversations this process has held; a /clear or /resume moves it on. */
  epoch: number
  /** The calls made for this conversation, saved with its imadoko summary. */
  usage: Usage
}

/** What the store keeps of a session's imadoko summary, under `imadoko:<session id>`. */
export type StoredImadoko = {
  sections: Sections
  /**
   * A fingerprint of the last turn's request, answer and transcript position
   * the imadoko summary was written after; a different one means the session
   * moved on.
   */
  turnKey: string
  savedAt: number
  /** Zero for an imadoko summary saved before the mod counted its calls. */
  usage: Usage
}

/** A member's part in the team, read off its herdr tab label. */
export type Role = 'impl' | 'review' | 'member'

/** Where a member stands as herdr reports it; absent when its tab has no agent. */
export type MemberState = 'working' | 'blocked' | 'idle' | 'done' | 'unknown' | 'absent'

/** Another agent in this herdr space, as the main tab's team view shows it. */
export type TeamMember = {
  tabId: string
  paneId?: string
  label: string
  role: Role
  kind?: string
  status: MemberState
  task?: string
  /** The short mark (I1, R1) the summary's task owners name the member by; '' past nine of a role. */
  mark: string
}

declare module 'claude-code' {
  interface PluginState {
    'imadoko': { 'imadoko': Imadoko; expanded: string[]; folded: string[]; team: TeamMember[]; frame: number; notes: Record<string, string>; isLead: boolean; marks: Record<string, { marks: Record<string, string>; next: Partial<Record<Role, number>> }>; pulls: PullRef[]; pullViews: Record<string, PullView & { unresolved?: number } | 'unreadable'> }
  }
}
