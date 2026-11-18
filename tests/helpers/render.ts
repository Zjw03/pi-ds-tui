import { visibleWidth, type Component } from '@earendil-works/pi-tui'

/** Render a component at one width and return its lines. */
export function renderAt(component: Component, width: number): string[] {
  return component.render(width)
}

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

/** Stable snapshot string for node:test comparisons. */
export function snapshot(component: Component, width: number): string {
  return renderAt(component, width).join('\n')
}
