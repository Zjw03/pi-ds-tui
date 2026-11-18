/**
 * Diff rendering for `edit` results.
 *
 * pi's edit tool returns a display-oriented diff: one row per line, shaped
 * `+123 content`, `-123 content`, ` 123 content`, or an elision row. Wide
 * terminals get two columns (removed | added); narrow ones stay single-column.
 */
import type { CardTheme } from './types.ts'
import { fitLine, padRight, visibleWidth } from '../ui/text.ts'

export type DiffRowKind = 'add' | 'remove' | 'context' | 'omit'

export interface DiffRow {
  readonly kind: DiffRowKind
  readonly number: string
  readonly content: string
}

export type DiffMode = 'auto' | 'split' | 'unified'

/** Single-column below this width, two columns above it (`auto` mode). */
export const SPLIT_MIN_WIDTH = 120

const DISPLAY_ROW = /^([+-\s])(\s*\d*)\s(.*)$/

/** Parse pi's display diff. Unrecognized rows are kept as context text. */
export function parseDisplayDiff(text: string): DiffRow[] {
  const rows: DiffRow[] = []
  for (const line of text.split(/\r?\n/)) {
    const match = DISPLAY_ROW.exec(line)
    if (!match) {
      if (line.length > 0) rows.push({ kind: 'context', number: '', content: line })
      continue
    }
    const marker = match[1]
    const content = match[3] ?? ''
    if (marker === '+') rows.push({ kind: 'add', number: (match[2] ?? '').trim(), content })
    else if (marker === '-') rows.push({ kind: 'remove', number: (match[2] ?? '').trim(), content })
    else if (content.trim().length === 0 && match[2]?.trim().length === 0) {
      rows.push({ kind: 'omit', number: '', content: content.trim() })
    } else if (content.trim() === '...') rows.push({ kind: 'omit', number: '', content: '' })
    else rows.push({ kind: 'context', number: (match[2] ?? '').trim(), content })
  }
  return rows
}

export function diffStats(rows: readonly DiffRow[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const row of rows) {
    if (row.kind === 'add') added++
    else if (row.kind === 'remove') removed++
  }
  return { added, removed }
}

const SIGN: Record<DiffRowKind, string> = {
  add: '+',
  remove: '-',
  context: ' ',
  omit: ' ',
}

function tokenFor(kind: DiffRowKind): 'toolDiffAdded' | 'toolDiffRemoved' | 'toolDiffContext' {
  if (kind === 'add') return 'toolDiffAdded'
  if (kind === 'remove') return 'toolDiffRemoved'
  return 'toolDiffContext'
}

function gutterWidth(rows: readonly DiffRow[]): number {
  let widest = 0
  for (const row of rows) widest = Math.max(widest, row.number.length)
  return Math.min(5, Math.max(3, widest))
}

function rowText(row: DiffRow, gutter: number): string {
  if (row.kind === 'omit') return '\u22ef'
  return `${SIGN[row.kind]}${row.number.padStart(gutter)} ${row.content.replace(/\t/g, '   ')}`
}

interface Side {
  readonly left: DiffRow | undefined
  readonly right: DiffRow | undefined
}

/** Pair removed rows with added rows, keeping context on both sides. */
function splitSides(rows: readonly DiffRow[]): Side[] {
  const sides: Side[] = []
  let index = 0
  while (index < rows.length) {
    const row = rows[index]
    if (row === undefined) break

    if (row.kind !== 'remove' && row.kind !== 'add') {
      sides.push({ left: row, right: row })
      index++
      continue
    }

    const removed: DiffRow[] = []
    const added: DiffRow[] = []
    while (index < rows.length) {
      const next = rows[index]
      if (next?.kind === 'remove') {
        removed.push(next)
        index++
        continue
      }
      if (next?.kind === 'add') {
        added.push(next)
        index++
        continue
      }
      break
    }

    const height = Math.max(removed.length, added.length)
    for (let offset = 0; offset < height; offset++) {
      sides.push({ left: removed[offset], right: added[offset] })
    }
  }
  return sides
}

export interface DiffRenderOptions {
  readonly theme: CardTheme
  readonly width: number
  readonly expanded: boolean
  readonly maxLines: number
  readonly mode: DiffMode
  /** Styled "(ctrl+o to expand)" fragment appended to the elision line. */
  readonly hint: string
}

/** Render a diff as width-safe lines, eliding rows when collapsed. */
export function renderDiff(rows: readonly DiffRow[], options: DiffRenderOptions): string[] {
  const { theme, width } = options
  if (width <= 0 || rows.length === 0) return []

  const limit = options.expanded ? rows.length : Math.max(1, options.maxLines)
  const visible = rows.length > limit ? rows.slice(0, limit) : rows
  const hidden = rows.length - visible.length
  const split = options.mode === 'split' || (options.mode === 'auto' && width >= SPLIT_MIN_WIDTH)

  const lines = split ? renderSplit(visible, options) : renderUnified(visible, options)

  if (hidden > 0) {
    const label = `\u2026 +${hidden} lines (${options.hint})`
    lines.push(fitLine(theme.fg('dim', label), width))
  }
  return lines
}

function renderUnified(rows: readonly DiffRow[], options: DiffRenderOptions): string[] {
  const { theme, width } = options
  const gutter = gutterWidth(rows)
  return rows.map((row) =>
    fitLine(theme.fg(tokenFor(row.kind), rowText(row, gutter)), width),
  )
}

function renderSplit(rows: readonly DiffRow[], options: DiffRenderOptions): string[] {
  const { theme, width } = options
  const gap = ' \u2502 '
  const column = Math.max(4, Math.floor((width - gap.length) / 2))
  const gutter = gutterWidth(rows)

  return splitSides(rows).map((side) => {
    const left = cell(side.left, gutter, column, theme)
    const right = cell(side.right, gutter, column, theme)
    return fitLine(`${left}${gap}${right}`, width)
  })
}

function cell(row: DiffRow | undefined, gutter: number, column: number, theme: CardTheme): string {
  if (row === undefined) return ' '.repeat(column)
  const text = rowText(row, gutter)
  const padded = padRight(text, column)
  if (visibleWidth(padded) < column) return padded
  return theme.fg(tokenFor(row.kind), padded)
}
