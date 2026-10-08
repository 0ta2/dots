import type { Register } from 'claude-code'

import { isDangerous, linkRefs, segmentsOf, type Callout } from './segments'

const HEADING_COLORS = ['#ff9e64', '#7aa2f7', '#9ece6a'] as const
const CALLOUTS: Record<Callout, { label: string; color: string }> = {
  important: { label: '重要', color: '#f7768e' },
  warning: { label: '注意', color: '#e0af68' },
  note: { label: 'メモ', color: '#565f89' },
}
const DANGER_COLOR = '#f7768e'
const ASK_COLOR = '#e0af68'
const MINE_BACKGROUND = '#24283b'
const FORMAT = [
  '# Highlighting in replies',
  'The transcript draws these markers in color, so the user notices them:',
  '- `> [!IMPORTANT]` on its own line, the block below it quoted with `> `: the answer to what the user asked, and anything the user has to decide or do. At most one or two per reply.',
  '- `> [!WARNING]`: a risk or a side effect the user should know before acting.',
  '- `> [!NOTE]`: an aside that can be skipped.',
  '- `##` headings split a long reply into parts; a short reply needs none.',
  '- Write a pull request or issue as `owner/repo#123` so it becomes a link.',
].join('\n')

export const register: Register = on => {
  on('prompt.compose', async (_$, e, next) => {
    const composed = await next(e)
    if (e.surfaces.length === 0) return composed
    return { sections: [...composed.sections, { id: 'accent:format', text: FORMAT, scope: 'session' as const }] }
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.props.isSummary) return next(e)
    const segments = segmentsOf(e.props.text)
    const hasRefs = linkRefs(e.props.text) !== e.props.text
    if (!hasRefs && segments.every(one => one.kind === 'markdown')) return next(e)
    const { Box, Markdown, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {segments.map((one, index) =>
          one.kind === 'heading' ? (
            <Text key={`h:${index}`} bold underline={one.level === 1} color={HEADING_COLORS[one.level - 1]}>
              {`${one.level === 1 ? '■' : one.level === 2 ? '▍' : '・'} ${one.text}`}
            </Text>
          ) : one.kind === 'callout' ? (
            <Box key={`c:${index}`} flexDirection="column" borderStyle="round" borderColor={CALLOUTS[one.callout].color} paddingX={1}>
              <Text bold color={CALLOUTS[one.callout].color}>{CALLOUTS[one.callout].label}</Text>
              <Markdown text={linkRefs(one.text)} dimColor={one.callout === 'note'} />
            </Box>
          ) : (
            <Markdown key={`m:${index}`} text={linkRefs(one.text)} />
          ),
        )}
      </Box>
    )
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const command = e.props.tool === 'Bash' && typeof (e.props.input as { command?: unknown })?.command === 'string' ? (e.props.input as { command: string }).command : ''
    if (!isDangerous(command)) return next(e)
    const drawn = await next(e)
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" borderStyle="round" borderColor={DANGER_COLOR} paddingX={1}>
        <Text bold color={DANGER_COLOR}>⚠ 取り消しにくい操作</Text>
        {drawn}
      </Box>
    )
  })

  on('ui.render', { component: 'AskUserQuestion' }, async ($, e, next) => {
    const drawn = await next(e)
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" borderStyle="double" borderColor={ASK_COLOR} paddingX={1}>
        <Text bold color={ASK_COLOR}>🙋 あなたの判断待ち</Text>
        {drawn}
      </Box>
    )
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const { origin, from } = e.props
    const isMine = origin.kind === 'composer'
    const sender = from?.name ?? (origin.kind === 'channel' ? origin.server : undefined)
    // A collapsed row from someone else already names its sender in one line.
    if (!isMine && (sender === undefined || !e.props.isExpanded)) return next(e)
    const drawn = await next(e)
    const { Box, Text } = $.ui.resolve(e)

    return isMine ? (
      <Box flexDirection="column" backgroundColor={MINE_BACKGROUND}>
        {drawn}
      </Box>
    ) : (
      <Box flexDirection="column">
        <Text bold color="#7dcfff">{`📨 ${sender}`}</Text>
        {drawn}
      </Box>
    )
  })
}
