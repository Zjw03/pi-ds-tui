/**
 * Tool result body: text output with collapse/expand, edit diffs, and the
 * empty/partial/error states.
 */
import type { Component } from '@earendil-works/pi-tui'
import type { AgentToolResult, ToolRenderResultOptions } from '@earendil-works/pi-coding-agent'
import type { ToolRenderContext, CardTheme } from './types.ts'
import type { ToolCardsConfig } from '../config.ts'
import { fitLine } from '../ui/text.ts'
import { str } from './card.ts'
import { parseDisplayDiff, renderDiff } from './diff.ts'

/** Tools whose interesting output is at the end. */
const TAIL_TOOLS: ReadonlySet<string> = new Set(['bash', 'powershell'])

/** pi's own shell preview length, kept so the default density matches. */
const SHELL_PREVIEW_LINES = 5

function record(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

/** Plain text of a result; image placeholders only when pi is not drawing them. */
export function toolResultText(result: AgentToolResult<unknown>, showImages: boolean): string {
  const parts: string[] = []
  for (const item of result.content) {
    if (item.type === 'text') parts.push(item.text)
    else if (item.type === 'image' && !showImages) parts.push(`[image ${item.mimeType}]`)
  }
  return parts.join('\n')
}

function trimTrailingBlank(lines: readonly string[]): string[] {
  let end = lines.length
  while (end > 0 && (lines[end - 1] ?? '').length === 0) end--
  return lines.slice(0, end)
}

export class ToolResultCard implements Component {
  readonly #toolName: string
  readonly #result: AgentToolResult<unknown>
  readonly #options: ToolRenderResultOptions
  readonly #theme: CardTheme
  readonly #context: ToolRenderContext
  readonly #config: ToolCardsConfig

  constructor(
    toolName: string,
    result: AgentToolResult<unknown>,
    options: ToolRenderResultOptions,
    theme: CardTheme,
    context: ToolRenderContext,
    config: ToolCardsConfig,
  ) {
    this.#toolName = toolName
    this.#result = result
    this.#options = options
    this.#theme = theme
    this.#context = context
    this.#config = config
  }

  render(width: number): string[] {
    if (width <= 0) return []

    const details = record(this.#result.details)
    const diff = this.#toolName === 'edit' ? str(details.diff) : null
    if (diff !== null && diff.length > 0) return this.#renderDiff(diff, width)

    // A collapsed read is just its header, as in pi: file bodies stay out of
    // the transcript until the row is expanded.
    if (this.#toolName === 'read' && !this.#options.expanded && !this.#context.isError) {
      return []
    }

    const text = toolResultText(this.#result, this.#context.showImages)
    if (text.length === 0) {
      return this.#options.isPartial
        ? [fitLine(this.#theme.fg('dim', 'running\u2026'), width)]
        : []
    }

    const lines = this.#renderText(text, width)
    return this.#context.isError
      ? lines.map((line) => fitLine(this.#theme.fg('error', line), width))
      : lines
  }

  #renderDiff(diff: string, width: number): string[] {
    const rows = parseDisplayDiff(diff)
    if (rows.length === 0) return []
    return renderDiff(rows, {
      theme: this.#theme,
      width,
      expanded: this.#options.expanded,
      maxLines: this.#config.collapsedLines,
      mode: this.#config.diffMode,
      hint: this.#context.keyHint('app.tools.expand', 'to expand'),
    })
  }

  #renderText(text: string, width: number): string[] {
    const tail = TAIL_TOOLS.has(this.#toolName)
    const all = trimTrailingBlank(text.split(/\r?\n/))
    const limit = this.#options.expanded
      ? all.length
      : tail
        ? Math.min(SHELL_PREVIEW_LINES, Math.max(1, this.#config.collapsedLines))
        : Math.max(1, this.#config.collapsedLines)
    const hidden = Math.max(0, all.length - limit)
    const shown = tail ? all.slice(hidden) : all.slice(0, limit)

    const lines = shown.map((line) => fitLine(this.#theme.fg('toolOutput', line), width))
    if (hidden > 0) {
      const hint = this.#context.keyHint('app.tools.expand', 'to expand')
      const label = tail
        ? `\u2026 ${hidden} earlier lines (${hint})`
        : `\u2026 +${hidden} lines (${hint})`
      const hintLine = fitLine(this.#theme.fg('dim', label), width)
      if (tail) lines.unshift(hintLine)
      else lines.push(hintLine)
    }

    const note = this.#note()
    if (note !== null) lines.push(fitLine(this.#theme.fg('dim', note), width))
    return lines
  }

  /** Extra dim line for truncated output, when the tool reported it. */
  #note(): string | null {
    const details = record(this.#result.details)
    const fullOutputPath = str(details.fullOutputPath)
    if (fullOutputPath !== null && fullOutputPath.length > 0) {
      return `[full output: ${fullOutputPath}]`
    }
    const truncation = record(details.truncation)
    if (truncation.truncated === true) {
      const outputLines = Number(truncation.outputLines)
      const totalLines = Number(truncation.totalLines)
      if (Number.isFinite(outputLines) && Number.isFinite(totalLines) && totalLines > 0) {
        return `[truncated: ${outputLines} of ${totalLines} lines]`
      }
      return '[truncated]'
    }
    return null
  }

  invalidate(): void {}
}
