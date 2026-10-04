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

export function parseNumstat(out: string): FileChange[] {
  return out
    .split('\0')
    .filter(Boolean)
    .map(record => {
      const [added, removed, ...rest] = record.split('\t')
      return {
        path: rest.join('\t'),
        added: added === '-' ? null : Number(added),
        removed: removed === '-' ? null : Number(removed),
        isUntracked: false,
      }
    })
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
  const tracked = parseNumstat((await git(root, ['diff', '--numstat', '-z', '--no-renames', mergeBase])) ?? '')
  const untracked = ((await git(root, ['ls-files', '-z', '--others', '--exclude-standard'])) ?? '')
    .split('\0')
    .filter(Boolean)
    .map(path => ({ path, added: null, removed: null, isUntracked: true }))
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
