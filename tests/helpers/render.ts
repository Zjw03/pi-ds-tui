import { visibleWidth } from '@earendil-works/pi-tui'

/** Throw when any rendered line exceeds the width the component was given. */
export function assertWidth(lines: readonly string[], width: number, label = 'render'): void {
  for (const [index, line] of lines.entries()) {
    const actual = visibleWidth(line)
    if (actual > width) {
      throw new Error(
        `${label}: line ${index + 1} is ${actual} cells, expected <= ${width}: ${JSON.stringify(line)}`,
      )
    }
  }
}
