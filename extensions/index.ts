/**
 * pi-ds-tui entry point.
 *
 * M0 only loads and validates the config. The UI registrations arrive in the
 * later milestones; keeping this file small makes it obvious which public pi
 * APIs the extension touches.
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { loadConfig } from './config.ts'

const loaded = loadConfig()

export default function piDsTui(pi: ExtensionAPI): void {
  pi.registerCommand('ds-ui', {
    description: 'Show pi-ds-tui config status',
    handler: async (_args, ctx) => {
      const lines = [
        `config: ${loaded.path} (${loaded.found ? 'found' : 'defaults'})`,
        `enabled: ${loaded.config.enabled}`,
        `warnings: ${loaded.warnings.length}`,
      ]
      for (const warning of loaded.warnings.slice(0, 5)) lines.push(`- ${warning}`)
      ctx.ui.notify(lines.join('\n'), loaded.warnings.length > 0 ? 'warning' : 'info')
    },
  })

  if (loaded.warnings.length > 0) {
    pi.on('session_start', (_event, ctx) => {
      ctx.ui.notify(`pi-ds-tui: ${loaded.warnings.length} config warning(s); run /ds-ui`, 'warning')
    })
  }
}
