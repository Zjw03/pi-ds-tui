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
  dim(text: string): string
  italic?(text: string): string
  underline?(text: string): string
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
  return theme.dim(text)
}

export function italic(theme: UiTheme, text: string): string {
  return theme.italic?.(text) ?? text
}

export function underline(theme: UiTheme, text: string): string {
  return theme.underline?.(text) ?? text
}
