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
