/**
 * Width-safe text helpers.
 *
 * Every rendered line must fit the width the TUI passes to `render()`. These
 * helpers measure terminal cells (not JS string length), so ANSI escapes,
 * combining characters, emoji and East Asian wide characters are handled by
 * pi-tui's shared utilities.
 */
import {
  sliceByColumn,
  stripTerminalSequences,
  truncateToWidth,
  visibleWidth,
} from '@earendil-works/pi-tui'

export { visibleWidth }

/** Truncate a single line to `width` cells, adding an ellipsis when needed. */
export function fitLine(text: string, width: number, ellipsis = '\u2026'): string {
  if (width <= 0) return ''
  return visibleWidth(text) <= width ? text : truncateToWidth(text, width, ellipsis)
}

/**
 * Truncate the middle of a line, keeping both ends (paths, commands, ids).
 * ANSI styles are stripped first; style the result at the call site.
 */
export function truncateMiddle(text: string, width: number, ellipsis = '\u2026'): string {
  const plain = stripTerminalSequences(text)
  const total = visibleWidth(plain)
  if (total <= width) return plain

  const mark = visibleWidth(ellipsis)
  if (width <= mark) return fitLine(plain, width, '')

  const available = width - mark
  const head = Math.ceil(available / 2)
  const tail = available - head
  const left = sliceByColumn(plain, 0, head)
  const right = tail > 0 ? sliceByColumn(plain, total - tail, tail) : ''
  return `${left}${ellipsis}${right}`
}

/** Pad a line with spaces to exactly `width` cells, truncating first if needed. */
export function padRight(text: string, width: number): string {
  const fitted = fitLine(text, width, '')
  const missing = width - visibleWidth(fitted)
  return missing > 0 ? `${fitted}${' '.repeat(missing)}` : fitted
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

/** Collapse newlines/tabs into single spaces (footer and one-line labels). */
export function sanitizeSingleLine(text: string): string {
  return text.replace(/[\r\n\t]+/g, ' ').replace(/ +/g, ' ').trim()
}
