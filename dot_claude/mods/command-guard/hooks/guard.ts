export type Rule = {
  name: string
  tool?: string
  field?: string
  pattern: string | string[]
  flags?: string
  scrub?: boolean
  when?: { branch?: string[] }
  exceptRepos?: string[]
  action?: 'deny' | 'ask'
}

export type Config = { vars?: Record<string, string>; rules: Rule[] }

export type Context = {
  cwd: string
  home: string
  git: (dir: string, args: string[]) => Promise<string>
}

const HEREDOC = /<<-?\s*(['"]?)([A-Za-z_]\w*)\1/g
const MESSAGE_FLAG = /(-m|--message|--body|--title|--notes|--content)(\s*=?\s*)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g
const SUBSTITUTION = /\$\((?:[^()]|\([^()]*\))*\)|`[^`]*`/g
const SHELL = /^(\S*\/)?((ba|z|da|k)?sh|eval|ssh)$/
const WRAPPER = /^(\S*\/)?(env|command|exec|nohup|time|nice|sudo|xargs)$/

function runsShell(segment: string): boolean {
  const words = segment.trim().split(/\s+/).filter(w => !/^\w+=/.test(w))
  const [first = '', ...rest] = words
  return SHELL.test(first) || (WRAPPER.test(first) && rest.some(w => SHELL.test(w)))
}

function feedsShell(cmd: string, at: number, after: number): boolean {
  const before = cmd.slice(cmd.lastIndexOf('\n', at) + 1, at).split(/[;&|(]/).pop() ?? ''
  const lineEnd = cmd.indexOf('\n', after)
  const piped = cmd.slice(after, lineEnd === -1 ? undefined : lineEnd).split('|').slice(1)
  return [before, ...piped].some(runsShell)
}

const substitutions = (s: string) =>
  (s.match(SUBSTITUTION) ?? []).map(sub => ` ; ${sub.replace(/^\$\(|^`|\)$|`$/g, '')} ; `).join('')

export function scrub(cmd: string): string {
  let out = ''
  let pos = 0
  for (const m of cmd.matchAll(HEREDOC)) {
    if (m.index < pos) continue
    const head = m.index + m[0].length
    out += cmd.slice(pos, head)
    pos = head
    if (feedsShell(cmd, m.index, head)) continue
    const end = new RegExp(`^[ \\t]*${m[2]}[ \\t]*$`, 'm').exec(cmd.slice(head))
    if (!end) continue
    if (!m[1]) out += ` ${substitutions(cmd.slice(head, head + end.index))}`
    pos = head + end.index + end[0].length
  }
  out += cmd.slice(pos)
  return out.replace(MESSAGE_FLAG, (_, flag, sep, value: string) =>
    `${flag}${sep}"${value.startsWith('"') ? substitutions(value) : ''}"`,
  )
}

const unquote = (s: string) => s.replace(/^(["'])(.*)\1$/, '$2')

const expand = (p: string, home: string) => (p === '~' ? home : p.startsWith('~/') ? home + p.slice(1) : p)

const PATH_ARG = `("[^"]+"|'[^']+'|\\S+)`

export function targetDir(cmd: string, re: RegExp, ctx: Context): string {
  const resolve = (base: string, p: string) => {
    const abs = expand(unquote(p), ctx.home)
    return abs.startsWith('/') ? abs : `${base}/${abs}`
  }
  let dir = ctx.cwd
  for (const seg of cmd.split(/&&|\|\||[;|\n]/)) {
    const cd = new RegExp(`^\\s*\\(?\\s*cd\\s+${PATH_ARG}`).exec(seg)?.[1]
    if (cd) {
      dir = resolve(dir, cd)
      continue
    }
    if (re.test(seg)) {
      const c = new RegExp(`git\\s+-C\\s+${PATH_ARG}`).exec(seg)?.[1]
      return c ? resolve(dir, c) : dir
    }
  }
  return dir
}

const toolMatches = (glob: string, tool: string) =>
  new RegExp(`^${glob.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(tool)

export function compile(config: Config): (Rule & { regexes: RegExp[] })[] {
  const vars = config.vars ?? {}
  const sub = (s: string) => s.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? '')
  return config.rules.map(r => ({
    ...r,
    regexes: [r.pattern].flat().map(p => new RegExp(sub(p), r.flags)),
  }))
}

export async function findRule(config: Config, tool: string, input: unknown, ctx: Context) {
  for (const rule of compile(config)) {
    if (!toolMatches(rule.tool ?? 'Bash', tool)) continue
    const raw = (input as Record<string, unknown> | null)?.[rule.field ?? 'command']
    if (typeof raw !== 'string') continue
    const text = rule.scrub === false ? raw : scrub(raw)
    if (!rule.regexes.every(re => re.test(text))) continue
    if (rule.when?.branch || rule.exceptRepos) {
      let dir = targetDir(raw, rule.regexes[0]!, ctx)
      let top = await ctx.git(dir, ['rev-parse', '--show-toplevel'])
      if (!top && dir !== ctx.cwd) {
        dir = ctx.cwd
        top = await ctx.git(dir, ['rev-parse', '--show-toplevel'])
      }
      if (rule.when?.branch && !rule.when.branch.includes(await ctx.git(dir, ['branch', '--show-current']))) continue
      if (rule.exceptRepos?.some(p => expand(p, ctx.home) === top)) continue
    }
    return rule
  }
  return undefined
}
