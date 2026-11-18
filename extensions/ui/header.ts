/**
 * Startup header.
 *
 * Wide terminals get the 13-row DeepSeek pixel whale beside a text column;
 * medium terminals get the whale with a title line below; narrow terminals
 * fall back to the plain name/version/hints block. `logo: false` always uses
 * the text block.
 */
import type { Component, TUI } from '@earendil-works/pi-tui'
import type { Theme } from '@earendil-works/pi-coding-agent'
import { fitLine, padRight } from './text.ts'
import { renderWhaleRows, WHALE_ROWS, WHALE_WIDTH } from './whale.ts'

export interface HeaderInfo {
  readonly name: string
  readonly version: string
  readonly hints: string
}

export interface HeaderTheme {
  fg(color: string, text: string): string
  bold(text: string): string
}

const WHALE_GAP = 2

export function renderHeader(
  info: HeaderInfo,
  width: number,
  theme: HeaderTheme,
  logo = true,
): string[] {
  if (width <= 0) return []

  if (logo) {
    const whale = renderWhaleRows()
    if (width >= WHALE_WIDTH + WHALE_GAP + 12) {
      const textWidth = width - WHALE_WIDTH - WHALE_GAP
      return composeWhale(whale, renderTextColumn(info, theme), textWidth, width)
    }
    if (width >= WHALE_WIDTH) {
      const pad = Math.max(0, Math.floor((width - WHALE_WIDTH) / 2))
      return [
        ...whale.map((row) => ' '.repeat(pad) + row),
        fitLine(titleLine(info, theme), width),
      ]
    }
  }

  return renderTextHeader(info, width, theme)
}

function renderTextHeader(info: HeaderInfo, width: number, theme: HeaderTheme): string[] {
  if (width < 16) return [fitLine(theme.fg('accent', info.name), width)]
  const title = titleLine(info, theme)
  if (width < 40) return [fitLine(title, width)]
  return [fitLine(title, width), fitLine(theme.fg('dim', info.hints), width)]
}

function titleLine(info: HeaderInfo, theme: HeaderTheme): string {
  return `${theme.bold(theme.fg('accent', info.name))} ${theme.fg('dim', info.version)}`
}

function renderTextColumn(info: HeaderInfo, theme: HeaderTheme): string[] {
  const lines = Array.from({ length: WHALE_ROWS }, () => '')
  lines[1] = `${theme.fg('accent', '\u2726')} ${theme.bold(theme.fg('accent', info.name))}`
  lines[2] = theme.fg('dim', info.version)
  lines[4] = theme.bold(theme.fg('accent', 'DEEPSEEK HARNESS'))
  lines[6] = theme.fg('dim', info.hints)
  return lines
}

function composeWhale(
  whale: readonly string[],
  text: readonly string[],
  textWidth: number,
  width: number,
): string[] {
  return whale.map((row, index) =>
    fitLine(`${row}${' '.repeat(WHALE_GAP)}${padRight(text[index] ?? '', textWidth)}`, width),
  )
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
