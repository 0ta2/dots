export type Callout = 'important' | 'warning' | 'note'
export type Segment = { kind: 'markdown'; text: string } | { kind: 'heading'; level: number; text: string } | { kind: 'callout'; callout: Callout; text: string }

const CALLOUT = /^>\s*\[!(IMPORTANT|WARNING|NOTE)\]\s*$/i
const HEADING = /^(#{1,3})\s+(.+?)\s*#*\s*$/
const REPO_REF = /(?<![\w/.-])([\w.-]+\/[\w.-]+)#(\d+)\b/g
const DANGER = /(^|[\s;&|(])(rm\s+-\w*[rf]|sudo\b|git\s+(push|reset\s+--hard|clean\s+-\w*f|branch\s+-D|checkout\s+--|restore\b)|gh\s+(pr\s+merge|repo\s+delete|release\s+delete)|chezmoi\s+apply|mise\s+run\s+chezmoi:apply|brew\s+(bundle|uninstall)|kill(all)?\b|chmod\b|chown\b|dd\s+if=|truncate\b)/

export const isDangerous = (command: string): boolean => DANGER.test(command)

/** `owner/repo#123` becomes a link to it on GitHub, outside inline code. */
export const linkRefs = (text: string): string =>
  text
    .split(/(`[^`\n]*`)/)
    .map((part, index) => (index % 2 === 1 ? part : part.replace(REPO_REF, (all, repo, number) => `[${all}](https://github.com/${repo}/issues/${number})`)))
    .join('')

export const segmentsOf = (text: string): Segment[] => {
  const out: Segment[] = []
  let markdown: string[] = []
  let callout: { callout: Callout; lines: string[] } | undefined
  let isFenced = false
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
    if (/^\s*(```|~~~)/.test(line)) isFenced = !isFenced
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
