import type { Theme, ToolRenderers } from '@earendil-works/pi-coding-agent'

/**
 * `ToolRenderContext` is not re-exported from the package root. Derive it from
 * the public `ToolRenderers` type instead of importing an internal path.
 */
export type ToolRenderContext = Parameters<NonNullable<ToolRenderers['renderCall']>>[2]

/** The subset of pi's Theme that tool cards use. */
export type CardTheme = Pick<Theme, 'fg' | 'bold'>
