import { describe, expect, test } from 'claude-code/testing'
import { dirsInCommand, fitHunks, parseNumstat, snapshot, type Git } from './git.ts'

const fakeGit = (answers: Record<string, string | undefined>): Git => async (_dir, args) => answers[args.join(' ')]

describe('repo-diff git helpers', () => {
  test('resolves relative -C and --cwd against every directory the command may be in', () => {
    expect(dirsInCommand('cd ~/a && git -C "../b c" status; (cd /x) | cat', '/w', '/h')).toEqual(['/h/a', '/x', '/w/../b c', '/h/a/../b c'])
    expect(dirsInCommand('git -C sub status && cd /p && git -C ../q add f', '/w', '/h')).toEqual(['/p', '/w/sub', '/w/../q', '/p/../q'])
    expect(dirsInCommand('(cd /tmp/build && make); git -C repo status', '/w', '/h')).toEqual(['/tmp/build', '/w/repo', '/tmp/build/repo'])
    expect(dirsInCommand('cd /definitely-missing || git -C repo status', '/w', '/h')).toEqual(['/definitely-missing', '/w/repo', '/definitely-missing/repo'])
    expect(dirsInCommand('herdr tab create --workspace wW --cwd ~/r --label x', '/w', '/h')).toEqual(['/h/r'])
    expect(dirsInCommand('echo cdrom -Cfoo', '/w', '/h')).toEqual([])
  })

  test('parses NUL-separated numstat with binaries and odd names', () => {
    expect(parseNumstat('3\t1\ta.ts\0-\t-\timg.png\0' + '1\t0\tta\tb\nc 日本.md\0')).toEqual([
      { path: 'a.ts', added: 3, removed: 1, isUntracked: false },
      { path: 'img.png', added: null, removed: null, isUntracked: false },
      { path: 'ta\tb\nc 日本.md', added: 1, removed: 0, isUntracked: false },
    ])
  })

  test('cuts diffs on hunk boundaries', () => {
    const diff = 'diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+b\n@@ -9 +9 @@\n-c\n+d\n'
    expect(fitHunks(diff, 1000)).toEqual({ source: '@@ -1 +1 @@\n-a\n+b\n@@ -9 +9 @@\n-c\n+d\n', isCut: false })
    expect(fitHunks(diff, 20)).toEqual({ source: '@@ -1 +1 @@\n-a\n+b\n', isCut: true })
    expect(fitHunks('Binary files a/x and b/x differ\n', 1000)).toBeUndefined()
  })

  test('snapshots a repo ahead of its default branch', async () => {
    const git = fakeGit({
      'rev-parse --abbrev-ref origin/HEAD': 'origin/main\n',
      'merge-base HEAD origin/main': 'abc\n',
      'diff --numstat -z --no-renames abc': '2\t0\tx.ts\0',
      'ls-files -z --others --exclude-standard': 'new.md\0',
      'branch --show-current': 'feat/x\n',
      'rev-list --count abc..HEAD': '3\n',
    })
    expect(await snapshot(git, '/r')).toEqual({
      root: '/r', base: 'origin/main', mergeBase: 'abc', branch: 'feat/x', ahead: 3,
      files: [
        { path: 'x.ts', added: 2, removed: 0, isUntracked: false },
        { path: 'new.md', added: null, removed: null, isUntracked: true },
      ],
    })
  })

  test('hides a clean repo and falls back to a local main', async () => {
    const git = fakeGit({
      'rev-parse --verify --quiet main': 'abc\n',
      'merge-base HEAD main': 'abc\n',
      'diff --numstat -z --no-renames abc': '',
      'ls-files -z --others --exclude-standard': '',
    })
    expect(await snapshot(git, '/r')).toBeUndefined()
  })
})
