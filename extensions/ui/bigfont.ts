/**
 * Block wordmark for the header's text column.
 *
 * `large` is the 5-column slab face used by dsh-tui; `compact` is a 4-column
 * face so `DEEPSEEK` still fits beside the 40-column whale on an 80-column
 * terminal.
 */

type Glyph = readonly [string, string, string, string, string]

const LARGE: Record<string, Glyph> = {
  D: ['████·', '█···█', '█···█', '█···█', '████·'],
  E: ['█████', '█····', '████·', '█····', '█████'],
  P: ['████·', '█···█', '████·', '█····', '█····'],
  S: ['·████', '█····', '·███·', '····█', '████·'],
  K: ['█···█', '█··█·', '███··', '█··█·', '█···█'],
  H: ['█···█', '█···█', '█████', '█···█', '█···█'],
  A: ['·███·', '█···█', '█████', '█···█', '█···█'],
  R: ['████·', '█···█', '████·', '█··█·', '█···█'],
  N: ['█···█', '██··█', '█·█·█', '█··██', '█···█'],
  I: ['█████', '··█··', '··█··', '··█··', '█████'],
}

const COMPACT: Record<string, Glyph> = {
  D: ['██▄ ', '█ █ ', '█ █ ', '█ █ ', '██▀ '],
  E: ['███ ', '█   ', '██  ', '█   ', '███ '],
  P: ['██▄ ', '█ █ ', '██▀ ', '█   ', '█   '],
  S: ['▄██ ', '█   ', '▀█▄ ', '  █ ', '██▀ '],
  K: ['█ █ ', '██  ', '█ █ ', '█ █ ', '█ █ '],
  H: ['█ █ ', '█ █ ', '███ ', '█ █ ', '█ █ '],
  A: ['▄█▄ ', '█ █ ', '███ ', '█ █ ', '█ █ '],
  R: ['██▄ ', '█ █ ', '██▀ ', '█ █ ', '█   '],
  N: ['█ █ ', '███ ', '█ █ ', '█ █ ', '█ █ '],
  I: ['███ ', ' █  ', ' █  ', ' █  ', '███ '],
}

const FALLBACK: Glyph = ['▄▄▄▄', '█  █', '█  █', '█  █', '▀▀▀▀']

export type BigFontSize = 'large' | 'compact'

export function bigWordWidth(word: string, size: BigFontSize): number {
  const glyphWidth = size === 'large' ? 5 : 4
  const gap = size === 'large' ? 1 : 0
  return word.length * glyphWidth + Math.max(0, word.length - 1) * gap
}

/** Render one word as five block rows; trailing padding is trimmed. */
export function renderBigWord(word: string, size: BigFontSize): string[] {
  const table = size === 'large' ? LARGE : COMPACT
  const gap = size === 'large' ? ' ' : ''
  const rows = ['', '', '', '', '']
  for (const [index, char] of [...word].entries()) {
    const glyph = table[char] ?? FALLBACK
    for (let row = 0; row < 5; row += 1) {
      rows[row] += `${index === 0 ? '' : gap}${glyph[row] ?? ''}`
    }
  }
  return rows.map((row) => row.replace(/\s+$/u, ''))
}
