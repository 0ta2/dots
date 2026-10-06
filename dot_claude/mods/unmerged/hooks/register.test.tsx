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
const TWO_HUNK_DIFF = 'diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1 +1 @@\n-old()\n+first()\n@@ -10 +10 @@\n-before()\n+second()\n'

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

const TAB_CREATED = JSON.stringify({ result: { tab: { tab_id: 'wW:t2' }, root_pane: { pane_id: 'wW:t2-1' } } })

const PANE_GOT = JSON.stringify({ result: { pane: { workspace_id: 'wX' } } })

function fake(
  on: On,
  git: Record<string, string>,
  env: Record<string, string> = {},
  herdr: (readonly string[])[] = [],
  spy: { fail?: string; statuses?: (string | undefined)[] } = {},
) {
  const contexts: (readonly string[] | undefined)[] = []
  on('session.cwd', () => ({ value: '/w' }))
  on('env.get', (_$, e) => ({ value: e.name in env ? env[e.name] : '/h' }))
  on('process.run', (_$, e) => {
    if (e.argv[0] === 'herdr') {
      herdr.push(e.argv)
      const verb = `${e.argv[1]} ${e.argv[2]}`
      return { value: { exitCode: verb === spy.fail ? 1 : 0, stdout: verb === 'tab create' ? TAB_CREATED : verb === 'pane get' ? PANE_GOT : '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
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
  on('ui.status', (_$, e) => {
    spy.statuses?.push(e.text)
    return { value: undefined }
  })
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
    if (surface === 'terminal') await ui.press({ key: 'file:/r:tracked:x.ts' })
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

test('a diff hunk can be attached and removed alone', async ($, on) => {
  const contexts = fake(on, { ...GIT, 'diff --no-renames --no-textconv --no-ext-diff abc -- x.ts': TWO_HUNK_DIFF })
  await $.tool.call({ tool: 'Bash', command: 'cd /r && git status' })
  await $.command.run({ command: 'unmerged', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
  const pane = await $.ui.mount({ plugin: 'unmerged', surface: 'terminal', component: 'Pane', requestId: 'unmerged', props: PANE_PROPS })
  await pane.press({ key: 'file:/r:tracked:x.ts' })
  await pane.press({ key: 'hunk:1' })
  await $.prompt.submit({ text: 'a', wait: false, origin: { kind: 'composer' } })
  expect(contexts[0]?.[0]).toContain('-before()\n+second()\n')
  expect(contexts[0]?.[0]).not.toContain('@@ -1 +1 @@')
  await pane.press({ key: 'hunk:1' })
  expect((await pane.find({ key: 'hunk:1' }))?.props.label).toBe('添付を外す')
  await pane.press({ key: 'hunk:1' })
  await $.prompt.submit({ text: 'b', wait: false, origin: { kind: 'composer' } })
  expect(contexts[1]).toBeUndefined()
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
  expect(await pane.find({ key: 'ask' })).toBeUndefined()
  expect((await pane.find({ key: 'repo:/r' }))?.props.label).toBe('▸ r (1) 📎 (表示中)')
  await pane.press({ key: 'repo:/r' })
  expect(await pane.find({ key: 'ask' })).toBeDefined()
  await pane.unmount()
})

test('a repo a delegated tab works in shows up', async ($, on) => {
  fake(on, { ...GIT })
  on('fs.list', () => ({ value: [{ name: 'wW:tN.json', kind: 'file' as const, size: 0, mtimeMs: 0, isLink: false }] }))
  on('fs.read', () => ({ value: JSON.stringify({ task: 't', repos: ['/s'] }) }))
  await $.command.run({ command: 'unmerged', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
  const pane = await $.ui.mount({ plugin: 'unmerged', surface: 'terminal', component: 'Pane', requestId: 'unmerged', props: PANE_PROPS })
  expect(await pane.find({ key: 'file:/s:tracked:y.ts' })).toBeDefined()
  expect((await pane.find({ key: 'repo:/s' }))?.props.label).toContain('委譲: t')
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

test('pressing the open file again closes its diff', async ($, on) => {
  fake(on, { ...GIT })
  await $.tool.call({ tool: 'Bash', command: 'cd /r && git status' })
  await $.command.run({ command: 'unmerged', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
  const pane = await $.ui.mount({ plugin: 'unmerged', surface: 'terminal', component: 'Pane', requestId: 'unmerged', props: PANE_PROPS })
  await pane.press({ key: 'file:/r:tracked:x.ts' })
  expect(await pane.find({ type: 'Code' })).toBeDefined()
  await pane.press({ key: 'file:/r:tracked:x.ts' })
  expect(await pane.find({ type: 'Code' })).toBeUndefined()
  expect(await pane.find({ key: 'ask' })).toBeUndefined()
  await pane.press({ key: 'file:/r:tracked:x.ts' })
  expect(await pane.find({ type: 'Code' })).toBeDefined()
  await pane.unmount()
})

const HERDR_ENV = { HERDR_ENV: '1', HERDR_WORKSPACE_ID: 'wW', HERDR_PANE_ID: '' }

for (const [editor, options] of [['nvim', {}], ['hx', { editor: 'hx' }]] as const) {
  test(`pressing open starts the editor in a new tab at the repo root (${editor})`, { options }, async ($, on) => {
    const herdr: (readonly string[])[] = []
    fake(on, { ...GIT }, HERDR_ENV, herdr)
    await $.tool.call({ tool: 'Bash', command: 'cd /r && git status' })
    await $.command.run({ command: 'unmerged', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
    const pane = await $.ui.mount({ plugin: 'unmerged', surface: 'terminal', component: 'Pane', requestId: 'unmerged', props: PANE_PROPS })
    await pane.press({ key: 'open:/r:tracked:x.ts' })
    expect(herdr).toEqual([
      ['herdr', 'tab', 'create', '--workspace', 'wW', '--cwd', '/r', '--label', 'edit-r-x.ts', '--no-focus'],
      ['herdr', 'pane', 'run', 'wW:t2-1', `${editor} x.ts`],
      ['herdr', 'tab', 'focus', 'wW:t2'],
    ])
    await pane.unmount()
  })
}

test('open is hidden outside herdr', async ($, on) => {
  fake(on, { ...GIT }, { HERDR_ENV: '' })
  await $.tool.call({ tool: 'Bash', command: 'cd /r && git status' })
  await $.command.run({ command: 'unmerged', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
  const pane = await $.ui.mount({ plugin: 'unmerged', surface: 'terminal', component: 'Pane', requestId: 'unmerged', props: PANE_PROPS })
  expect(await pane.find({ key: 'file:/r:tracked:x.ts' })).toBeDefined()
  expect(await pane.find({ key: 'open:/r:tracked:x.ts' })).toBeUndefined()
  await pane.unmount()
})

async function pressOpen($: Parameters<TestBody>[0], on: On, env: Record<string, string>, git: Record<string, string>, spy: Parameters<typeof fake>[4], key: string) {
  const herdr: (readonly string[])[] = []
  fake(on, git, env, herdr, spy)
  await $.tool.call({ tool: 'Bash', command: 'cd /r && git status' })
  await $.command.run({ command: 'unmerged', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } })
  const pane = await $.ui.mount({ plugin: 'unmerged', surface: 'terminal', component: 'Pane', requestId: 'unmerged', props: PANE_PROPS })
  await pane.press({ key })
  await pane.unmount()
  return herdr
}

test('open uses the workspace the pane is in now', async ($, on) => {
  const herdr = await pressOpen($, on, { ...HERDR_ENV, HERDR_PANE_ID: 'p1' }, { ...GIT }, {}, 'open:/r:tracked:x.ts')
  expect(herdr[0]).toEqual(['herdr', 'pane', 'get', 'p1'])
  expect(herdr[1]).toEqual(['herdr', 'tab', 'create', '--workspace', 'wX', '--cwd', '/r', '--label', 'edit-r-x.ts', '--no-focus'])
})

test('open closes the new tab and says so when the editor cannot start', async ($, on) => {
  const statuses: (string | undefined)[] = []
  const herdr = await pressOpen($, on, HERDR_ENV, { ...GIT }, { fail: 'pane run', statuses }, 'open:/r:tracked:x.ts')
  expect(herdr.map(a => a.slice(1, 3).join(' '))).toEqual(['tab create', 'pane run', 'tab close'])
  expect(herdr[2]).toEqual(['herdr', 'tab', 'close', 'wW:t2'])
  expect(statuses).toContain('開けませんでした')
})

test('open says so when the tab cannot be created', async ($, on) => {
  const statuses: (string | undefined)[] = []
  const herdr = await pressOpen($, on, HERDR_ENV, { ...GIT }, { fail: 'tab create', statuses }, 'open:/r:tracked:x.ts')
  expect(herdr).toHaveLength(1)
  expect(statuses).toContain('開けませんでした')
})

test('a path starting with a dash reaches the editor as a path', async ($, on) => {
  const herdr = await pressOpen($, on, HERDR_ENV, { ...GIT, 'diff --numstat -z --no-renames abc': '1\t1\t-x.ts\0' }, {}, 'open:/r:tracked:-x.ts')
  expect(herdr[1]).toEqual(['herdr', 'pane', 'run', 'wW:t2-1', 'nvim ./-x.ts'])
})
