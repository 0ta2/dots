import { expect, test } from 'claude-code/testing'

const GIT: Record<string, string> = {
  'rev-parse --show-toplevel': '/r\n',
  'rev-parse --abbrev-ref origin/HEAD': 'origin/main\n',
  'merge-base HEAD origin/main': 'abc\n',
  'diff --numstat -z --no-renames abc': '1\t1\tx.ts\0',
  'ls-files -z --others --exclude-standard': '',
  'branch --show-current': 'feat/x\n',
  'rev-list --count abc..HEAD': '2\n',
  'diff --no-index --no-textconv -- /dev/null x.ts': 'diff --git a/x.ts b/x.ts\nnew file mode 100644\n--- /dev/null\n+++ b/x.ts\n@@ -0,0 +1 @@\n+new\n',
  'diff --no-renames --no-textconv abc -- x.ts': 'diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1 +1 @@\n-old\n+new\n',
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
        exitCode: out === undefined ? 128 : e.argv.includes('--no-index') ? 1 : 0,
        stdout: out ?? '',
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false } }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.status', () => ({ value: undefined }))
  on('fs.stat', () => ({ value: { kind: 'file' as const, size: 4, mtimeMs: 0, isLink: false } }))
  const contexts: (readonly string[] | undefined)[] = []
  on('prompt.submit', (_$, e) => {
    contexts.push(e.context)
    return { text: e.text, context: e.context }
  })

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

  const ui = await $.ui.mount({ plugin: 'repo-diff', surface: 'terminal', component: 'Pane', requestId: 'repo-diff', props: PANE_PROPS })
  await ui.press({ key: 'ask' })
  expect(await ui.find({ text: 'asked ✓' })).toBeDefined()
  GIT['diff --numstat -z --no-renames abc'] = '0\t1\tx.ts\0'
  GIT['diff --no-renames --no-textconv abc -- x.ts'] = 'diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ /dev/null\n@@ -1 +0,0 @@\n-old\n'
  GIT['ls-files -z --others --exclude-standard'] = 'x.ts\0'
  await $.tool.call({ tool: 'Bash', command: 'git rm --cached x.ts' })
  await ui.press({ key: 'file:/r:untracked:x.ts' })
  expect(await ui.find({ text: 'asked ✓' })).toBeDefined()
  await $.prompt.submit({ text: 'n', wait: false, origin: { kind: 'scheduled-trigger' } })
  await $.prompt.submit({ text: 'a', wait: false, origin: { kind: 'composer' } })
  await $.prompt.submit({ text: 'b', wait: false, origin: { kind: 'composer' } })
  expect(contexts[0]).toBeUndefined()
  expect(contexts[1]?.[0]).toContain('x.ts in /r (since its merge base with origin/main)')
  expect(contexts[1]?.[0]).toContain('@@ -0,0 +1 @@\n+new\n')
  expect(contexts[2]).toBeUndefined()
  expect(await ui.find({ text: 'ask' })).toBeDefined()

  await ui.unmount()
})
