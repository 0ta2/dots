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
  startOver,
  startTurn,
  storedImadokoOf,
  taskKey,
  taskMeta,
  summaryRequest,
  turnKeyOf,
  underHistory,
} from './imadoko'
import type { Locale } from './imadoko'
import type { Imadoko, Task, TaskState } from '../types'

const imadoko = atom({ plugin: 'imadoko', key: 'imadoko' } as const, EMPTY)
// The tasks the person opened on the timeline, by taskKey.
const expanded = atom({ plugin: 'imadoko', key: 'expanded' } as const, [] as string[])

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
  const request = summaryRequest(current, locale)
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
  if (applied !== undefined && sections !== undefined && sessionId !== null) {
    await $.store.set(storeKey(sessionId), {
      sections,
      turnKey: turnKeyOf(current),
      savedAt: await $.clock.now(),
      usage: applied.usage,
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
  const timer = $.clock.every(SESSION_POLL_MS, () => {
    tries += 1
    $.session
      .id()
      .then(async sessionId => {
        if (sessionId === endedId) {
          if (tries >= SESSION_POLL_TRIES) timer.cancel()

          return
        }
        timer.cancel()
        if ((await read($, imadoko)).sessionId === null) await openSession($, locale)
      })
      .catch((error: unknown) => $.ui.log(`imadoko: following the session failed: ${String(error)}`, { to: 'debug' }))
  })
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
    if (line !== undefined) await update($, imadoko, current => recordActivity(current, line))

    return next(e)
  })

  on('command.run', { command: 'imadoko' }, async ($, e) => {
    await $.ui.open(pane(e.presentation.columns))

    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const current = await read($, imadoko)
    const opened = await read($, expanded)
    const tasks: readonly Task[] = current.sections?.tasks ?? []
    const { Box, Button, Text } = $.ui.resolve(e)

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
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={HEADING_COLOR} wrap="wrap">
            {locale.words.tasks}
          </Text>
          {tasks.length === 0 ? <Text wrap="wrap">{locale.words.none}</Text> : null}
          {tasks.map((task, index) => {
            const key = taskKey(task)
            const isOpen = opened.includes(key)
            const after = tasks[index + 1]
            const rail = after === undefined ? ' ' : after.state === 'done' || after.state === 'doing' ? '│' : '┆'
            const meta = taskMeta(task, locale.words)
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
