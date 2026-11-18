/**
 * Width-keyed render cache.
 *
 * The TUI calls `render(width)` on every frame. Caching by width keeps
 * expensive layout work off the interactive path while staying correct across
 * resizes: a new width simply misses the cache.
 */
export class WidthCache<T> {
  readonly #entries = new Map<number, T>()

  get(width: number, compute: () => T): T {
    const cached = this.#entries.get(width)
    if (cached !== undefined) return cached
    const value = compute()
    this.#entries.set(width, value)
    return value
  }

  clear(): void {
    this.#entries.clear()
  }

  get size(): number {
    return this.#entries.size
  }
}
