/**
 * Theme helpers.
 *
 * Components receive pi's active theme through their factory/render arguments.
 * These wrappers keep the call sites short and tolerate older theme objects
 * that do not implement every style helper.
 */

export interface UiTheme {
  readonly colors: Readonly<Record<string, unknown>>
  fg(color: string, text: string): string
  bg(color: string, text: string): string
  bold(text: string): string
  italic?(text: string): string
  underline?(text: string): string
}

/** Wrap text in a 24-bit foreground color (`#rrggbb`). */
export function hexFg(hex: string): (text: string) => string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (match === null) return (text) => text
  const value = Number.parseInt(match[1] ?? '', 16)
  const red = (value >> 16) & 0xff
  const green = (value >> 8) & 0xff
  const blue = value & 0xff
  return (text: string) => `\x1b[38;2;${red};${green};${blue}m${text}\x1b[39m`
}

export function fg(theme: UiTheme, token: string, text: string): string {
  return theme.fg(token, text)
}

export function bg(theme: UiTheme, token: string, text: string): string {
  return theme.bg(token, text)
}

export function bold(theme: UiTheme, text: string): string {
  return theme.bold(text)
}

export function dim(theme: UiTheme, text: string): string {
  return theme.fg('dim', text)
}

export function italic(theme: UiTheme, text: string): string {
  return theme.italic?.(text) ?? text
}

export function underline(theme: UiTheme, text: string): string {
  return theme.underline?.(text) ?? text
}
