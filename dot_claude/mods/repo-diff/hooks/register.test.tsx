import { expect, test } from 'claude-code/testing'

const GIT: Record<string, string> = {
  'rev-parse --show-toplevel': '/r\n',
  'rev-parse --abbrev-ref origin/HEAD': 'origin/main\n',
  'merge-base HEAD origin/main': 'abc\n',
  'diff --numstat -z --no-renames abc': '1\t1\tx.ts\0',
  'ls-files -z --others --exclude-standard': '',
  'branch --show-current': 'feat/x\n',
  'rev-list --count abc..HEAD': '2\n',
  'diff --no-renames abc -- x.ts': 'diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1 +1 @@\n-old\n+new\n',
}

const PANE_PROPS = {
  title: 'Repo diff',
  isFocused: false,
  bodyColumns: 60,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}

test('a repo touched by Bash shows up and its file diff opens', async ($, on) => {
  on('session.cwd', () => ({ value: '/w' }))
  on('env.get', () => ({ value: '/h' }))
  on('process.run', (_$, e) => {
    const out = GIT[e.argv.slice(8).join(' ')]
    return {
      value: {
        exitCode: out === undefined ? 1 : 0,
        stdout: out ?? '',
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false } }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))

  await $.tool.call({ tool: 'Bash', command: 'cd /r && git status' })
  await $.command.run({ command: 'repo-diff', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'repo-diff', surface, component: 'Pane', requestId: 'repo-diff', props: PANE_PROPS })
    expect(await ui.find({ text: /feat\/x · 2 commits ahead of origin\/main/ })).toBeDefined()
    await ui.press({ key: 'file:/r:tracked:x.ts' })
    const code = await ui.find({ type: 'Code' })
    expect(code?.props.source).toBe('@@ -1 +1 @@\n-old\n+new\n')
    await ui.unmount()
  }
})
