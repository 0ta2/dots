import { atom, read, update } from 'claude-code'
import type { EngineInterface, ModelCompleteResult, Register } from 'claude-code'

import {
  EMPTY,
  activityOf,
  addUsage,
  answerQuestions,
  answersOf,
  askQuestions,
  bandRows,
  completeTurn,
  fallbackSections,
  freeTextOf,
  localeFor,
  paneSections,
  parseSections,
  rebuild,
  recordActivity,
  setSections,
  statusFilePath,
  statusFileText,
  startOver,
  startTurn,
  storedImadokoOf,
  taskKeys,
  taskMeta,
  summaryRequest,
  turnKeyOf,
  underHistory,
} from './imadoko'
import type { Locale } from './imadoko'
import { SIZE, cells } from './sprite'
import {
  changes,
  cleanNote,
  freshStatus,
  isLead,
  marksOf,
  members,
  needsNote,
  notePrompt,
  assignMarks,
  EMPTY_BOOK,
  type MarkBook,
  type Tab,
  paneOf,
  parseAgents,
  parseTabs,
  parseTask,
  savedBooksOf,
  withBook,
  summary,
  teamWordsFor,
} from './team'
import type { Imadoko, MemberState, Task, TaskState, TeamMember } from '../types'

const imadoko = atom({ plugin: 'imadoko', key: 'imadoko' } as const, EMPTY)
// The tasks the person opened on the timeline, by taskKeys.
const expanded = atom({ plugin: 'imadoko', key: 'expanded' } as const, [] as string[])
// The other agents in this herdr space, shown when this session is its main tab's PM.
const team = atom({ plugin: 'imadoko', key: 'team' } as const, [] as TeamMember[])
const lead = atom({ plugin: 'imadoko', key: 'isLead' } as const, false)
// One line per member, by tab: what it is doing, from its own status file or its screen.
const notes = atom({ plugin: 'imadoko', key: 'notes' } as const, {} as Record<string, string>)
const frame = atom({ plugin: 'imadoko', key: 'frame' } as const, 0)
// Each workspace's mark book; the store keeps a copy, since a /resume empties this.
const markBooks = atom({ plugin: 'imadoko', key: 'marks' } as const, {} as Record<string, MarkBook>)
const MARKS_KEY = 'imadoko-marks'

const PANE_ID = 'imadoko'

// The color of the headings: the band's labels and the pane's section titles.
const HEADING_COLOR = '#ffa500'

// The timeline's mark and color for each state: filled for what is behind,
// ringed for the one under way, hollow and dotted for what is ahead.
const MARKS: Readonly<Record<TaskState, string>> = { done: '●', doing: '◉', next: '○', waiting: '◌' }
const STATE_COLORS: Readonly<Record<TaskState, string>> = {
  done: '#6a9955',
  doing: HEADING_COLOR,
  next: '#4fc1ff',
  waiting: '#dcdcaa',
}

// The cells the terminal's ` [-]` mark covers at the band's right edge, and
// its ` ✕` mark at the top right of a pane.
const COLLAPSE_MARK_CELLS = 4
const CLOSE_MARK_CELLS = 3

// The share of the terminal the pane asks for when docked beside the
// transcript: the engine's own share is about three quarters, a little wide
// for six short parts. A width the person dragged the dock to still wins.
const PANE_SHARE = 0.66
const PANE_MIN_COLUMNS = 40

// Both buttons answer this action, so its chord (ctrl+x b in the README's
// key bindings) opens the pane from the band and closes it from the pane: a
// pane's button wins over the band's. The engine handles the action itself
// only inside the diff panel.
const TOGGLE_ACTION = 'app:cycleDiffBase'

// How many sessions' imadoko summaries the store keeps, the newest; one is a few KB.
const STORED_SESSIONS = 200
const storeKey = (sessionId: string): string => `imadoko:${sessionId}`

// How long a /clear or an in-process /resume is watched for the session it starts.
const SESSION_POLL_MS = 500
const SESSION_POLL_TRIES = 20

/** Why a reply holds no imadoko summary, for the debug log: the engine's reason, or a reply that is not the JSON asked for. */
const whyNoImadoko = (reply: ModelCompleteResult): string => {
  if (reply.isAnswered) return 'unreadable-reply'

  return reply.reason === 'api-error' ? `api-error status=${reply.status} error=${reply.error}` : reply.reason
}

/**
 * Asks Haiku to rewrite the imadoko summary after the last turn and keeps it; when the
 * model gives nothing usable (a backend without Haiku, an error, a reply that
 * is not the JSON asked for), the answer's own first line stands in. Every
 * call counts toward the conversation's usage, saved with the imadoko summary.
 */
const summarize = async ($: EngineInterface, locale: Locale) => {
  const current = await read($, imadoko)
  const request = summaryRequest(current, locale, marksOf(await read($, team), teamWordsFor(locale.language)))
  const turn = current.turns.at(-1)
  const turnNumber = turn?.turn ?? 0
  const { epoch, sessionId } = current

  const reply = await $.model.complete({
    model: 'haiku',
    ...request,
    maxTokens: 1000,
    effort: 'low',
    timeoutMs: 30_000,
  })
  const written = reply.isAnswered ? parseSections(reply.text) : undefined
  if (written === undefined) $.ui.log(`imadoko: Haiku gave no imadoko: ${whyNoImadoko(reply)}`, { to: 'debug' })
  const sections = written ?? fallbackSections(current, turn, locale.words)

  // A /clear or /resume while the model answered started another conversation,
  // and a later turn's imadoko summary may have landed first. A call whose imadoko summary is not
  // kept still counts; the next imadoko summary saved carries it.
  let applied: Imadoko | undefined
  await update($, imadoko, latest => {
    if (latest.epoch !== epoch) return latest

    const counted = addUsage(latest, reply.usage)
    if (sections === undefined || turnNumber < latest.sectionsTurn) return counted
    applied = setSections(counted, sections, turnNumber)

    return applied
  })
  if (applied === undefined || sections === undefined) return
  const savedAt = await $.clock.now()
  if (sessionId !== null) {
    await $.store.set(storeKey(sessionId), {
      sections,
      turnKey: turnKeyOf(current),
      savedAt,
      usage: applied.usage,
    })
  }
  const path = statusFilePath(await $.env.get('HOME'), await $.env.get('HERDR_WORKSPACE_ID'), await $.env.get('HERDR_PANE_ID'))
  if (path !== undefined) {
    await $.fs.write(path, statusFileText(sections, savedAt)).catch((error: unknown) => {
      $.ui.log(`imadoko: could not write ${path}: ${String(error)}`, { to: 'debug' })
    })
  }
}

// One summary at a time: each starts from the one before it, so a turn that
// ends while Haiku still answers for the last is not summarized without it.
// A summary not yet started reads the conversation when it starts, so one
// waiting covers every turn that ends meanwhile.
let summaries: Promise<void> = Promise.resolve()
let isQueued = false

/**
 * Starts the summary on a timer: it runs outside the dispatch that asked, so
 * no turn is held up by the model call and the call is not cut short when
 * that dispatch ends.
 */
const summarizeLater = ($: EngineInterface, locale: Locale) => {
  $.clock.after(0, () => {
    if (isQueued) return
    isQueued = true
    summaries = summaries
      .then(() => {
        isQueued = false

        return summarize($, locale)
      })
      .catch((error: unknown) => $.ui.log(`imadoko: summary failed: ${String(error)}`, { to: 'debug' }))
  })
}

/**
 * Opens the conversation the session now holds: reads it back, and shows the
 * imadoko summary the store kept for it when nothing has happened since; otherwise
 * analyzes it now, when there is anything to analyze. A turn begun after a
 * /clear or /resume, before the new session was known, stays after the
 * history the session already held.
 */
const openSession = async ($: EngineInterface, locale: Locale) => {
  const { epoch } = await read($, imadoko)
  const sessionId = await $.session.id()
  const rebuilt = rebuild(await $.session.messages())
  const stored = storedImadokoOf(await $.store.get(storeKey(sessionId)))
  const isUpToDate = stored !== undefined && stored.turnKey === turnKeyOf(rebuilt)

  let isApplied = false
  let isJoined = false
  let shouldSummarize = false
  await update($, imadoko, current => {
    // A /clear or /resume while this loaded started another conversation; its own poll opens it.
    if (current.epoch !== epoch) return current
    isApplied = true
    if (current.sessionId === null && current.turns.length > 0) {
      const known = { ...current, sessionId }
      const joined = underHistory(known, rebuilt, stored)
      const usage = stored?.usage ?? EMPTY.usage
      isJoined = true
      shouldSummarize = joined !== known && !joined.isWorking

      return {
        ...joined,
        usage: {
          calls: joined.usage.calls + usage.calls,
          inputTokens: joined.usage.inputTokens + usage.inputTokens,
          outputTokens: joined.usage.outputTokens + usage.outputTokens,
        },
      }
    }

    return {
      ...rebuilt,
      sessionId,
      epoch: current.epoch,
      // The calls counted so far go on, whether or not the imadoko summary is up to date.
      ...(stored === undefined ? {} : { usage: stored.usage }),
      ...(isUpToDate ? { sections: stored.sections, sectionsTurn: rebuilt.turns.at(-1)?.turn ?? 0 } : {}),
    }
  })
  if (!isApplied) return
  if (isJoined ? shouldSummarize : !isUpToDate && (rebuilt.turns.length > 0 || rebuilt.background !== null)) {
    summarizeLater($, locale)
  }
}

/**
 * After a /clear or an in-process /resume no session.start comes, and the
 * session that follows is not there yet when the old one ends: watch for the
 * id to change, then open that session.
 */
const followNextSession = ($: EngineInterface, endedId: string, locale: Locale) => {
  let tries = 0
  let isOpening = false
  const timer = $.clock.every(SESSION_POLL_MS, () => {
    if (isOpening) return
    tries += 1
    isOpening = true
    $.session
      .id()
      .then(async sessionId => {
        if (sessionId === endedId) return
        if ((await read($, imadoko)).sessionId === null) await openSession($, locale)
        timer.cancel()
      })
      .catch((error: unknown) => $.ui.log(`imadoko: following the session failed: ${String(error)}`, { to: 'debug' }))
      .finally(() => {
        isOpening = false
        if (tries >= SESSION_POLL_TRIES) timer.cancel()
      })
  })
}

// How often the team is read from herdr while this session leads it, and how
// often a session that does not checks whether it has become the lead.
const TEAM_POLL_MS = 3000
const LEAD_CHECK_MS = 30_000
const FRAME_MS = 600

// `workspace` is the one this process started in, which herdr-delegate and
// herdr-review also key their task records by; `space` is where the pane is
// now, which a pane move changes while the environment keeps the old one.
type Where = { workspace: string; space: string; pane: string; home: string }

const whereAmI = async ($: EngineInterface): Promise<Where | undefined> => {
  const [workspace, pane, home] = await Promise.all([$.env.get('HERDR_WORKSPACE_ID'), $.env.get('HERDR_PANE_ID'), $.env.get('HOME')])
  return workspace && pane && home ? { workspace, space: workspace, pane, home } : undefined
}

const herdr = async ($: EngineInterface, args: string[]) => {
  const r = await $.process.run(['herdr', ...args], { timeoutMs: 10_000 }).catch(() => undefined)
  return r?.exitCode === 0 && !r.isStdoutTruncated ? r.stdout : undefined
}

/** The one-line tasks herdr-delegate and herdr-review left for the tabs open now. */
const taskRecords = async ($: EngineInterface, at: Where, tabs: Tab[]): Promise<Record<string, string>> => {
  // A PM whose pane moved still writes under the workspace it started in, and
  // a PM started here writes under this one; the record for where the tab is now wins.
  const dirs = [...new Set([at.space, at.workspace])].map(ws => `${at.home}/.local/state/herdr-team/${ws}`)
  const pairs = await Promise.all(
    tabs.map(async t => {
      for (const dir of dirs) {
        const task = parseTask(await $.fs.read(`${dir}/${t.tabId}.json`).catch(() => ''))
        if (task !== undefined) return [t.tabId, task] as const
      }
      return [t.tabId, undefined] as const
    }),
  )
  return Object.fromEntries(pairs.filter((p): p is readonly [string, string] => p[1] !== undefined))
}

/** This workspace's mark book: the session's own, else the one the store kept. */
const bookFor = async ($: EngineInterface, space: string): Promise<MarkBook> =>
  (await read($, markBooks))[space] ?? savedBooksOf(await $.store.get(MARKS_KEY))[space]?.book ?? EMPTY_BOOK

const keepBook = async ($: EngineInterface, space: string, book: MarkBook, was: MarkBook) => {
  await update($, markBooks, all => ({ ...all, [space]: book }))
  if (JSON.stringify(book) === JSON.stringify(was)) return
  await $.store.set(MARKS_KEY, withBook(savedBooksOf(await $.store.get(MARKS_KEY)), space, book, await $.clock.now()))
}

let seen = new Map<string, MemberState>()
const notedAt = new Map<string, number>()
// When each member's state last changed; a status file older than that tells of the state before.
const changedAt = new Map<string, number>()
const noting = new Set<string>()
let lastLeadCheck = -Infinity

// Each state change a member's line must follow bumps its generation; a
// summary that comes back after a newer one was asked for is dropped, and the
// member is read again for the state it is in now.
const generations = new Map<string, number>()
const again = new Set<string>()

/** Reads a member's screen and has Haiku say in one line what it is doing. */
const noteFromScreen = async ($: EngineInterface, tabId: string, language: string): Promise<void> => {
  if (noting.has(tabId)) {
    again.add(tabId)
    return
  }
  noting.add(tabId)
  const generation = generations.get(tabId) ?? 0
  try {
    const m = (await read($, team)).find(one => one.tabId === tabId)
    if (m?.paneId === undefined) return
    const screen = await herdr($, ['pane', 'read', m.paneId])
    if (!screen?.trim()) return
    const reply = await $.model.complete({ model: 'haiku', ...notePrompt(m, screen, language), maxTokens: 100, effort: 'low', timeoutMs: 30_000 })
    const line = reply.isAnswered ? cleanNote(reply.text) : undefined
    if (line !== undefined && generations.get(tabId) === generation) await update($, notes, now => ({ ...now, [tabId]: line }))
  } finally {
    noting.delete(tabId)
  }
  if (again.delete(tabId)) await noteFromScreen($, tabId, language)
}

/**
 * Brings each member's line up to date: a member whose own imadoko wrote its
 * status lately is read from that file; any other is read off its screen when
 * its state changed, and every so often while it works.
 */
const noteMembers = async ($: EngineInterface, at: Where, before: Map<string, MemberState>, list: TeamMember[], language: string) => {
  const now = await $.clock.now()
  for (const m of list) {
    const was = before.get(m.tabId)
    if (was !== undefined && was !== m.status) changedAt.set(m.tabId, now)
  }
  const own = await Promise.all(
    list.map(async m => {
      if (m.paneId === undefined) return undefined
      const file = freshStatus(await $.fs.read(`${at.home}/.local/state/imadoko/${at.space}/${m.paneId}.json`).catch(() => ''), now)
      return file !== undefined && file.savedAt >= (changedAt.get(m.tabId) ?? -Infinity) ? file : undefined
    }),
  )
  const alive = new Set(list.map(m => m.tabId))
  await update($, notes, all => ({
    ...Object.fromEntries(Object.entries(all).filter(([tab]) => alive.has(tab))),
    ...Object.fromEntries(
      list.flatMap((m, i) => {
        const line = own[i] === undefined ? undefined : cleanNote(own[i]!.status)
        return line === undefined ? [] : [[m.tabId, line]]
      }),
    ),
  }))
  list.forEach((m, i) => {
    if (own[i] === undefined) return
    again.delete(m.tabId)
    generations.set(m.tabId, (generations.get(m.tabId) ?? 0) + 1)
  })
  const due = list.filter((m, i) => own[i] === undefined && needsNote(before.get(m.tabId), m, notedAt.get(m.tabId), now))
  for (const m of due) {
    notedAt.set(m.tabId, now)
    generations.set(m.tabId, (generations.get(m.tabId) ?? 0) + 1)
  }
  void Promise.all(due.map(m => noteFromScreen($, m.tabId, language).catch(() => undefined)))
}

const clearTeam = async ($: EngineInterface) => {
  seen = new Map()
  notedAt.clear()
  changedAt.clear()
  await update($, lead, () => false)
  await update($, team, () => [])
  $.ui.status(undefined)
}

/** Reads the space from herdr; only the PM in the main tab keeps a team. */
const refreshTeam = async ($: EngineInterface, language: string) => {
  const isLeading = await read($, lead)
  const now = await $.clock.now()
  if (!isLeading && now - lastLeadCheck < LEAD_CHECK_MS) return
  lastLeadCheck = now
  const started = await whereAmI($)
  if (started === undefined) return
  const here = paneOf((await herdr($, ['pane', 'get', started.pane])) ?? '')
  const at = { ...started, space: here.workspaceId ?? started.workspace }
  const [tabsOut, agentsOut] = await Promise.all([herdr($, ['tab', 'list', '--workspace', at.space]), herdr($, ['agent', 'list'])])
  if (tabsOut === undefined || agentsOut === undefined) return
  const tabs = parseTabs(tabsOut)
  const agents = parseAgents(agentsOut)
  const selfTab = here.tabId ?? agents.find(a => a.paneId === at.pane)?.tabId
  if (!isLead(tabs, selfTab)) {
    if (isLeading) await clearTeam($)
    return
  }
  const words = teamWordsFor(language)
  const book = await bookFor($, at.space)
  const marked = assignMarks(members(tabs, agents, await taskRecords($, at, tabs), selfTab), book)
  const list = marked.list
  await keepBook($, at.space, marked.book, book)
  for (const line of changes(seen, list, words)) $.ui.toast(line, { timeoutMs: 6000 })
  const before = seen
  seen = new Map(list.map(m => [m.tabId, m.status]))
  await update($, lead, () => true)
  await update($, team, () => list)
  await noteMembers($, at, before, list, language)
  $.ui.status(summary(list, words))
}

let teamPoll: { cancel: () => void } | undefined
let animation: { cancel: () => void } | undefined

const watchTeam = ($: EngineInterface, language: string) => {
  teamPoll?.cancel()
  animation?.cancel()
  lastLeadCheck = -Infinity
  let isBusy = false
  const tick = () => {
    if (isBusy) return
    isBusy = true
    void refreshTeam($, language)
      .catch((error: unknown) => $.ui.log(`imadoko: reading the team failed: ${String(error)}`, { to: 'debug' }))
      .finally(() => {
        isBusy = false
      })
  }
  teamPoll = $.clock.every(TEAM_POLL_MS, tick)
  animation = $.clock.every(FRAME_MS, () => {
    void read($, lead).then(isLeading => (isLeading ? update($, frame, n => (n + 1) % 1000) : undefined))
  })
  tick()
}

/** Opens a task's detail on the timeline, or closes it when it is open. */
const toggle = ($: EngineInterface, key: string) =>
  update($, expanded, keys => (keys.includes(key) ? keys.filter(one => one !== key) : [...keys, key]))

/** Keeps the newest imadoko summaries in the store; the oldest go first. */
const pruneStore = async ($: EngineInterface) => {
  const keys = (await $.store.keys()).filter(key => key.startsWith('imadoko:'))
  if (keys.length <= STORED_SESSIONS) return

  const saved = await Promise.all(
    keys.map(async key => ({ key, savedAt: storedImadokoOf(await $.store.get(key))?.savedAt ?? 0 })),
  )
  const oldest = saved.sort((a, b) => a.savedAt - b.savedAt).slice(0, keys.length - STORED_SESSIONS)
  await Promise.all(oldest.map(one => $.store.delete(one.key)))
}

export const register: Register = on => {
  // Set by session.start, which fires again on every reload of this module.
  let isInteractive = false
  let locale = localeFor(undefined)
  const pane = (terminalColumns: number) =>
    ({
      id: PANE_ID,
      title: locale.words.title,
      focus: true,
      closeOnEscape: true,
      columns: Math.max(PANE_MIN_COLUMNS, Math.round(terminalColumns * PANE_SHARE)),
    }) as const

  on('session.start', async ($, e, next) => {
    isInteractive = e.isInteractive
    if (!isInteractive) return next(e)

    locale = localeFor((await $.settings.read()).language)
    // Command registration can be refused; the pane must still open from its button.
    try {
      await $.command.register({ name: 'imadoko', description: locale.words.command, immediate: true })
    } catch (error: unknown) {
      $.ui.log(`imadoko: /imadoko was not registered: ${String(error)}`, { to: 'debug' })
    }

    // No session id yet means the mod meets this conversation for the first
    // time: a resumed session, one that ran before the mod was installed, or a
    // new one. A reload of this module finds its state kept, and analyzes it
    // only when no imadoko summary was written yet.
    const current = await read($, imadoko)
    if (current.sessionId === null) await openSession($, locale)
    else if (current.sections === null && (current.turns.length > 0 || current.background !== null)) {
      summarizeLater($, locale)
    }
    await pruneStore($)
    if ((await $.env.get('HERDR_ENV')) === '1') watchTeam($, locale.language)

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    // A /clear starts a new conversation and an in-process /resume moves to
    // another one; neither raises session.start again, so start over here.
    if (isInteractive && (e.reason === 'clear' || e.reason === 'resume')) {
      await update($, imadoko, startOver)
      followNextSession($, e.sessionId, locale)
    }

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (isInteractive) await update($, imadoko, current => startTurn(current, e.text))

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (isInteractive && e.agentId === undefined) {
      await update($, imadoko, current => completeTurn(current, e.answer))
      summarizeLater($, locale)
    }

    return next(e)
  })

  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    if (!isInteractive) return next(e)

    await update($, imadoko, current =>
      askQuestions(
        current,
        e.questions.map(one => ({ header: one.header, question: one.question })),
      ),
    )
    const ran = await next(e)
    const answered = ran.deny === undefined && ran.isError !== true ? ran.result : undefined
    await update($, imadoko, current => answerQuestions(current, answersOf(answered), freeTextOf(answered)))

    return ran
  })

  on('tool.call', async ($, e, next) => {
    const line = isInteractive && e.agentId === undefined ? activityOf(String(e.tool), e) : undefined
    const ran = await next(e)
    if (line !== undefined && ran.deny === undefined && ran.isError !== true) {
      await update($, imadoko, current => recordActivity(current, line))
    }

    return ran
  })

  on('command.run', { command: 'imadoko' }, async ($, e) => {
    await $.ui.open(pane(e.presentation.columns))

    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const current = await read($, imadoko)
    const opened = await read($, expanded)
    const tasks: readonly Task[] = current.sections?.tasks ?? []
    const keys = taskKeys(tasks)
    const elements = $.ui.resolve(e)
    const { Box, Button, Text } = elements
    const mates = (await read($, lead)) ? await read($, team) : []
    const said = await read($, notes)
    const tick = mates.length > 0 ? await read($, frame) : 0
    const tw = teamWordsFor(locale.language)

    return (
      <Box flexDirection="column">
        {/* The engine draws the pane's close mark over its top right cells. */}
        <Box justifyContent="flex-end" marginRight={CLOSE_MARK_CELLS}>
          <Button
            key="close"
            label={locale.words.close}
            action={TOGGLE_ACTION}
            plain
            dimColor
            onPress={() => $.ui.close({ id: PANE_ID })}
          />
        </Box>
        {[
          { title: locale.words.purpose, rows: [current.sections?.purpose ?? locale.words.notYet] },
          { title: locale.words.status, rows: [current.sections?.status ?? locale.words.notYet] },
        ].map(section => (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold color={HEADING_COLOR} wrap="wrap">
              {section.title}
            </Text>
            {section.rows.map(row => (
              <Text wrap="wrap">{row}</Text>
            ))}
          </Box>
        ))}
        {mates.length === 0 ? null : (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold color={HEADING_COLOR} wrap="wrap">
              {tw.members}
            </Text>
            {mates.map(m => (
              <Box key={`member:${m.tabId}`} flexDirection="row" gap={1}>
                {'Raster' in elements ? (
                  <elements.Raster key={`sprite:${m.tabId}`} columns={SIZE} rows={SIZE / 2} cells={cells(m.role, m.status, tick, m.kind)} />
                ) : null}
                <Box flexDirection="column" flexShrink={1}>
                  <Text bold wrap="truncate-end">
                    {[m.mark, tw.roles[m.role], m.kind].filter(Boolean).join(' · ')}
                  </Text>
                  <Text wrap="truncate-end">{`${tw.states[m.status]}${said[m.tabId] ? ` · ${said[m.tabId]}` : ''}`}</Text>
                  <Text dimColor wrap="truncate-end">
                    {m.task ?? m.label}
                  </Text>
                </Box>
              </Box>
            ))}
          </Box>
        )}
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={HEADING_COLOR} wrap="wrap">
            {locale.words.tasks}
          </Text>
          {tasks.length === 0 ? <Text wrap="wrap">{locale.words.none}</Text> : null}
          {tasks.map((task, index) => {
            const key = keys[index] ?? ''
            const isOpen = opened.includes(key)
            const after = tasks[index + 1]
            const rail = after === undefined ? ' ' : after.state === 'done' || after.state === 'doing' ? '│' : '┆'
            const owner = mates.find(m => m.mark !== '' && m.mark === task.owner)
            const meta = [taskMeta(task, locale.words), owner === undefined ? '' : tw.states[owner.status]].filter(one => one !== '').join(' · ')
            const below = [...(meta === '' ? [] : [meta]), ...(isOpen && task.detail !== '' ? [task.detail] : [])]

            return (
              <Box flexDirection="column">
                <Box key={`line:${key}`} flexDirection="row">
                  <Box flexShrink={0}>
                    <Text color={STATE_COLORS[task.state]} bold={task.state === 'doing'} dimColor={task.state === 'done'}>
                      {`${MARKS[task.state]} ${locale.words.states[task.state]}  `}
                    </Text>
                  </Box>
                  <Button
                    key={`task:${key}`}
                    label={`${task.title} ${isOpen ? '▾' : '▸'}`}
                    plain
                    dimColor={task.state === 'done'}
                    onPress={() => toggle($, key)}
                  />
                </Box>
                {below.map((line, row) => (
                  <Box key={`line:${key}:${row}`} flexDirection="row">
                    <Box flexShrink={0}>
                      <Text dimColor>{`${rail}    `}</Text>
                    </Box>
                    <Text dimColor={row === 0 && meta !== ''} wrap="wrap">
                      {line}
                    </Text>
                  </Box>
                ))}
                {after === undefined ? null : <Text dimColor>{rail}</Text>}
              </Box>
            )
          })}
        </Box>
        {paneSections(current, locale.words).map(section => (
          <Box flexDirection="column" marginBottom={1}>
            <Text bold color={HEADING_COLOR} wrap="wrap">
              {section.title}
            </Text>
            {section.rows.map(row => (
              <Text wrap="wrap">{row}</Text>
            ))}
          </Box>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, imadoko)
    const isEmpty = current.turns.length === 0 && current.sections === null
    if (!isInteractive || e.props.hasSurvey || isEmpty) return next(e)
    // The pane holds the same purpose and status; a band beside a docked pane
    // would only repeat them in a narrow column, many rows tall.
    if ((await $.ui.panes()).some(one => one.id === PANE_ID && one.isShown)) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {/* A titled rule opens the band, so it reads apart from the spinner
            above it; the prompt's own rule closes it below. */}
        <Box>
          <Box flexShrink={0}>
            <Text dimColor wrap="truncate-end">{`── ${locale.words.title} `}</Text>
          </Box>
          {/* A rule as wide as the band, of which this box keeps the one row
              that fits beside the title and the button. */}
          <Box flexGrow={1} flexShrink={1} height={1} overflow="hidden">
            <Text dimColor wrap="wrap">
              {'─'.repeat(e.props.bodyColumns)}
            </Text>
          </Box>
          {/* The engine draws its collapse mark over the band's last cells. */}
          <Box flexShrink={0} marginLeft={1} marginRight={COLLAPSE_MARK_CELLS}>
            <Button
              key="open"
              label={locale.words.details}
              action={TOGGLE_ACTION}
              plain
              dimColor
              onPress={() => $.ui.open(pane(e.props.bodyColumns))}
            />
          </Box>
        </Box>
        {bandRows(current, locale.words).map(row => (
          <Text wrap="wrap">
            <Text color={HEADING_COLOR}>{`${row.label}:`}</Text>
            {` ${row.text}`}
          </Text>
        ))}
      </Box>
    )
  })
}
