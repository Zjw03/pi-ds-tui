/**
 * Tool call row: one header line per call, with the argument that identifies
 * it. `write` additionally shows its content once the row is expanded.
 */
import type { Component } from '@earendil-works/pi-tui'
import type { ThemeColor } from '@earendil-works/pi-coding-agent'
import type { ToolRenderContext, CardTheme } from './types.ts'
import {
  callHeader,
  displayPath,
  formatDuration,
  num,
  statusGlyph,
  str,
} from './card.ts'
import { fitLine } from '../ui/text.ts'

type Args = Readonly<Record<string, unknown>>

/** Content previews stop here; the full file is one `cat` away. */
const MAX_PREVIEW_LINES = 400

function record(value: unknown): Args {
  return typeof value === 'object' && value !== null ? (value as Args) : {}
}

function countLines(text: string): number {
  if (text.length === 0) return 0
  return text.split(/\r?\n/).length
}

function rangeSuffix(offset: number | null, limit: number | null): string {
  if (offset === null && limit === null) return ''
  const start = offset ?? 0
  return limit === null ? `:${start}` : `:${start}+${limit}`
}

function metaParts(parts: readonly (string | null)[], durationMs: number | undefined): string | null {
  const kept = parts.filter((part): part is string => part !== null && part.length > 0)
  if (durationMs !== undefined) {
    const duration = formatDuration(durationMs)
    if (duration.length > 0) kept.push(duration)
  }
  return kept.length > 0 ? kept.join(' \u00b7 ') : null
}

function editCount(args: Args): number {
  if (Array.isArray(args.edits)) return args.edits.length
  // Single-edit shape used by older callers and some third-party tools.
  return typeof args.oldText === 'string' || typeof args.newText === 'string' ? 1 : 0
}

export interface CallDescription {
  readonly detail: string | null
  readonly detailToken?: ThemeColor
  readonly detailFromTail?: boolean
  readonly meta: string | null
}

/** Header fields for one tool call. Unknown shapes degrade to the tool name. */
export function describeCall(
  toolName: string,
  rawArgs: unknown,
  context: ToolRenderContext,
): CallDescription {
  const args = record(rawArgs)
  const cwd = context.cwd
  const duration = context.durationMs

  switch (toolName) {
    case 'read': {
      const path = str(args.path) ?? str(args.file_path)
      const range = rangeSuffix(num(args.offset), num(args.limit))
      return {
        detail: `${displayPath(path, cwd)}${range}`,
        meta: metaParts([], duration),
      }
    }
    case 'write': {
      const path = str(args.path) ?? str(args.file_path)
      const content = str(args.content)
      const added = content === null ? null : `+${countLines(content)} lines`
      return { detail: displayPath(path, cwd), meta: metaParts([added], duration) }
    }
    case 'edit': {
      const path = str(args.path) ?? str(args.file_path)
      const count = editCount(args)
      const label = count > 0 ? `${count} edit${count === 1 ? '' : 's'}` : null
      return { detail: displayPath(path, cwd), meta: metaParts([label], duration) }
    }
    case 'bash':
    case 'powershell': {
      return {
        detail: str(args.command),
        detailToken: 'toolOutput',
        detailFromTail: true,
        meta: metaParts([], duration),
      }
    }
    case 'grep': {
      const pattern = str(args.pattern) ?? str(args.query)
      const path = str(args.path)
      return {
        detail: pattern,
        meta: metaParts([path === null ? null : `in ${displayPath(path, cwd)}`], duration),
      }
    }
    case 'find': {
      const pattern = str(args.pattern) ?? str(args.glob)
      const path = str(args.path)
      return {
        detail: pattern,
        meta: metaParts([path === null ? null : `in ${displayPath(path, cwd)}`], duration),
      }
    }
    case 'ls': {
      return { detail: displayPath(str(args.path), cwd), meta: metaParts([], duration) }
    }
    default:
      return { detail: null, meta: metaParts([], duration) }
  }
}

function contentPreview(content: string, width: number, theme: CardTheme): string[] {
  const raw = content.split(/\r?\n/)
  const shown = raw.slice(0, MAX_PREVIEW_LINES)
  const lines = shown.map((line) => fitLine(theme.fg('toolOutput', line), width))
  const hidden = raw.length - shown.length
  if (hidden > 0) lines.push(fitLine(theme.fg('dim', `\u2026 +${hidden} lines`), width))
  return lines
}

export class ToolCallCard implements Component {
  readonly #toolName: string
  readonly #args: unknown
  readonly #theme: CardTheme
  readonly #context: ToolRenderContext

  constructor(toolName: string, args: unknown, theme: CardTheme, context: ToolRenderContext) {
    this.#toolName = toolName
    this.#args = args
    this.#theme = theme
    this.#context = context
  }

  render(width: number): string[] {
    if (width <= 0) return []
    const description = describeCall(this.#toolName, this.#args, this.#context)
    const header = callHeader(
      this.#theme,
      {
        glyph: statusGlyph(this.#context, this.#theme),
        name: this.#toolName,
        ...description,
      },
      width,
    )
    const lines = [header]

    if (this.#toolName === 'write' && this.#context.expanded) {
      const content = str(record(this.#args).content)
      if (content !== null && content.length > 0) {
        lines.push(...contentPreview(content, width, this.#theme))
      }
    }

    return lines
  }

  invalidate(): void {}
}
