/**
 * dsh-style footer.
 *
 * Layout:
 *   line 1  left: cwd, branch          right: model + thinking level
 *   line 2  full-width context meter with a right-aligned readout
 *   line 3  extension statuses from setStatus()
 */
import type { Component } from '@earendil-works/pi-tui'
import type { Theme } from '@earendil-works/pi-coding-agent'
import type { FooterConfig } from '../config.ts'
import { fitLine, padRight, sanitizeSingleLine, truncateMiddle, visibleWidth } from './text.ts'
import { whaleBlue } from './whale.ts'
import { hexFg } from './theme.ts'

/** Footer accents, matched to the dsh blue ramp rather than theme tokens. */
const cwdColor = hexFg('#4EA8DE')
const branchColor = hexFg('#BCE0FD')
const readoutColor = hexFg('#A9D6E5')

export interface FooterSnapshot {
  readonly cwd: string
  readonly model: string | null
  readonly thinking: string | null
  readonly contextPercent: number | null
  readonly contextWindow: number
  readonly cacheHitPercent: number | null
  readonly gitBranch: string | null
  readonly statuses: readonly string[]
}

export interface FooterTheme {
  fg(color: string, text: string): string
  bold(text: string): string
}

export interface FooterDataLike {
  getGitBranch(): string | null
  getExtensionStatuses(): ReadonlyMap<string, string>
}

interface UsageLike {
  readonly input?: number
  readonly cacheRead?: number
  readonly cacheWrite?: number
}

interface EntryLike {
  readonly type?: string
  readonly usage?: UsageLike
  readonly message?: { readonly role?: string; readonly usage?: UsageLike }
}

export interface FooterSessionLike {
  getEntries(): readonly unknown[]
  getEntryCount?(): number
}

export interface FooterContextLike {
  readonly cwd: string
  readonly model?: { readonly id?: string; readonly provider?: string } | undefined
  readonly thinkingLevel?: string | undefined
  getContextUsage?(): { readonly percent: number | null; readonly contextWindow: number; readonly tokens: number | null } | undefined
  readonly sessionManager?: FooterSessionLike | undefined
}

export interface FooterStatsCache {
  entryCount: number
  cacheHitPercent: number | null
}

export function snapshotFooter(
  ctx: FooterContextLike,
  data: FooterDataLike,
  cache?: FooterStatsCache,
): FooterSnapshot {
  const usage = ctx.getContextUsage?.()
  const cacheHitPercent = readCacheHitPercent(ctx.sessionManager, cache)
  const statuses = [...data.getExtensionStatuses().values()]
    .map((text) => sanitizeSingleLine(text))
    .filter((text) => text.length > 0)

  return {
    cwd: ctx.cwd,
    model: ctx.model?.id ?? null,
    thinking: ctx.thinkingLevel ?? null,
    contextPercent: usage?.percent ?? null,
    contextWindow: usage?.contextWindow ?? 0,
    cacheHitPercent,
    gitBranch: data.getGitBranch(),
    statuses,
  }
}

export function renderFooter(
  snapshot: FooterSnapshot,
  width: number,
  config: FooterConfig,
  theme: FooterTheme,
): string[] {
  if (width <= 0) return []

  // One column of margin on each side. The widget and status rows around the
  // footer start at column 1, and the bar should not touch the terminal edges.
  const margin = width >= 3 ? 1 : 0
  const inner = width - margin * 2
  const lines: string[] = []

  const status = layoutStatusLine(snapshot, config, inner, theme)
  if (status.length > 0) lines.push(status)

  if (config.chips.includes('context')) {
    const bar = renderContextBar(snapshot, inner, theme)
    if (bar.length > 0) lines.push(bar)
  }

  if (snapshot.statuses.length > 0) {
    lines.push(theme.fg('dim', truncateMiddle(snapshot.statuses.join(' \u00b7 '), inner)))
  }

  if (margin === 0) return lines
  return lines.map((line) => ` ${line}`)
}

/** Fill and track glyphs for the context meter. */
export const BAR_FILL = '\u2588'
export const BAR_TRACK = '\u2591'

/** Branch marker shown before the git branch name (`dsh-tui` uses the same). */
export const BRANCH_GLYPH = '\u2387'

function fillCells(text: string, percent: number, theme: FooterTheme): string {
  if (percent >= 95) return theme.fg('error', text)
  if (percent >= 80) return theme.fg('warning', text)
  return whaleBlue(text)
}

/** `42% · 200k · CH 87%` — the bar's right-hand readout. */
export function barReadout(snapshot: FooterSnapshot): string {
  const percent = snapshot.contextPercent === null ? '?' : `${Math.round(snapshot.contextPercent)}%`
  const window = snapshot.contextWindow > 0 ? formatTokens(snapshot.contextWindow) : '?'
  const parts = [percent, window]
  if (snapshot.cacheHitPercent !== null) parts.push(`CH ${Math.round(snapshot.cacheHitPercent)}%`)
  return parts.join(' \u00b7 ')
}

/**
 * One full-width context meter: fill from the left, track to the edge, readout
 * right-aligned in the track. The readout keeps its own columns so the fill
 * never has to be clipped to stay readable.
 */
export function renderContextBar(
  snapshot: FooterSnapshot,
  width: number,
  theme: FooterTheme,
): string {
  if (width < 8) return ''
  const percent = snapshot.contextPercent
  const clamped = percent === null ? 0 : Math.min(100, Math.max(0, percent))
  const readoutText = barReadout(snapshot)
  const readout = percent !== null && percent >= 95
    ? theme.fg('error', readoutText)
    : percent !== null && percent >= 80
      ? theme.fg('warning', readoutText)
      : readoutColor(readoutText)
  const textWidth = Math.min(width, visibleWidth(readout))
  const trackWidth = width - textWidth - 1
  if (trackWidth <= 0) return fitLine(readout, width)

  const filled = Math.round((clamped / 100) * trackWidth)
  const fill = fillCells(BAR_FILL.repeat(filled), clamped, theme)
  const track = theme.fg('dim', BAR_TRACK.repeat(trackWidth - filled))
  return `${fill}${track} ${readout}`
}

function layoutStatusLine(
  snapshot: FooterSnapshot,
  config: FooterConfig,
  width: number,
  theme: FooterTheme,
): string {
  const showCwd = config.chips.includes('cwd')
  let keepBranch =
    config.chips.includes('git') &&
    snapshot.gitBranch !== null &&
    snapshot.gitBranch.length > 0
  let keepThinking = config.chips.includes('effort')

  const compose = (): { left: string; right: string } => {
    const right = modelLabel(snapshot, theme, keepThinking)
    const branch = keepBranch
      ? branchColor(`${BRANCH_GLYPH} ${snapshot.gitBranch ?? ''}`)
      : ''
    const reserved =
      (visibleWidth(branch) > 0 ? visibleWidth(branch) + 2 : 0) +
      (right.length > 0 ? visibleWidth(right) + 2 : 0)
    const cwd = showCwd
      ? cwdColor(truncateMiddle(snapshot.cwd, Math.max(4, width - reserved)))
      : ''
    return { left: [cwd, branch].filter((part) => part.length > 0).join('  '), right }
  }

  let view = compose()
  const overflow = (): boolean =>
    visibleWidth(view.left) + (view.right.length > 0 ? visibleWidth(view.right) + 2 : 0) > width

  if (overflow() && keepBranch) {
    keepBranch = false
    view = compose()
  }
  if (overflow() && keepThinking) {
    keepThinking = false
    view = compose()
  }

  const rightWidth = visibleWidth(view.right)
  if (view.right.length === 0) return fitLine(view.left, width)
  if (view.left.length === 0) {
    return `${padRight('', Math.max(0, width - rightWidth))}${fitLine(view.right, width)}`
  }
  const gap = Math.max(2, width - visibleWidth(view.left) - rightWidth)
  return fitLine(`${view.left}${' '.repeat(gap)}${view.right}`, width)
}

export function formatTokens(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '0'
  if (count < 1000) return String(Math.round(count))
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`
  if (count < 1_000_000) return `${Math.round(count / 1000)}k`
  if (count < 10_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  return `${Math.round(count / 1_000_000)}M`
}

/** Thinking-level token, the same one pi uses for the editor border. */
const THINKING_TOKENS: Readonly<Record<string, string>> = {
  off: 'thinkingOff',
  minimal: 'thinkingMinimal',
  low: 'thinkingLow',
  medium: 'thinkingMedium',
  high: 'thinkingHigh',
  xhigh: 'thinkingXhigh',
  max: 'thinkingMax',
}

export function thinkingToken(level: string): string {
  return THINKING_TOKENS[level] ?? 'dim'
}

function modelLabel(snapshot: FooterSnapshot, theme: FooterTheme, includeThinking: boolean): string {
  const model = snapshot.model ?? 'no-model'
  const label = whaleBlue(model)
  if (!includeThinking || snapshot.thinking === null || snapshot.thinking.length === 0) return label
  return `${label}${theme.fg(thinkingToken(snapshot.thinking), ` \u00b7 ${snapshot.thinking}`)}`
}

/**
 * Cache-hit rate of the most recent assistant turn: cache reads over the whole
 * prompt (fresh input + cache read + cache write). Cached by entry count.
 */
function readCacheHitPercent(
  session: FooterSessionLike | undefined,
  cache: FooterStatsCache | undefined,
): number | null {
  if (!session) return null

  const entries = session.getEntries()
  const entryCount = session.getEntryCount?.() ?? entries.length
  if (cache !== undefined && cache.entryCount === entryCount) return cache.cacheHitPercent

  let percent: number | null = null
  for (const raw of entries) {
    if (!isEntry(raw) || raw.type !== 'message' || raw.message?.role !== 'assistant') continue
    const usage = raw.message.usage
    if (usage === undefined) continue
    const prompt = (usage.input ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0)
    percent = prompt > 0 ? ((usage.cacheRead ?? 0) / prompt) * 100 : 0
  }

  if (cache !== undefined) {
    cache.entryCount = entryCount
    cache.cacheHitPercent = percent
  }
  return percent
}

function isEntry(value: unknown): value is EntryLike {
  return typeof value === 'object' && value !== null
}

export class DshFooter implements Component {
  readonly #read: () => FooterSnapshot
  readonly #config: FooterConfig
  readonly #theme: Theme | (() => Theme)

  constructor(read: () => FooterSnapshot, config: FooterConfig, theme: Theme | (() => Theme)) {
    this.#read = read
    this.#config = config
    this.#theme = theme
  }

  render(width: number): string[] {
    const theme = typeof this.#theme === 'function' ? this.#theme() : this.#theme
    return renderFooter(this.#read(), width, this.#config, theme)
  }

  invalidate(): void {}
}

/** Build a footer component factory with a stats cache scoped to one session. */
export function createFooterFactory(
  ctx: FooterContextLike,
  data: FooterDataLike,
  config: FooterConfig,
  theme: Theme | (() => Theme),
): DshFooter {
  const cache: FooterStatsCache = {
    entryCount: -1,
    cacheHitPercent: null,
  }
  return new DshFooter(() => snapshotFooter(ctx, data, cache), config, theme)
}
