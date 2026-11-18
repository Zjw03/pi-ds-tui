/**
 * `read` result body: text content, collapse/expand, partial and error states.
 */
import type { Component } from '@earendil-works/pi-tui'
import type {
  AgentToolResult,
  ToolRenderResultOptions,
} from '@earendil-works/pi-coding-agent'
import type { CardTheme, ToolRenderContext } from './types.ts'
import type { ToolCardsConfig } from '../config.ts'
import { MULTIPLICATION_X } from '../ui/icons.ts'
import { fitLine } from '../ui/text.ts'

export function toolResultText(result: AgentToolResult<unknown>): string {
  const parts: string[] = []
  for (const item of result.content) {
    if (item.type === 'text') parts.push(item.text)
    else if (item.type === 'image') parts.push(`[image ${item.mimeType}]`)
  }
  return parts.join('\n')
}

export class ReadResultCard implements Component {
  readonly #result: AgentToolResult<unknown>
  readonly #options: ToolRenderResultOptions
  readonly #theme: CardTheme
  readonly #context: ToolRenderContext
  readonly #config: ToolCardsConfig

  constructor(
    result: AgentToolResult<unknown>,
    options: ToolRenderResultOptions,
    theme: CardTheme,
    context: ToolRenderContext,
    config: ToolCardsConfig,
  ) {
    this.#result = result
    this.#options = options
    this.#theme = theme
    this.#context = context
    this.#config = config
  }

  render(width: number): string[] {
    if (width <= 0) return []
    const text = toolResultText(this.#result)
    if (text.length === 0) {
      const label = this.#options.isPartial ? 'reading\u2026' : '(no output)'
      return [fitLine(this.#theme.fg('dim', label), width)]
    }

    const raw = text.split(/\r?\n/)
    const max = this.#options.expanded ? raw.length : Math.max(1, this.#config.collapsedLines)
    const shown = raw.slice(0, max)
    const hidden = raw.length - shown.length
    const lines = shown.map((line) => fitLine(line, width))

    if (hidden > 0) {
      const hint = this.#context.keyHint('app.tools.expand', 'to expand')
      lines.push(fitLine(this.#theme.fg('dim', `\u2026 +${hidden} lines (${hint})`), width))
    }
    if (this.#options.isPartial) {
      lines.push(fitLine(this.#theme.fg('dim', 'reading\u2026'), width))
    }
    if (this.#result.isError) {
      lines.unshift(fitLine(this.#theme.fg('error', MULTIPLICATION_X), width))
    }
    return lines
  }

  invalidate(): void {}
}
