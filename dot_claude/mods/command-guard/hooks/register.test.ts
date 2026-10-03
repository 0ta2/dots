import { describe, expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const RULES = JSON.stringify({
  rules: [
    { name: 'commit on main', pattern: 'git\\s+commit', when: { branch: ['main'] }, exceptRepos: ['~/data'] },
    { name: 'reset --hard', pattern: 'git\\s+reset\\s+--hard' },
    { name: 'sql delete', pattern: 'delete\\s+from', flags: 'i', scrub: false, action: 'ask' },
    { name: 'mcp drop', tool: 'mcp__*__query', field: 'sql', pattern: 'drop', flags: 'i' },
  ],
})

const engine = (on: On, branch = 'main', cwd = '/repo') => {
  on('fs.read', () => ({ value: RULES }))
  on('session.cwd', () => ({ value: cwd }))
  on('env.get', () => ({ value: '/home/u' }))
  on('process.run', (_$, e) => ({
    value: e.argv[2]?.startsWith('/missing') ? {
      exitCode: 128,
      stdout: '',
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    } : {
      exitCode: 0,
      stdout: e.argv.includes('--show-current') ? `${branch}\n` : `${e.argv[2]}\n`,
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    },
  }))
  on('tool.check', () => ({ decision: 'allow' as const }))
}

const check = ($: any, tool: string, input: unknown) => $.tool.check({ tool, input })

describe('command-guard', () => {
  test('denies a matching command', async ($, on) => {
    engine(on)
    expect((await check($, 'Bash', { command: 'git reset --hard' })).decision).toBe('deny')
  })

  test('passes a non-matching command', async ($, on) => {
    engine(on)
    expect((await check($, 'Bash', { command: 'git status' })).decision).toBe('allow')
  })

  test('ignores a command quoted in a message', async ($, on) => {
    engine(on, 'feat/x')
    expect((await check($, 'Bash', { command: 'gh pr create --body "git reset --hard"' })).decision).toBe('allow')
  })

  test('executed heredocs and substitutions are still checked', async ($, on) => {
    engine(on)
    expect((await check($, 'Bash', { command: "bash <<'EOF'\ngit reset --hard\nEOF" })).decision).toBe('deny')
    expect((await check($, 'Bash', { command: "/bin/bash <<'EOF'\ngit reset --hard\nEOF" })).decision).toBe('deny')
    expect((await check($, 'Bash', { command: 'gh pr create --body "$(git reset --hard)"' })).decision).toBe('deny')
    expect((await check($, 'Bash', { command: "env -i bash <<'EOF'\ngit reset --hard\nEOF" })).decision).toBe('deny')
    expect((await check($, 'Bash', { command: "cat <<'EOF' | bash\ngit reset --hard\nEOF" })).decision).toBe('deny')
    expect((await check($, 'Bash', { command: "cat <<'EOF'\ngit reset --hard\nEOF" })).decision).toBe('allow')
    expect((await check($, 'Bash', { command: "printf /bin/bash <<'EOF'\ngit reset --hard\nEOF" })).decision).toBe('allow')
  })

  test('branch condition and repo exception', async ($, on) => {
    engine(on)
    expect((await check($, 'Bash', { command: 'git commit -m x' })).decision).toBe('deny')
  })

  test('commit off main passes', async ($, on) => {
    engine(on, 'feat/x')
    expect((await check($, 'Bash', { command: 'git commit -m x' })).decision).toBe('allow')
  })

  test('excepted repo passes on main', async ($, on) => {
    engine(on)
    expect((await check($, 'Bash', { command: 'cd ~/data && git commit -m x' })).decision).toBe('allow')
  })

  test('repo exception follows the segment that commits', async ($, on) => {
    engine(on)
    expect((await check($, 'Bash', { command: 'git -C ~/data status; git commit -m x' })).decision).toBe('deny')
    expect((await check($, 'Bash', { command: 'git status; git -C ~/data commit -m x' })).decision).toBe('allow')
  })

  test('a failed cd falls back to the session cwd', async ($, on) => {
    engine(on)
    expect((await check($, 'Bash', { command: 'cd /missing; git commit -m x' })).decision).toBe('deny')
  })

  test('a failed cd applies the repo exception to the session cwd', async ($, on) => {
    engine(on, 'main', '/home/u/data')
    expect((await check($, 'Bash', { command: 'cd /missing; git commit -m x' })).decision).toBe('allow')
  })

  test('a failed cd re-checks the branch of the session cwd', async ($, on) => {
    engine(on, 'feat/x')
    expect((await check($, 'Bash', { command: 'cd /missing; git commit -m x' })).decision).toBe('allow')
  })

  test('ask action asks', async ($, on) => {
    engine(on)
    const r = await check($, 'Bash', { command: `psql -c "DELETE FROM users"` })
    expect(r.decision).toBe('ask')
    expect(r.reason).toContain('sql delete')
  })

  test('matches an MCP tool field', async ($, on) => {
    engine(on)
    expect((await check($, 'mcp__db__query', { sql: 'DROP TABLE x' })).decision).toBe('deny')
    expect((await check($, 'mcp__db__query', { sql: 'select 1' })).decision).toBe('allow')
  })
})
