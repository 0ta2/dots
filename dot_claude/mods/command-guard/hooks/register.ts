import type { Register } from 'claude-code'
import { findRule, type Config } from './guard.ts'

export const register: Register = on => {
  on('tool.check', async ($, e, next) => {
    let config: Config
    try {
      config = JSON.parse(await $.fs.read(`${$.plugin.root}/rules.json`))
    } catch (err) {
      $.ui.toast(`command-guard: rules.json を読めません (${err instanceof Error ? err.message : err})`)
      return next(e)
    }
    const cwd = await $.session.cwd()
    const home = (await $.env.get('HOME')) ?? ''
    const git = async (dir: string, args: string[]) => {
      const r = await $.process.run(['git', '-C', dir, ...args]).catch(() => undefined)
      return r?.exitCode === 0 ? r.stdout.trim() : ''
    }
    const rule = await findRule(config, e.tool, e.input, { cwd, home, git })
    if (!rule) return next(e)
    const reason = `command-guard: ${rule.name}`
    if (rule.action === 'ask') {
      const verdict = await next(e)
      return verdict.decision === 'deny' ? verdict : { decision: 'ask', reason }
    }
    return { decision: 'deny', reason: `${reason} (blocked)` }
  })
}
