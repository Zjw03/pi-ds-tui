/**
 * pi-ds-tui entry point.
 *
 * M2 wires chrome around the transcript: footer, header, editor appearance,
 * working row and the extension status line. Every registration is gated by
 * its config switch so the extension can be turned off piece by piece.
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { loadConfig } from './config.ts'
import { showApproval } from './overlays/approval.ts'
import { createReadRenderer } from './transcript/tool-card.ts'
import { installEditor } from './ui/editor.ts'
import { createFooterFactory } from './ui/footer.ts'
import { createHeaderFactory, type HeaderInfo } from './ui/header.ts'
import { clearWorkingStatus, setWorkingStatus } from './ui/status.ts'
import { VERSION } from './version.ts'
import { applyWorking } from './ui/working.ts'

const loaded = loadConfig()
const config = loaded.config

const HEADER_INFO: HeaderInfo = {
  name: 'pi-ds-tui',
  version: VERSION,
  hints: '/ commands \u00b7 ! bash \u00b7 ctrl+o tools',
}

export default function piDsTui(pi: ExtensionAPI): void {
  pi.registerCommand('ds-ui', {
    description: 'Show pi-ds-tui config status',
    handler: async (_args, ctx) => {
      const lines = [
        `config: ${loaded.path} (${loaded.found ? 'found' : 'defaults'})`,
        `enabled: ${config.enabled}`,
        `footer: ${config.footer.enabled}`,
        `header: ${config.header.enabled}`,
        `editor: ${config.editor.enabled}`,
        `working: ${config.working.enabled}`,
        `status: ${config.status.enabled}`,
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
        createFooterFactory(ctx, footerData, config.footer, () => ctx.ui.theme ?? theme),
      )
    })
  }

  if (config.header.enabled) {
    pi.on('session_start', (_event, ctx) => {
      ctx.ui.setHeader(createHeaderFactory(HEADER_INFO, () => ctx.ui.theme))
    })
  }

  if (config.editor.enabled) {
    pi.on('session_start', (_event, ctx) => {
      installEditor(ctx.ui, config.editor.prefix)
    })
  }

  if (config.working.enabled) {
    pi.on('session_start', (_event, ctx) => applyWorking(ctx.ui, config.working))
  }

  if (config.status.enabled) {
    pi.on('session_start', (_event, ctx) => clearWorkingStatus(ctx.ui))
    pi.on('agent_start', (_event, ctx) => setWorkingStatus(ctx.ui))
    pi.on('agent_settled', (_event, ctx) => clearWorkingStatus(ctx.ui))
    pi.on('session_shutdown', (_event, ctx) => clearWorkingStatus(ctx.ui))
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
