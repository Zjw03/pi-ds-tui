/**
 * DeepSeek pixel whale, ported from dsh-tui's 25x40 sprite.
 *
 * The source art packs two vertical pixels into one terminal cell with the
 * half-block technique, so the 25-row sprite becomes 13 rows x 40 columns.
 * Palette: D outline, B body, L belly, W mouth, H heart, Z sleep-Z.
 */

type Rgb = readonly [number, number, number]

const PALETTE: Record<string, Rgb | undefined> = {
  D: [20, 38, 96],
  B: [78, 111, 255],
  L: [190, 225, 255],
  W: [255, 255, 255],
  H: [204, 51, 153],
  Z: [128, 128, 128],
}

const RESET = '\x1b[0m'
const BG_DEFAULT = '\x1b[49m'

const SPRITE = [
  '........................................',
  '........................................',
  '........................D...............',
  '.......................DBD.......D......',
  '.......................DBBD.....DBD.....',
  '.......................DBBBD..DDBBD.....',
  '.......................DBBBBDDBBBBD.....',
  '.......DDDDDDDDD........DBBBBBBBBD......',
  '......DBBBBBBBBBDD.......DBBBBBBBD......',
  '.....DBBBBBBBBBBBBDD.....DBBBBBDD.......',
  '....DBBBBBBBBBBBBBBBDD....DBBBD.........',
  '...DDBBBBBBBBBBBBBBBBBD..DBBBBD.........',
  '...DBBBBBBBBBBBBBBBBBBBDDBBBBBD.........',
  '...DBBBDBBBBBBDBBBBBBBBBBBBBBBD.........',
  '...DBBBDBBBBBBDBBBBBBBBBBBBBBD..........',
  '...DBBBBBBBBBBBBBBBBBBBBBBBBBD..........',
  '...DBBBBWWWWWWWBBBBBBBBDBBBBD...........',
  '...DDBWWWWWWWWWWWWBBBBBBDBBBD...........',
  '....DLLWWWWWWWWWWWWDBBBBDDBD............',
  '.....DLLLWWWWWWWWWWDBBBBBDD.............',
  '......DDLLLWWWWWWLLLDBBBBBDD............',
  '........DLLLLLLLLLLLDDBBBBBBD...........',
  '.........DDDDDDDDDDD..DDDDDDD...........',
  '........................................',
  '........................................',
] as const

export const WHALE_WIDTH = 40
export const WHALE_ROWS = Math.ceil(SPRITE.length / 2)

function fg(rgb: Rgb): string {
  return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`
}

function bg(rgb: Rgb): string {
  return `\x1b[48;2;${rgb[0]};${rgb[1]};${rgb[2]}m`
}

function pixel(x: number, y: number): Rgb | undefined {
  return PALETTE[SPRITE[y]?.[x] ?? '.'] ?? undefined
}

/** Render the static standard frame as 13 ANSI rows, each 40 cells wide. */
export function renderWhaleRows(): string[] {
  const rows: string[] = []
  for (let y = 0; y < SPRITE.length; y += 2) {
    let line = ''
    for (let x = 0; x < WHALE_WIDTH; x += 1) {
      const upper = pixel(x, y)
      const lower = pixel(x, y + 1)
      if (upper !== undefined && lower !== undefined) {
        line += `${fg(upper)}${bg(lower)}\u2580`
      } else if (upper !== undefined) {
        line += `${fg(upper)}${BG_DEFAULT}\u2580`
      } else if (lower !== undefined) {
        line += `${fg(lower)}${BG_DEFAULT}\u2584`
      } else {
        line += ' '
      }
    }
    rows.push(`${line}${RESET}`)
  }
  return rows
}
