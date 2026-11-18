/**
 * Startup header. Two lines on wide terminals, one line on narrow ones:
 * name + version, then the key hints dsh-tui shows at the top.
 */
import type { Component, TUI } from '@earendil-works/pi-tui'
import type { Theme } from '@earendil-works/pi-coding-agent'
import { fitLine } from './text.ts'

export interface HeaderInfo {
  readonly name: string
  readonly version: string
  readonly hints: string
}

export interface HeaderTheme {
  fg(color: string, text: string): string
  bold(text: string): string
}

export function renderHeader(info: HeaderInfo, width: number, theme: HeaderTheme): string[] {
  if (width <= 0) return []
  if (width < 16) return [fitLine(theme.fg('accent', info.name), width)]

  const title = `${theme.bold(theme.fg('accent', info.name))} ${theme.fg('dim', info.version)}`
  if (width < 40) return [fitLine(title, width)]

  return [fitLine(title, width), fitLine(theme.fg('dim', info.hints), width)]
}

export class DshHeader implements Component {
  readonly #info: HeaderInfo
  readonly #theme: Theme | (() => Theme)

  constructor(info: HeaderInfo, theme: Theme | (() => Theme)) {
    this.#info = info
    this.#theme = theme
  }

  render(width: number): string[] {
    return renderHeader(this.#info, width, this.#currentTheme())
  }

  invalidate(): void {}

  #currentTheme(): Theme {
    return typeof this.#theme === 'function' ? this.#theme() : this.#theme
  }
}

export function createHeaderFactory(
  info: HeaderInfo,
  getTheme?: () => Theme,
): (tui: TUI, theme: Theme) => DshHeader {
  return (_tui: TUI, theme: Theme) => new DshHeader(info, getTheme ?? (() => theme))
}
