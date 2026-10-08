export type Callout = 'important' | 'warning' | 'note'
export type Segment = { kind: 'markdown'; text: string } | { kind: 'heading'; level: number; text: string } | { kind: 'callout'; callout: Callout; text: string }

const CALLOUT = /^>\s*\[!(IMPORTANT|WARNING|NOTE)\]\s*$/i
const HEADING = /^(#{1,3})\s+(.+?)(?:\s+#+)?\s*$/
const REPO_REF = /(?<![\w/.-])([\w.-]+\/[\w.-]+)#(\d+)\b/g
const DANGER = /(^|[\s;&|(])(rm\s+-\w*[rf]|sudo\b|git\s+(push|reset\s+--hard|clean\s+-\w*f|branch\s+-D|checkout\s+--|restore\b)|gh\s+(pr\s+merge|repo\s+delete|release\s+delete)|chezmoi\s+apply|mise\s+run\s+chezmoi:apply|brew\s+(bundle|uninstall)|kill(all)?\b|chmod\b|chown\b|dd\s+if=|truncate\b)/

export const isDangerous = (command: string): boolean => DANGER.test(command)

const CODE_SPAN = /(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g
const link = (text: string) => text.replace(REPO_REF, (all, repo, number) => `[${all}](https://github.com/${repo}/issues/${number})`)

const fenceOf = (line: string): string | undefined => /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
/** Whether `line` closes a block opened by `fence`: the same character, at least as many, nothing after. */
const closes = (line: string, fence: string): boolean => {
  const marker = fenceOf(line)
  return marker !== undefined && marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker
}

const linkOutsideSpans = (text: string): string => {
  let out = ''
  let last = 0
  for (const span of text.matchAll(CODE_SPAN)) {
    out += link(text.slice(last, span.index)) + span[0]
    last = span.index + span[0].length
  }
  return out + link(text.slice(last))
}

/** `owner/repo#123` becomes a link to it on GitHub, outside fenced blocks and inline code of any backtick count. */
export const linkRefs = (text: string): string => {
  const out: string[] = []
  let prose: string[] = []
  let fence: string | undefined
  const flush = () => {
    if (prose.length > 0) out.push(linkOutsideSpans(prose.join('\n')))
    prose = []
  }
  for (const line of text.split('\n')) {
    if (fence !== undefined) {
      out.push(line)
      if (closes(line, fence)) fence = undefined
    } else if (fenceOf(line) !== undefined) {
      flush()
      fence = fenceOf(line)
      out.push(line)
    } else {
      prose.push(line)
    }
  }
  flush()
  return out.join('\n')
}

export const segmentsOf = (text: string): Segment[] => {
  const out: Segment[] = []
  let markdown: string[] = []
  let callout: { callout: Callout; lines: string[] } | undefined
  let fence: string | undefined
  const flush = () => {
    if (markdown.join('').trim()) out.push({ kind: 'markdown', text: markdown.join('\n') })
    markdown = []
  }
  const close = () => {
    if (callout) out.push({ kind: 'callout', callout: callout.callout, text: callout.lines.join('\n') })
    callout = undefined
  }

  for (const line of text.split('\n')) {
    if (callout && line.startsWith('>') && !CALLOUT.test(line)) {
      callout.lines.push(line.replace(/^>\s?/, ''))
      continue
    }
    close()
    const marker = fenceOf(line)
    const isFenced = fence !== undefined || marker !== undefined
    if (fence === undefined) fence = marker
    else if (closes(line, fence)) fence = undefined
    const heading = isFenced ? null : HEADING.exec(line)
    const opened = isFenced ? null : CALLOUT.exec(line)
    if (opened) {
      flush()
      callout = { callout: opened[1]!.toLowerCase() as Callout, lines: [] }
    } else if (heading) {
      flush()
      out.push({ kind: 'heading', level: heading[1]!.length, text: heading[2]! })
    } else {
      markdown.push(line)
    }
  }
  close()
  flush()
  return out
}
