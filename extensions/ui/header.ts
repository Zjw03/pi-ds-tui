/**
 * Startup header.
 *
 * Wide terminals get the 13-row DeepSeek pixel whale beside the splash text
 * column: wordmark, block-font DEEPSEEK/HARNESS, model/effort, cwd, tip, then
 * the welcome tagline under the whale. Medium terminals keep the whale with a
 * title line; narrow terminals fall back to text. `logo: false` always uses
 * the text block.
 */
import type { Component, TUI } from '@earendil-works/pi-tui'
import type { Theme } from '@earendil-works/pi-coding-agent'
import { bigWordWidth, renderBigWord, type BigFontSize } from './bigfont.ts'
import { fitLine, padRight, visibleWidth } from './text.ts'
import { renderWhaleRows, whaleBlue, WHALE_ROWS, WHALE_WIDTH } from './whale.ts'

export interface HeaderInfo {
  readonly name: string
  readonly version: string
  readonly hints: string
  readonly model?: string | undefined
  readonly effort?: string | undefined
  readonly cwd?: string | undefined
  readonly tip?: string | undefined
  readonly tagline?: string | undefined
}

export interface HeaderTheme {
  fg(color: string, text: string): string
  bold(text: string): string
}

const WHALE_GAP = 2
const TEXT_INDENT = WHALE_WIDTH + WHALE_GAP
const DEEPSEEK = 'DEEPSEEK'
const HARNESS = 'HARNESS'

export const DEFAULT_TAGLINE = 'DeepSeek Harness \u00b7 Terminal UI'

export const HEADER_TIPS = [
  'Use /commands to see everything',
  'Ctrl+O expands tool output',
  'Press ! to run a shell command',
  'Use /model to switch models',
] as const

export function pickHeaderTip(seed = Date.now()): string {
  return HEADER_TIPS[Math.abs(Math.floor(seed)) % HEADER_TIPS.length] ?? HEADER_TIPS[0]
}

export function renderHeader(
  info: HeaderInfo,
  width: number,
  theme: HeaderTheme,
  logo = true,
): string[] {
  if (width <= 0) return []

  if (logo) {
    if (width >= TEXT_INDENT + 12) return renderSplash(info, width, theme)
    if (width >= WHALE_WIDTH) return renderWhaleOnly(info, width, theme)
  }

  return renderTextHeader(info, width, theme)
}

function renderSplash(info: HeaderInfo, width: number, theme: HeaderTheme): string[] {
  const whale = renderWhaleRows()
  const textWidth = width - TEXT_INDENT
  const text = renderSplashText(info, textWidth, theme)
  const rows = whale.map((row, index) =>
    fitLine(`${row}${' '.repeat(WHALE_GAP)}${padRight(text[index] ?? '', textWidth)}`, width),
  )

  for (const line of renderInfoLines(info, textWidth, theme, true)) {
    rows.push(fitLine(`${' '.repeat(TEXT_INDENT)}${padRight(line, textWidth)}`, width))
  }

  const tagline = renderTagline(info, WHALE_WIDTH)
  if (tagline !== null) rows.push(tagline)
  return rows
}

function renderWhaleOnly(info: HeaderInfo, width: number, theme: HeaderTheme): string[] {
  const pad = Math.max(0, Math.floor((width - WHALE_WIDTH) / 2))
  const rows = renderWhaleRows().map((row) => `${' '.repeat(pad)}${row}`)
  rows.push(fitLine(titleLine(info, theme), width))
  for (const line of renderInfoLines(info, width, theme, true)) rows.push(fitLine(line, width))
  const tagline = renderTagline(info, width)
  if (tagline !== null) rows.push(tagline)
  return rows
}

function renderTextHeader(info: HeaderInfo, width: number, theme: HeaderTheme): string[] {
  if (width < 16) return [fitLine(theme.fg('accent', info.name), width)]

  const lines = [fitLine(titleLine(info, theme), width)]
  if (width >= 40) lines.push(fitLine(theme.fg('dim', info.hints), width))
  for (const line of renderInfoLines(info, width, theme, width >= 40)) lines.push(fitLine(line, width))
  const tagline = renderTagline(info, width)
  if (tagline !== null) lines.push(tagline)
  return lines
}

function renderSplashText(info: HeaderInfo, width: number, theme: HeaderTheme): string[] {
  const lines = Array.from({ length: WHALE_ROWS }, () => '')
  lines[0] = `${whaleBlue('\u2726')} ${whaleBlue(theme.bold(info.name))}  ${theme.fg('dim', `v${info.version}`)}`

  const size = pickBigFont(width)
  if (size === null) {
    lines[2] = whaleBlue(theme.bold(DEEPSEEK))
    lines[4] = whaleBlue(theme.bold(HARNESS))
  } else {
    const deepseek = renderBigWord(DEEPSEEK, size)
    const harness = renderBigWord(HARNESS, size)
    for (let row = 0; row < 5; row += 1) {
      lines[1 + row] = whaleBlue(deepseek[row] ?? '')
      lines[7 + row] = whaleBlue(harness[row] ?? '')
    }
  }

  return lines.map((line) => fitLine(line, width))
}

function pickBigFont(width: number): BigFontSize | null {
  if (width >= bigWordWidth(DEEPSEEK, 'large')) return 'large'
  if (width >= bigWordWidth(DEEPSEEK, 'compact')) return 'compact'
  return null
}

function renderInfoLines(
  info: HeaderInfo,
  width: number,
  theme: HeaderTheme,
  includeTip: boolean,
): string[] {
  const lines: string[] = []
  if (info.model !== undefined && info.model.length > 0) {
    const effort = info.effort === undefined ? '' : ` \u00b7 ${capitalize(info.effort)} effort`
    lines.push(`${theme.fg('text', info.model)}${theme.fg('dim', effort)}`)
  }
  if (info.cwd !== undefined && info.cwd.length > 0) {
    lines.push(theme.fg('dim', info.cwd))
  }
  if (includeTip && info.tip !== undefined && info.tip.length > 0) {
    lines.push(theme.fg('dim', `Tip: ${info.tip}`))
  }
  return lines.map((line) => fitLine(line, width))
}

function renderTagline(info: HeaderInfo, width: number): string | null {
  if (info.tagline === undefined || info.tagline.length === 0) return null
  const text = fitLine(whaleBlue(info.tagline), width)
  const pad = Math.max(0, Math.floor((width - visibleWidth(text)) / 2))
  return `${' '.repeat(pad)}${text}`
}

function titleLine(info: HeaderInfo, theme: HeaderTheme): string {
  return `${whaleBlue(theme.bold(info.name))} ${theme.fg('dim', info.version)}`
}

function capitalize(text: string): string {
  return text.length === 0 ? text : text[0]?.toUpperCase() + text.slice(1)
}

export class DshHeader implements Component {
  readonly #info: HeaderInfo
  readonly #theme: Theme | (() => Theme)
  readonly #logo: boolean

  constructor(info: HeaderInfo, theme: Theme | (() => Theme), logo = true) {
    this.#info = info
    this.#theme = theme
    this.#logo = logo
  }

  render(width: number): string[] {
    return renderHeader(this.#info, width, this.#currentTheme(), this.#logo)
  }

  invalidate(): void {}

  #currentTheme(): Theme {
    return typeof this.#theme === 'function' ? this.#theme() : this.#theme
  }
}

export function createHeaderFactory(
  info: HeaderInfo,
  getTheme?: () => Theme,
  logo = true,
): (tui: TUI, theme: Theme) => DshHeader {
  return (_tui: TUI, theme: Theme) => new DshHeader(info, getTheme ?? (() => theme), logo)
}
