/**
 * Small bordered panel shared by overlays. It owns the width contract: every
 * line is exactly `width` cells when a border fits, and plain truncated lines
 * on very narrow terminals.
 */
import type { Theme } from '@earendil-works/pi-coding-agent'
import { fitLine, padRight, wrapLines } from '../ui/text.ts'

export interface PanelTheme {
  fg(color: string, text: string): string
  bold(text: string): string
}

export function renderPanel(
  title: string,
  body: readonly string[],
  width: number,
  theme: PanelTheme,
): string[] {
  if (width <= 0) return []
  if (width < 8) {
    return [fitLine(title, width), ...body.map((line) => fitLine(line, width))]
  }

  const inner = width - 4
  const border = (text: string): string => theme.fg('border', text)
  const edge = border('\u2502')
  const lines: string[] = [
    border(`\u256d${'\u2500'.repeat(width - 2)}\u256e`),
    `${edge} ${padRight(theme.bold(fitLine(title, inner)), inner)} ${edge}`,
    border(`\u251c${'\u2500'.repeat(width - 2)}\u2524`),
  ]

  for (const raw of body) {
    const wrapped = raw.length === 0 ? [''] : wrapLines(raw, inner)
    for (const line of wrapped) {
      lines.push(`${edge} ${padRight(line, inner)} ${edge}`)
    }
  }

  lines.push(border(`\u2570${'\u2500'.repeat(width - 2)}\u256f`))
  return lines
}

export { fitLine, padRight, wrapLines }
export type { Theme }
