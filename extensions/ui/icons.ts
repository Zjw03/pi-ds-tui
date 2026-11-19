/**
 * Shared glyphs. Kept in one place so each mark has a single meaning.
 * Mirrors the figures dsh-tui uses for transcript and tool rows.
 */

/** Activity bullet: ring on macOS, solid dot elsewhere. */
export const BLACK_CIRCLE = process.platform === 'darwin' ? '\u23fa' : '\u25cf'

/** Success checkmark. */
export const TICK = '\u2713'

/** Settled tool-status dot. */
export const BULLET = '\u2022'

/** Failed tool status. */
export const MULTIPLICATION_X = '\u2717'
