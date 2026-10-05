import { expect, test, type TestBody } from 'claude-code/testing'

const GIT: Record<string, string> = {
  'rev-parse --show-toplevel': '/r\n',
  'rev-parse --abbrev-ref origin/HEAD': 'origin/main\n',
  'merge-base HEAD origin/main': 'abc\n',
  'diff --numstat -z --no-renames abc': '1\t1\tx.ts\0',
  'ls-files -z --others --exclude-standard': '',
  'branch --show-current': 'feat/x\n',
  'rev-list --count abc..HEAD': '2\n',
  'diff --no-index --no-textconv --no-ext-diff -- /dev/null x.ts': 'diff --git a/x.ts b/x.ts\nnew file mode 100644\n--- /dev/null\n+++ b/x.ts\n@@ -0,0 +1 @@\n+new\n',
  'diff --no-renames --no-textconv --no-ext-diff abc -- x.ts': 'diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1 +1 @@\n-old\n+new\n',
}

const SECOND: Record<string, string> = {
  ...GIT,
  'rev-parse --show-toplevel': '/s\n',
  'diff --numstat -z --no-renames abc': '3\t0\ty.ts\0',
}

const RANGE_DIFF = 'diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1,4 +1,5 @@\n keep()\n-old()\n+first()\n+second()\n tail()\n end()\n'

const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} }

const PANE_PROPS = {
  title: 'Unmerged',
  isFocused: false,
  bodyColumns: 60,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}

type On = Parameters<TestBody>[1]
let picked: { text: string; requestId?: string } | undefined

function fake(on: On, git: Record<string, string>) {
  const contexts: (readonly string[] | undefined)[] = []
  on('session.cwd', () => ({ value: '/w' }))
  on('env.get', () => ({ value: '/h' }))
  on('process.run', (_$, e) => {
    const repo = e.argv[2] === '/s' || e.argv[2]?.startsWith('/s/') ? SECOND : git
    const out = repo[e.argv.slice(8).join(' ')]
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
  on('ui.selection', () => ({ value: picked }))
  on('ui.render', () => ({ type: 'Box' as const, props: {}, children: [] }))
  on('fs.stat', () => ({ value: { kind: 'file' as const, size: 4, mtimeMs: 0, isLink: false } }))
  on('prompt.submit', (_$, e) => {
    contexts.push(e.context)
    return { text: e.text, context: e.context }
  })

  return contexts
}

test('a repo touched by Bash shows up and its file diff opens', async ($, on) => {
  const git = { ...GIT }
  const contexts = fake(on, git)
  await $.tool.call({ tool: 'Bash', command: 'cd /r && git status' })
  await $.command.run({ command: 'unmerged', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'unmerged', surface, component: 'Pane', requestId: 'unmerged', props: PANE_PROPS })
    expect(await ui.find({ text: /feat\/x · 2 commits ahead of origin\/main/ })).toBeDefined()
    await ui.press({ key: 'file:/r:tracked:x.ts' })
    const code = await ui.find({ type: 'Code' })
    expect(code?.props.source).toBe('@@ -1 +1 @@\n-old\n+new\n')
    await ui.unmount()
  }

  const ui = await $.ui.mount({ plugin: 'unmerged', surface: 'terminal', component: 'Pane', requestId: 'unmerged', props: PANE_PROPS })
  await ui.press({ key: 'ask' })
  expect((await ui.find({ key: 'ask' }))?.props.label).toBe('添付を外す')
  git['diff --numstat -z --no-renames abc'] = '0\t1\tx.ts\0'
  git['diff --no-renames --no-textconv --no-ext-diff abc -- x.ts'] = 'diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ /dev/null\n@@ -1 +0,0 @@\n-old\n'
  git['ls-files -z --others --exclude-standard'] = 'x.ts\0'
  await $.tool.call({ tool: 'Bash', command: 'git rm --cached x.ts' })
  await ui.press({ key: 'file:/r:untracked:x.ts' })
  expect((await ui.find({ key: 'ask' }))?.props.label).toBe('添付を外す')
  await $.prompt.submit({ text: 'n', wait: false, origin: { kind: 'scheduled-trigger' } })
  await $.prompt.submit({ text: 'a', wait: false, origin: { kind: 'composer' } })
  await $.prompt.submit({ text: 'b', wait: false, origin: { kind: 'composer' } })
  expect(contexts[0]).toBeUndefined()
  expect(contexts[1]?.[0]).toContain('x.ts in /r (since its merge base with origin/main)')
  expect(contexts[1]?.[0]).toContain('@@ -0,0 +1 @@\n+new\n')
  expect(contexts[2]).toBeUndefined()
  expect((await ui.find({ key: 'ask' }))?.props.label).toBe('添付')

  await ui.unmount()
})

test('the band shows what is attached and its button takes it off', async ($, on) => {
  fake(on, { ...GIT })
  await $.tool.call({ tool: 'Bash', command: 'cd /r && git status' })
  await $.command.run({ command: 'unmerged', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
  const pane = await $.ui.mount({ plugin: 'unmerged', surface: 'terminal', component: 'Pane', requestId: 'unmerged', props: PANE_PROPS })
  await pane.press({ key: 'file:/r:tracked:x.ts' })
  await pane.press({ key: 'ask' })
  expect((await pane.find({ key: 'file:/r:tracked:x.ts' }))?.props.label).toBe('📎 x.ts')
  expect((await pane.find({ key: 'repo:/r' }))?.props.label).toBe('▾ r (1)')

  const band = await $.ui.mount({ plugin: 'unmerged', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })
  expect(await band.find({ text: /📎 r\/x\.ts を次の送信に添付/ })).toBeDefined()
  await band.press({ key: 'unask' })
  expect(await band.find({ key: 'unask' })).toBeUndefined()
  expect((await pane.find({ key: 'ask' }))?.props.label).toBe('添付')
  await band.unmount()
  await pane.unmount()
})

test('lines selected in the diff are attached alone', async ($, on) => {
  const contexts = fake(on, { ...GIT, 'diff --no-renames --no-textconv --no-ext-diff abc -- x.ts': RANGE_DIFF })
  await $.tool.call({ tool: 'Bash', command: 'cd /r && git status' })
  await $.command.run({ command: 'unmerged', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
  const pane = await $.ui.mount({ plugin: 'unmerged', surface: 'terminal', component: 'Pane', requestId: 'unmerged', props: PANE_PROPS })
  await pane.press({ key: 'file:/r:tracked:x.ts' })
  picked = { text: '  2 +first()\n  3 +second()' }
  await pane.press({ key: 'ask' })
  picked = undefined

  const band = await $.ui.mount({ plugin: 'unmerged', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })
  expect(await band.find({ text: /r\/x\.ts（2–3 行）を次の送信に添付/ })).toBeDefined()
  await $.prompt.submit({ text: 'a', wait: false, origin: { kind: 'composer' } })
  expect(contexts[0]?.[0]).toContain('attached lines 2–3 of the diff of x.ts')
  expect(contexts[0]?.[0]).toContain('since its merge base with origin/main) from the unmerged pane to this prompt:\n@@ -2,0 +2,2 @@\n+first()\n+second()\n')
  await band.unmount()
  await pane.unmount()
})

test('a selection outside the pane attaches the whole file', async ($, on) => {
  const contexts = fake(on, { ...GIT, 'diff --no-renames --no-textconv --no-ext-diff abc -- x.ts': RANGE_DIFF })
  await $.tool.call({ tool: 'Bash', command: 'cd /r && git status' })
  await $.command.run({ command: 'unmerged', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
  const pane = await $.ui.mount({ plugin: 'unmerged', surface: 'terminal', component: 'Pane', requestId: 'unmerged', props: PANE_PROPS })
  await pane.press({ key: 'file:/r:tracked:x.ts' })
  picked = { text: '+first()', requestId: 'toolu_1' }
  await pane.press({ key: 'ask' })
  picked = undefined
  await $.prompt.submit({ text: 'a', wait: false, origin: { kind: 'composer' } })
  expect(contexts[0]?.[0]).toContain('attached the diff of x.ts')
  expect(contexts[0]?.[0]).toContain('@@ -1,4 +1,5 @@')
  await pane.unmount()
})

test('several repos start folded and open one at a time', async ($, on) => {
  fake(on, { ...GIT })
  await $.tool.call({ tool: 'Bash', command: 'cd /r && cd /s && git status' })
  await $.command.run({ command: 'unmerged', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
  const pane = await $.ui.mount({ plugin: 'unmerged', surface: 'terminal', component: 'Pane', requestId: 'unmerged', props: PANE_PROPS })
  expect((await pane.find({ key: 'repo:/s' }))?.props.label).toBe('▸ s (1)')
  expect(await pane.find({ key: 'file:/r:tracked:x.ts' })).toBeUndefined()
  await pane.press({ key: 'repo:/r' })
  expect(await pane.find({ key: 'file:/r:tracked:x.ts' })).toBeDefined()
  expect(await pane.find({ key: 'file:/s:tracked:y.ts' })).toBeUndefined()
  await pane.press({ key: 'file:/r:tracked:x.ts' })
  await pane.press({ key: 'ask' })
  await pane.press({ key: 'repo:/r' })
  expect(await pane.find({ key: 'file:/r:tracked:x.ts' })).toBeUndefined()
  expect((await pane.find({ key: 'repo:/r' }))?.props.label).toBe('▸ r (1) 📎 (表示中)')
  await pane.unmount()
})

test('each file row shows its kind and line counts in color', async ($, on) => {
  fake(on, {
    ...GIT,
    'diff --name-status -z --no-renames abc': 'M\0x.ts\0D\0gone.ts\0',
    'diff --numstat -z --no-renames abc': '1\t1\tx.ts\0' + '0\t45\tgone.ts\0',
    'ls-files -z --others --exclude-standard': 'notes.md\0',
  })
  await $.tool.call({ tool: 'Bash', command: 'cd /r && git status' })
  await $.command.run({ command: 'unmerged', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
  const pane = await $.ui.mount({ plugin: 'unmerged', surface: 'terminal', component: 'Pane', requestId: 'unmerged', props: PANE_PROPS })
  expect((await pane.find({ type: 'Text', text: /^M$/ }))?.props.color).toBe('warning')
  expect((await pane.find({ type: 'Text', text: /^D$/ }))?.props.color).toBe('error')
  expect((await pane.find({ type: 'Text', text: /^\?$/ }))?.props.dimColor).toBe(true)
  expect((await pane.find({ type: 'Text', text: /^\+1$/ }))?.props.color).toBe('success')
  expect((await pane.find({ type: 'Text', text: /^-45$/ }))?.props.color).toBe('error')
  expect((await pane.find({ key: 'file:/r:tracked:gone.ts' }))?.props.label).toBe('gone.ts')
  expect((await pane.find({ key: 'file:/r:untracked:notes.md' }))?.props.label).toBe('notes.md')
  await pane.unmount()
})
