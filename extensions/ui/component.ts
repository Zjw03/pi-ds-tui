/**
 * Base class for pi-tui components.
 *
 * Subclasses implement `paint(width)` and return logical lines; this class
 * caches them by width and enforces the hard rule that every line fits.
 */
import type { Component } from '@earendil-works/pi-tui'
import { WidthCache } from './cache.ts'
import { fitLine } from './text.ts'

export abstract class BaseComponent implements Component {
  readonly #cache = new WidthCache<readonly string[]>()

  protected abstract paint(width: number): readonly string[]

  render(width: number): string[] {
    const safeWidth = Math.max(1, Math.floor(width))
    const lines = this.#cache.get(safeWidth, () =>
      this.paint(safeWidth).map((line) => fitLine(line, safeWidth)),
    )
    return [...lines]
  }

  invalidate(): void {
    this.#cache.clear()
  }
}
