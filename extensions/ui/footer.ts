/**
 * dsh-style footer.
 *
 * Layout:
 *   line 1  cwd
 *   line 2  left: context / tokens / cache / cost / git / effort
 *           right: model + thinking level
 *   line 3  extension statuses from setStatus()
 *
 * Chips drop in a fixed priority order when the terminal is narrow:
 * cost -> cache -> tokens -> git -> effort. Context and the model stay.
 */
import type { Component } from '@earendil-works/pi-tui'
import type { Theme } from '@earendil-works/pi-coding-agent'
import type { FooterConfig } from '../config.ts'
import { fitLine, padRight, sanitizeSingleLine, truncateMiddle, visibleWidth } from './text.ts'

export interface FooterSnapshot {
  readonly cwd: string
  readonly model: string | null
  readonly thinking: string | null
  readonly contextPercent: number | null
  readonly contextWindow: number
  readonly totalTokens: number
  readonly cacheTokens: number
  readonly cacheHitPercent: number | null
  readonly cost: number
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
  readonly totalTokens?: number
  readonly cacheRead?: number
  readonly cacheWrite?: number
  readonly cost?: { readonly total?: number }
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
  totalTokens: number
  cacheTokens: number
  cacheHitPercent: number | null
  cost: number
}

const DROP_ORDER = ['cost', 'cache', 'tokens'] as const

export function snapshotFooter(
  ctx: FooterContextLike,
  data: FooterDataLike,
  cache?: FooterStatsCache,
): FooterSnapshot {
  const usage = ctx.getContextUsage?.()
  const stats = readStats(ctx.sessionManager, cache)
  const statuses = [...data.getExtensionStatuses().values()]
    .map((text) => sanitizeSingleLine(text))
    .filter((text) => text.length > 0)

  return {
    cwd: ctx.cwd,
    model: ctx.model?.id ?? null,
    thinking: ctx.thinkingLevel ?? null,
    contextPercent: usage?.percent ?? null,
    contextWindow: usage?.contextWindow ?? 0,
    totalTokens: stats.totalTokens,
    cacheTokens: stats.cacheTokens,
    cacheHitPercent: stats.cacheHitPercent,
    cost: stats.cost,
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
  const lines: string[] = []

  const status = layoutStatusLine(snapshot, config, width, theme)
  if (status.length > 0) lines.push(status)

  if (config.chips.includes('context')) {
    const bar = renderContextBar(snapshot, width, theme)
    if (bar.length > 0) lines.push(bar)
  }

  if (snapshot.statuses.length > 0) {
    lines.push(theme.fg('dim', truncateMiddle(snapshot.statuses.join(' \u00b7 '), width)))
  }

  return lines
}

/** Fill and track glyphs for the context meter. */
export const BAR_FILL = '\u2588'
export const BAR_TRACK = '\u2591'

/** Branch marker shown before the git branch name (`dsh-tui` uses the same). */
export const BRANCH_GLYPH = '\u2387'

type ColorToken = string

function pressureToken(percent: number | null): ColorToken {
  if (percent === null) return 'dim'
  if (percent >= 95) return 'error'
  if (percent >= 80) return 'warning'
  return 'dim'
}

function fillToken(percent: number): ColorToken {
  if (percent >= 95) return 'error'
  if (percent >= 80) return 'warning'
  return 'accent'
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
  const readout = theme.fg(pressureToken(percent), barReadout(snapshot))
  const textWidth = Math.min(width, visibleWidth(readout))
  const trackWidth = width - textWidth - 1
  if (trackWidth <= 0) return fitLine(readout, width)

  const filled = Math.round((clamped / 100) * trackWidth)
  const fill = theme.fg(fillToken(clamped), BAR_FILL.repeat(filled))
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
  const chips = buildChips(snapshot, config.chips)
  let keepBranch =
    config.chips.includes('git') &&
    snapshot.gitBranch !== null &&
    snapshot.gitBranch.length > 0
  let keepThinking = config.chips.includes('effort')

  const compose = (): { left: string; right: string } => {
    const right = modelLabel(snapshot, theme, keepThinking)
    const chipText = joinChips(chips, theme, snapshot)
    const branch = keepBranch
      ? theme.fg('muted', `${BRANCH_GLYPH} ${snapshot.gitBranch ?? ''}`)
      : ''
    const reserved =
      (visibleWidth(branch) > 0 ? visibleWidth(branch) + 2 : 0) +
      (chipText.length > 0 ? visibleWidth(chipText) + 2 : 0) +
      (right.length > 0 ? visibleWidth(right) + 2 : 0)
    const cwd = showCwd
      ? theme.fg('dim', truncateMiddle(snapshot.cwd, Math.max(4, width - reserved)))
      : ''
    return { left: [cwd, branch, chipText].filter((part) => part.length > 0).join('  '), right }
  }

  let view = compose()
  const overflow = (): boolean =>
    visibleWidth(view.left) + (view.right.length > 0 ? visibleWidth(view.right) + 2 : 0) > width

  while (overflow()) {
    const index = dropIndex(chips)
    if (index >= 0) {
      chips.splice(index, 1)
      view = compose()
      continue
    }
    if (keepBranch) {
      keepBranch = false
      view = compose()
      continue
    }
    if (keepThinking) {
      keepThinking = false
      view = compose()
      continue
    }
    break
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

export function formatCost(cost: number): string {
  if (!Number.isFinite(cost) || cost <= 0) return '$0'
  return `$${cost.toFixed(cost < 1 ? 4 : 2)}`
}

interface Chip {
  readonly key: string
  readonly text: string
}

function buildChips(snapshot: FooterSnapshot, order: readonly string[]): Chip[] {
  const chips: Chip[] = []
  for (const key of order) {
    // `cwd`, `model`, `context`, `git` and `effort` render elsewhere.
    if (
      key === 'model' ||
      key === 'cwd' ||
      key === 'context' ||
      key === 'git' ||
      key === 'effort'
    ) {
      continue
    }
    const text = chipText(key, snapshot)
    if (text !== null) chips.push({ key, text })
  }
  return chips
}

function chipText(key: string, snapshot: FooterSnapshot): string | null {
  switch (key) {
    case 'tokens':
      return `\u03a3 ${formatTokens(snapshot.totalTokens)}`
    case 'cache':
      return snapshot.cacheTokens > 0 ? `cache ${formatTokens(snapshot.cacheTokens)}` : null
    case 'cost':
      return snapshot.cost > 0 ? formatCost(snapshot.cost) : null
    default:
      return null
  }
}

function modelLabel(snapshot: FooterSnapshot, theme: FooterTheme, includeThinking: boolean): string {
  const model = snapshot.model ?? 'no-model'
  const label = theme.fg('accent', model)
  if (!includeThinking || snapshot.thinking === null || snapshot.thinking.length === 0) return label
  return `${label}${theme.fg('dim', ` \u00b7 ${snapshot.thinking}`)}`
}

function joinChips(chips: readonly Chip[], theme: FooterTheme, _snapshot: FooterSnapshot): string {
  return chips.map((chip) => theme.fg('muted', chip.text)).join(' ')
}


function dropIndex(chips: readonly Chip[]): number {
  for (const key of DROP_ORDER) {
    const index = chips.findIndex((chip) => chip.key === key)
    if (index >= 0) return index
  }
  return -1
}

interface StatsTotals {
  totalTokens: number
  cacheTokens: number
  cacheHitPercent: number | null
  cost: number
}

function entryUsage(raw: EntryLike): UsageLike | undefined {
  if (raw.type === 'usage') return raw.usage
  if (raw.type === 'message') {
    return raw.message?.role === 'assistant' ? raw.message.usage : undefined
  }
  if (raw.type === 'compaction' || raw.type === 'branch_summary') return raw.usage
  return undefined
}

function readStats(
  session: FooterSessionLike | undefined,
  cache: FooterStatsCache | undefined,
): StatsTotals {
  if (!session) return { totalTokens: 0, cacheTokens: 0, cacheHitPercent: null, cost: 0 }

  const entries = session.getEntries()
  const entryCount = session.getEntryCount?.() ?? entries.length
  if (cache !== undefined && cache.entryCount === entryCount) {
    return {
      totalTokens: cache.totalTokens,
      cacheTokens: cache.cacheTokens,
      cacheHitPercent: cache.cacheHitPercent,
      cost: cache.cost,
    }
  }

  let totalTokens = 0
  let cacheTokens = 0
  let cacheHitPercent: number | null = null
  let cost = 0
  for (const raw of entries) {
    if (!isEntry(raw)) continue
    const usage = entryUsage(raw)
    if (usage === undefined) continue

    totalTokens += usage.totalTokens ?? 0
    cacheTokens += (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0)
    cost += usage.cost?.total ?? 0

    // Cache hit rate of the most recent assistant turn: cache reads over the
    // whole prompt (fresh input + cache read + cache write).
    if (raw.type === 'message' && raw.message?.role === 'assistant') {
      const prompt = (usage.input ?? 0) + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0)
      cacheHitPercent = prompt > 0 ? ((usage.cacheRead ?? 0) / prompt) * 100 : 0
    }
  }

  if (cache !== undefined) {
    cache.entryCount = entryCount
    cache.totalTokens = totalTokens
    cache.cacheTokens = cacheTokens
    cache.cacheHitPercent = cacheHitPercent
    cache.cost = cost
  }
  return { totalTokens, cacheTokens, cacheHitPercent, cost }
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
    totalTokens: 0,
    cacheTokens: 0,
    cacheHitPercent: null,
    cost: 0,
  }
  return new DshFooter(() => snapshotFooter(ctx, data, cache), config, theme)
}
