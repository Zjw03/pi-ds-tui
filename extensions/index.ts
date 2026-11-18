/**
 * pi-ds-tui entry point.
 *
 * M1 wires three public surfaces: the footer, the `read` tool card, and an
 * approval overlay. Every registration is gated by its config switch so the
 * extension can be turned off piece by piece.
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { loadConfig } from './config.ts'
import { showApproval } from './overlays/approval.ts'
import { createReadRenderer } from './transcript/tool-card.ts'
import { createFooterFactory } from './ui/footer.ts'

const loaded = loadConfig()
const config = loaded.config

export default function piDsTui(pi: ExtensionAPI): void {
  pi.registerCommand('ds-ui', {
    description: 'Show pi-ds-tui config status',
    handler: async (_args, ctx) => {
      const lines = [
        `config: ${loaded.path} (${loaded.found ? 'found' : 'defaults'})`,
        `enabled: ${config.enabled}`,
        `footer: ${config.footer.enabled}`,
        `toolCards: ${config.toolCards.enabled}`,
        `overlays: ${config.overlays.enabled}`,
        `warnings: ${loaded.warnings.length}`,
      ]
      for (const warning of loaded.warnings.slice(0, 5)) lines.push(`- ${warning}`)
      ctx.ui.notify(lines.join('\n'), loaded.warnings.length > 0 ? 'warning' : 'info')
    },
  })

  if (!config.enabled) return

  if (config.footer.enabled) {
    pi.on('session_start', (_event, ctx) => {
      ctx.ui.setFooter((_tui, theme, footerData) =>
        createFooterFactory(ctx, footerData, config.footer, theme),
      )
    })
  }

  if (config.toolCards.enabled) {
    pi.registerToolRenderer(createReadRenderer(config.toolCards))
  }

  if (config.overlays.enabled) {
    pi.registerCommand('ds-approve', {
      description: 'Preview the pi-ds-tui approval overlay',
      handler: async (_args, ctx) => {
        if (!ctx.hasUI || ctx.mode !== 'tui') {
          ctx.ui.notify('pi-ds-tui: the approval overlay requires the interactive TUI', 'warning')
          return
        }
        const result = await showApproval(ctx, {
          title: 'Run command?',
          tool: 'bash',
          detail: 'rm -rf build',
        })
        ctx.ui.notify(`pi-ds-tui approval: ${result ?? 'cancelled'}`, 'info')
      },
    })
  }
}
