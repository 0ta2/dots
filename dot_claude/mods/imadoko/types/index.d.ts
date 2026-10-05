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

/** The imadoko summary Haiku keeps of the session, rewritten after every turn. */
export type Sections = {
  purpose: string
  status: string
  done: string[]
  decisions: string[]
  pending: string[]
  next: string
  upcoming: string[]
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
   * A fingerprint of the last turn's request and answer the imadoko summary was written
   * after; a different one means the session moved on. It leaves out the turn
   * number, which a compaction starts over.
   */
  turnKey: string
  savedAt: number
  /** Zero for an imadoko summary saved before the mod counted its calls. */
  usage: Usage
}

declare module 'claude-code' {
  interface PluginState {
    'imadoko': { 'imadoko': Imadoko }
  }
}
