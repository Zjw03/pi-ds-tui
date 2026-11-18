/**
 * Shared tool-card primitives.
 *
 * Every tool row is one line: a status glyph, the tool name, the call's
 * primary argument, and optional meta (line range, counts, duration). Wide
 * arguments are truncated here so call sites never build a line past the
 * width the TUI handed them.
 */
import { homedir } from 'node:os'
import { isAbsolute, relative, sep } from 'node:path'
import { sliceByColumn } from '@earendil-works/pi-tui'
import type { ThemeColor } from '@earendil-works/pi-coding-agent'
import type { CardTheme, ToolRenderContext } from './types.ts'
import { BLACK_CIRCLE, BULLET, MULTIPLICATION_X, TICK } from '../ui/icons.ts'
import { fitLine, sanitizeSingleLine, truncateMiddle, visibleWidth } from '../ui/text.ts'

export function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms / 60_000)}m`
}

/** Status dot: error, running, settled, or not started yet. */
export function statusGlyph(context: ToolRenderContext, theme: CardTheme): string {
  if (context.isError) return theme.fg('error', MULTIPLICATION_X)
  if (context.isPartial || context.executionStarted) return theme.fg('accent', BLACK_CIRCLE)
  if (context.durationMs !== undefined) return theme.fg('success', TICK)
  return theme.fg('muted', BULLET)
}

/** Path as the user thinks of it: `~/…` for home, relative inside the cwd. */
export function displayPath(rawPath: string | null, cwd: string): string {
  if (rawPath === null || rawPath.length === 0) return '(no path)'
  const home = homedir()
  if (home.length > 0 && rawPath.startsWith(home)) return toSlash(`~${rawPath.slice(home.length)}`)
  if (cwd.length > 0 && isAbsolute(rawPath)) {
    const rel = relative(cwd, rawPath)
    if (rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel)) return toSlash(rel)
  }
  return toSlash(rawPath)
}

/** Windows separators read as escapes inside markdown and logs. */
function toSlash(path: string): string {
  return sep === '/' ? path : path.split(sep).join('/')
}

/** Truncate from the left, keeping the tail (shell commands, trailing paths). */
export function truncateTail(text: string, width: number, ellipsis = '\u2026'): string {
  const plain = sanitizeSingleLine(text)
  const total = visibleWidth(plain)
  if (total <= width) return plain
  const mark = visibleWidth(ellipsis)
  if (width <= mark) return fitLine(plain, width, '')
  return `${ellipsis}${sliceByColumn(plain, total - (width - mark), width - mark)}`
}

export interface CallHeaderOptions {
  readonly glyph: string
  readonly name: string
  /** Primary argument, styled with `detailToken` and truncated in the middle. */
  readonly detail?: string | null
  readonly detailToken?: ThemeColor
  /** Keep the end of the detail instead of both ends (commands). */
  readonly detailFromTail?: boolean
  /** Secondary text after a middle dot: ranges, counts, durations. */
  readonly meta?: string | null
}

/** Compose the one-line header, dropping detail or meta before overflowing. */
export function callHeader(
  theme: CardTheme,
  options: CallHeaderOptions,
  width: number,
): string {
  if (width <= 0) return ''
  const name = theme.fg('toolTitle', theme.bold(options.name))
  let used = visibleWidth(options.glyph) + 1 + visibleWidth(name)
  let meta = ''
  if (options.meta) {
    const candidate = ` \u00b7 ${options.meta}`
    // Keep the argument useful: meta only earns its cells above a floor.
    if (used + visibleWidth(candidate) <= width - 8) {
      meta = theme.fg('dim', candidate)
      used += visibleWidth(candidate)
    }
  }

  let detail = ''
  const rawDetail = options.detail ?? ''
  if (rawDetail.length > 0) {
    const budget = width - used - 1
    if (budget > 3) {
      const styled = options.detailFromTail
        ? truncateTail(rawDetail, budget)
        : truncateMiddle(rawDetail, budget)
      detail = ` ${theme.fg(options.detailToken ?? 'accent', styled)}`
    }
  }

  return fitLine(`${options.glyph} ${name}${detail}${meta}`, width)
}

