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

declare module 'claude-code' {
  interface PluginState {
    'imadoko': { 'imadoko': Imadoko; expanded: string[] }
  }
}
