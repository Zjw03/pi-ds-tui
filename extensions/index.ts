/**
 * pi-ds-tui entry point.
 *
 * Wires chrome around the transcript (footer, header, editor appearance,
 * working row, status line), Markdown transformation and tool cards. Every
 * registration is gated by its config switch so the extension can be turned
 * off piece by piece.
 */
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent'
import { loadConfig, readConfigObject } from './config.ts'
import { CONFIG_OVERLAY, ConfigPanel } from './configPanel.ts'
import { createToolRenderers } from './transcript/tool-card.ts'
import { createMarkdownTransformer, MARKDOWN_MESSAGE_TYPES } from './transcript/markdown.ts'
import { installEditor } from './ui/editor.ts'
import { createFooterFactory } from './ui/footer.ts'
import { createHeaderFactory, DEFAULT_TAGLINE, pickHeaderTip, type HeaderInfo } from './ui/header.ts'
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

const HEADER_TIP = pickHeaderTip()

/**
 * Apply the header. Called on session_start and again on resources_discover:
 * extensions loaded before us (feynman) may set their header from an async
 * session_start handler, and pi has only one header slot. resources_discover
 * runs after every session_start handler has settled, so this wins the slot.
 */
function applyHeader(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return
  const info: HeaderInfo = {
    ...HEADER_INFO,
    model: ctx.model?.id,
    effort: ctx.thinkingLevel,
    cwd: ctx.cwd,
    tip: HEADER_TIP,
    tagline: DEFAULT_TAGLINE,
  }
  ctx.ui.setHeader(createHeaderFactory(info, () => ctx.ui.theme, config.header.logo))
}

/** `/ds-config` stays available even when the rest of the extension is off. */
function registerConfigCommand(pi: ExtensionAPI): void {
  pi.registerCommand('ds-config', {
    description: 'Edit pi-ds-tui settings',
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return
      const draft = readConfigObject(loaded.path)
      const result = await ctx.ui.custom<{ dirty: boolean }>(
        (tui, theme, _keybindings, done) =>
          new ConfigPanel({
            theme,
            path: loaded.path,
            draft,
            requestRender: () => tui.requestRender(),
            done,
          }),
        { overlay: true, overlayOptions: CONFIG_OVERLAY },
      )
      if (!result.dirty) return
      try {
        await ctx.reload()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        ctx.ui.notify(`pi-ds-tui: saved, but reload failed (${message}); run /reload`, 'warning')
      }
    },
  })
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
        `markdown: ${config.markdown.enabled} (mermaid=${config.markdown.mermaid})`,
        `status: ${config.status.enabled}`,
        `toolCards: ${config.toolCards.enabled}`,
        `warnings: ${loaded.warnings.length}`,
      ]
      for (const warning of loaded.warnings.slice(0, 5)) lines.push(`- ${warning}`)
      ctx.ui.notify(lines.join('\n'), loaded.warnings.length > 0 ? 'warning' : 'info')
    },
  })

  registerConfigCommand(pi)

  if (!config.enabled) return

  if (config.footer.enabled) {
    pi.on('session_start', (_event, ctx) => {
      ctx.ui.setFooter((_tui, theme, footerData) =>
        createFooterFactory(ctx, footerData, config.footer, () => ctx.ui.theme ?? theme),
      )
    })
  }

  if (config.header.enabled) {
    pi.on('session_start', (_event, ctx) => applyHeader(ctx))
    pi.on('resources_discover', (_event, ctx) => applyHeader(ctx))
    pi.on('model_select', (_event, ctx) => applyHeader(ctx))
    pi.on('thinking_level_select', (_event, ctx) => applyHeader(ctx))
    pi.registerCommand('ds-header', {
      description: 'Re-apply the pi-ds-tui header',
      handler: async (_args, ctx) => {
        applyHeader(ctx)
        ctx.ui.notify('pi-ds-tui: header applied', 'info')
      },
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

  if (config.markdown.enabled) {
    pi.registerMarkdownTransformer(createMarkdownTransformer(config.markdown), {
      messageTypes: MARKDOWN_MESSAGE_TYPES,
    })
  }

  if (config.toolCards.enabled) {
    pi.registerToolRenderer(createToolRenderers(config.toolCards))
    pi.registerCommand('ds-tools', {
      description: 'Toggle tool output expansion',
      handler: async (_args, ctx) => {
        if (!ctx.hasUI) return
        const expanded = !ctx.ui.getToolsExpanded()
        ctx.ui.setToolsExpanded(expanded)
        ctx.ui.notify(
          `pi-ds-tui: tool output ${expanded ? 'expanded' : 'collapsed'}`,
          'info',
        )
      },
    })
  }
}
