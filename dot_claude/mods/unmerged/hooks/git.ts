import type { FileChange, RepoSnapshot } from '../types'

export type Git = (dir: string, args: string[]) => Promise<string | undefined>

const PATH_ARG = `("[^"]+"|'[^']+'|[^\\s;&|)]+)`

export function dirsInCommand(cmd: string, cwd: string, home: string): string[] {
  const bases = [cwd]
  const dirs: string[] = []
  const resolve = (arg: string) => {
    const p = arg.replace(/^(["'])(.*)\1$/, '$2').replace(/^~(?=\/|$)/, home)
    return p.startsWith('/') ? [p] : bases.map(b => `${b}/${p}`)
  }
  for (const segment of cmd.split(/&&|\|\||[;|\n]/)) {
    const cd = new RegExp(`^\\s*\\(*\\s*cd\\s+${PATH_ARG}`).exec(segment)?.[1]
    if (cd) bases.push(...resolve(cd))
    for (const m of segment.matchAll(new RegExp(`(?:^|\\s)(?:-C\\s+|--cwd[\\s=]+)${PATH_ARG}`, 'g'))) dirs.push(...resolve(m[1]!))
  }
  return [...new Set([...bases.slice(1), ...dirs])]
}

export function parseNumstat(out: string, statuses = new Map<string, string>()): FileChange[] {
  return out
    .split('\0')
    .filter(Boolean)
    .map(record => {
      const [added, removed, ...rest] = record.split('\t')
      const path = rest.join('\t')
      return {
        path,
        status: statuses.get(path) ?? 'M',
        added: added === '-' ? null : Number(added),
        removed: removed === '-' ? null : Number(removed),
        isUntracked: false,
      }
    })
}

export function parseNameStatus(out: string): Map<string, string> {
  const fields = out.split('\0')
  const statuses = new Map<string, string>()
  for (let i = 0; i + 1 < fields.length; i += 2) {
    if (fields[i]) statuses.set(fields[i + 1]!, fields[i]![0]!)
  }
  return statuses
}

export function fitHunks(diff: string, limit: number): { source: string; isCut: boolean } | undefined {
  const at = diff.search(/^@@ /m)
  if (at === -1) return undefined
  let source = ''
  const hunks = diff.slice(at).split(/(?=^@@ )/m)
  for (const hunk of hunks) {
    if (source.length + hunk.length > limit) break
    source += hunk
  }
  return { source, isCut: source.length < diff.length - at }
}

async function baseRef(git: Git, root: string): Promise<string | undefined> {
  const origin = (await git(root, ['rev-parse', '--abbrev-ref', 'origin/HEAD']))?.trim()
  if (origin) return origin
  for (const name of ['main', 'master']) {
    if (await git(root, ['rev-parse', '--verify', '--quiet', name])) return name
  }
  return undefined
}

export async function snapshot(git: Git, root: string): Promise<RepoSnapshot | undefined> {
  const base = await baseRef(git, root)
  const mergeBase = base && (await git(root, ['merge-base', 'HEAD', base]))?.trim()
  if (!base || !mergeBase) return undefined
  const statuses = parseNameStatus((await git(root, ['diff', '--name-status', '-z', '--no-renames', mergeBase])) ?? '')
  const tracked = parseNumstat((await git(root, ['diff', '--numstat', '-z', '--no-renames', mergeBase])) ?? '', statuses)
  const untracked = ((await git(root, ['ls-files', '-z', '--others', '--exclude-standard'])) ?? '')
    .split('\0')
    .filter(Boolean)
    .map(path => ({ path, status: '?', added: null, removed: null, isUntracked: true }))
  const files = [...tracked, ...untracked]
  if (files.length === 0) return undefined
  return {
    root,
    base,
    mergeBase,
    files,
    branch: (await git(root, ['branch', '--show-current']))?.trim() || '(detached)',
    ahead: Number((await git(root, ['rev-list', '--count', `${mergeBase}..HEAD`]))?.trim() ?? 0),
  }
}

type DiffLine = { hunk: number; kind: string; text: string; old: number; new: number }

function diffLines(diff: string): DiffLine[] {
  const at = diff.search(/^@@ /m)
  if (at === -1) return []
  const lines: DiffLine[] = []
  diff
    .slice(at)
    .split(/(?=^@@ )/m)
    .forEach((hunk, i) => {
      const [header = '', ...body] = hunk.split('\n')
      const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(header)
      if (!m) return
      let old = Number(m[1])
      let now = Number(m[2])
      for (const line of body) {
        const kind = line[0]
        if (kind !== ' ' && kind !== '+' && kind !== '-') continue
        lines.push({ hunk: i, kind, text: line.slice(1), old, new: now })
        if (kind !== '+') old++
        if (kind !== '-') now++
      }
    })
  return lines
}

const GUTTER = /^\s*(\d+\s+){0,2}[+-]?\s?/

function isSameLine(picked: string, line: string): boolean {
  const p = picked.trim()
  const l = line.trim()
  if (!l) return !/[^\d\s+-]/.test(p)
  if (!p) return false
  const bare = p.replace(GUTTER, '').trim()
  return p.includes(l) || (bare.length > 0 && l.includes(bare))
}

export type PickedLines = { source: string; from: number; to: number; isOld: boolean }

export function hunkRange(hunk: string): PickedLines | undefined {
  const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(hunk)
  if (!m) return undefined
  const old = Number(m[1])
  const olds = m[2] === undefined ? 1 : Number(m[2])
  const now = Number(m[3])
  const news = m[4] === undefined ? 1 : Number(m[4])
  const source = hunk.endsWith('\n') ? hunk : `${hunk}\n`
  return news > 0 ? { source, from: now, to: now + news - 1, isOld: false } : { source, from: old, to: old + olds - 1, isOld: true }
}

export function pickLines(diff: string, picked: string): PickedLines | undefined {
  const lines = diffLines(diff)
  const want = picked
    .split('\n')
    .filter(l => !l.startsWith('@@'))
    .join('\n')
    .replace(/^\s*\n|\n\s*$/g, '')
    .split('\n')
  if (!want.join('').trim()) return undefined
  const start = lines.findIndex((_, i) => want.every((w, j) => lines[i + j] && isSameLine(w, lines[i + j]!.text)))
  if (start === -1) return undefined
  const chosen = lines.slice(start, start + want.length)
  let source = ''
  for (const hunk of new Set(chosen.map(l => l.hunk))) {
    const part = chosen.filter(l => l.hunk === hunk)
    const olds = part.filter(l => l.kind !== '+').length
    const news = part.filter(l => l.kind !== '-').length
    const old = olds ? part[0]!.old : part[0]!.old - 1
    const now = news ? part[0]!.new : part[0]!.new - 1
    source += `@@ -${old},${olds} +${now},${news} @@\n${part.map(l => l.kind + l.text + '\n').join('')}`
  }
  const added = chosen.filter(l => l.kind !== '-')
  const side = added.length ? added.map(l => l.new) : chosen.map(l => l.old)
  return { source, from: side[0]!, to: side[side.length - 1]!, isOld: added.length === 0 }
}
