/**
 * dsh-style footer.
 *
 * Layout:
 *   line 1  cwd
 *   line 2  left: context / tokens / cache / cost / git / mode / effort
 *           right: model + thinking level
 *   line 3  extension statuses from setStatus()
 *
 * Chips drop in a fixed priority order when the terminal is narrow:
 * cost -> cache -> tokens -> git -> effort -> mode. Context and the model stay.
 */
import type { Component } from '@earendil-works/pi-tui'
import type { Theme } from '@earendil-works/pi-coding-agent'
import type { FooterConfig } from '../config.ts'
import { fitLine, padRight, sanitizeSingleLine, truncateMiddle, visibleWidth } from './text.ts'

export interface FooterSnapshot {
  readonly cwd: string
  readonly model: string | null
  readonly provider: string | null
  readonly thinking: string | null
  readonly mode: string
  readonly contextPercent: number | null
  readonly contextWindow: number
  readonly contextTokens: number | null
  readonly totalTokens: number
  readonly cacheTokens: number
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
  readonly mode: string
  readonly model?: { readonly id?: string; readonly provider?: string } | undefined
  readonly thinkingLevel?: string | undefined
  getContextUsage?(): { readonly percent: number | null; readonly contextWindow: number; readonly tokens: number | null } | undefined
  readonly sessionManager?: FooterSessionLike | undefined
}

export interface FooterStatsCache {
  entryCount: number
  totalTokens: number
  cacheTokens: number
  cost: number
}

const DROP_ORDER = ['cost', 'cache', 'tokens', 'git', 'effort', 'mode'] as const

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
    provider: ctx.model?.provider ?? null,
    thinking: ctx.thinkingLevel ?? null,
    mode: ctx.mode,
    contextPercent: usage?.percent ?? null,
    contextWindow: usage?.contextWindow ?? 0,
    contextTokens: usage?.tokens ?? null,
    totalTokens: stats.totalTokens,
    cacheTokens: stats.cacheTokens,
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

  if (config.chips.includes('cwd')) {
    lines.push(theme.fg('dim', truncateMiddle(snapshot.cwd, width)))
  }

  const chips = buildChips(snapshot, config.chips)
  const right = modelLabel(snapshot, theme)
  const line = layoutStats(chips, right, width, theme, snapshot)
  if (line.length > 0) lines.push(line)

  if (snapshot.statuses.length > 0) {
    lines.push(theme.fg('dim', truncateMiddle(snapshot.statuses.join(' \u00b7 '), width)))
  }

  return lines
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
    if (key === 'model' || key === 'cwd') continue
    const text = chipText(key, snapshot)
    if (text !== null) chips.push({ key, text })
  }
  return chips
}

function chipText(key: string, snapshot: FooterSnapshot): string | null {
  switch (key) {
    case 'context':
      return contextText(snapshot)
    case 'tokens':
      return `\u03a3 ${formatTokens(snapshot.totalTokens)}`
    case 'cache':
      return snapshot.cacheTokens > 0 ? `cache ${formatTokens(snapshot.cacheTokens)}` : null
    case 'cost':
      return snapshot.cost > 0 ? formatCost(snapshot.cost) : null
    case 'git':
      return snapshot.gitBranch !== null && snapshot.gitBranch.length > 0
        ? `git:${snapshot.gitBranch}`
        : null
    case 'mode':
      return snapshot.mode
    case 'effort':
      return snapshot.thinking !== null && snapshot.thinking.length > 0
        ? `think:${snapshot.thinking}`
        : null
    default:
      return null
  }
}

function contextText(snapshot: FooterSnapshot): string {
  const percent = snapshot.contextPercent === null ? '?' : `${snapshot.contextPercent.toFixed(1)}`
  const window = snapshot.contextWindow > 0 ? formatTokens(snapshot.contextWindow) : '?'
  return `${percent}%/${window}`
}

function modelLabel(snapshot: FooterSnapshot, theme: FooterTheme): string {
  const model = snapshot.model ?? 'no-model'
  const label = theme.fg('accent', model)
  if (snapshot.thinking === null || snapshot.thinking.length === 0) return label
  return `${label}${theme.fg('dim', ` \u00b7 ${snapshot.thinking}`)}`
}

function layoutStats(
  chips: readonly Chip[],
  right: string,
  width: number,
  theme: FooterTheme,
  snapshot: FooterSnapshot,
): string {
  const active = [...chips]
  let left = joinChips(active, theme, snapshot)

  while (active.length > 0 && !fits(left, right, width)) {
    const index = dropIndex(active)
    if (index < 0) break
    active.splice(index, 1)
    left = joinChips(active, theme, snapshot)
  }

  if (left.length === 0) {
    return padRight('', Math.max(0, width - visibleWidth(right))) + right
  }
  if (right.length === 0) {
    return fitLine(left, width)
  }
  if (fits(left, right, width)) {
    return padRight(left, Math.max(0, width - visibleWidth(right))) + right
  }

  const availableForRight = width - visibleWidth(left) - 2
  if (availableForRight > 0) {
    const fittedRight = fitLine(right, availableForRight)
    return padRight(left, Math.max(0, width - visibleWidth(fittedRight))) + fittedRight
  }

  return fitLine(left, width)
}

function joinChips(chips: readonly Chip[], theme: FooterTheme, snapshot: FooterSnapshot): string {
  return chips.map((chip) => theme.fg(chipColor(chip.key, snapshot), chip.text)).join(' ')
}

function chipColor(key: string, snapshot: FooterSnapshot): string {
  switch (key) {
    case 'context':
      if (snapshot.contextPercent === null) return 'muted'
      if (snapshot.contextPercent > 90) return 'error'
      if (snapshot.contextPercent > 70) return 'warning'
      return 'muted'
    case 'git':
      return 'muted'
    case 'mode':
      return 'muted'
    case 'effort':
      return 'muted'
    default:
      return 'muted'
  }
}

function fits(left: string, right: string, width: number): boolean {
  return visibleWidth(left) + 2 + visibleWidth(right) <= width
}

function dropIndex(chips: readonly Chip[]): number {
  for (const key of DROP_ORDER) {
    const index = chips.findIndex((chip) => chip.key === key)
    if (index >= 0) return index
  }
  return -1
}

function readStats(
  session: FooterSessionLike | undefined,
  cache: FooterStatsCache | undefined,
): { totalTokens: number; cacheTokens: number; cost: number } {
  if (!session) return { totalTokens: 0, cacheTokens: 0, cost: 0 }

  const entries = session.getEntries()
  const entryCount = session.getEntryCount?.() ?? entries.length
  if (cache !== undefined && cache.entryCount === entryCount) {
    return { totalTokens: cache.totalTokens, cacheTokens: cache.cacheTokens, cost: cache.cost }
  }

  let totalTokens = 0
  let cacheTokens = 0
  let cost = 0
  for (const raw of entries) {
    if (!isEntry(raw)) continue
    const usage =
      raw.type === 'usage'
        ? raw.usage
        : raw.type === 'message'
          ? raw.message?.role === 'assistant'
            ? raw.message.usage
            : undefined
          : raw.type === 'compaction' || raw.type === 'branch_summary'
            ? raw.usage
            : undefined
    if (usage === undefined) continue
    totalTokens += usage.totalTokens ?? 0
    cacheTokens += (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0)
    cost += usage.cost?.total ?? 0
  }

  if (cache !== undefined) {
    cache.entryCount = entryCount
    cache.totalTokens = totalTokens
    cache.cacheTokens = cacheTokens
    cache.cost = cost
  }
  return { totalTokens, cacheTokens, cost }
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
  const cache: FooterStatsCache = { entryCount: -1, totalTokens: 0, cacheTokens: 0, cost: 0 }
  return new DshFooter(() => snapshotFooter(ctx, data, cache), config, theme)
}
