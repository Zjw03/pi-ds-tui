/**
 * `read` call row: status dot, tool name, path, optional line range/duration.
 */
import type { Component } from '@earendil-works/pi-tui'
import type { CardTheme, ToolRenderContext } from './types.ts'
import { BLACK_CIRCLE, BULLET, MULTIPLICATION_X, TICK } from '../ui/icons.ts'
import { fitLine, truncateMiddle, visibleWidth } from '../ui/text.ts'

export interface ReadArgs {
  readonly path: string | null
  readonly offset: number | null
  readonly limit: number | null
}

export function readArgs(value: unknown): ReadArgs {
  if (typeof value !== 'object' || value === null) {
    return { path: null, offset: null, limit: null }
  }
  const record = value as { readonly path?: unknown; readonly offset?: unknown; readonly limit?: unknown }
  return {
    path: typeof record.path === 'string' ? record.path : null,
    offset: typeof record.offset === 'number' && Number.isFinite(record.offset) ? record.offset : null,
    limit: typeof record.limit === 'number' && Number.isFinite(record.limit) ? record.limit : null,
  }
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60_000)}m`
}

export class ReadCallCard implements Component {
  readonly #args: unknown
  readonly #theme: CardTheme
  readonly #context: ToolRenderContext

  constructor(args: unknown, theme: CardTheme, context: ToolRenderContext) {
    this.#args = args
    this.#theme = theme
    this.#context = context
  }

  render(width: number): string[] {
    if (width <= 0) return []
    const args = readArgs(this.#args)
    const status = statusGlyph(this.#context, this.#theme)
    const name = this.#theme.fg('toolTitle', 'read')
    const suffix = rangeLabel(args, this.#context)
    const fixed = visibleWidth(status) + 1 + visibleWidth(name) + 1 + visibleWidth(suffix)
    const path = truncateMiddle(args.path ?? '(no path)', Math.max(1, width - fixed))
    return [fitLine(`${status} ${name} ${this.#theme.fg('toolOutput', path)}${suffix}`, width)]
  }

  invalidate(): void {}
}

function statusGlyph(context: ToolRenderContext, theme: CardTheme): string {
  if (context.isError) return theme.fg('error', MULTIPLICATION_X)
  if (context.isPartial || context.executionStarted) return theme.fg('accent', BLACK_CIRCLE)
  if (context.durationMs !== undefined) return theme.fg('success', TICK)
  return theme.fg('muted', BULLET)
}

function rangeLabel(args: ReadArgs, context: ToolRenderContext): string {
  const parts: string[] = []
  if (args.offset !== null || args.limit !== null) {
    const start = args.offset ?? 0
    parts.push(`:${start}${args.limit === null ? '' : `+${args.limit}`}`)
  }
  if (context.durationMs !== undefined) {
    const duration = formatDuration(context.durationMs)
    if (duration.length > 0) parts.push(`\u00b7 ${duration}`)
  }
  return parts.length > 0 ? ` ${parts.join(' ')}` : ''
}
