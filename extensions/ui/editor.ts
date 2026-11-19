/**
 * Editor appearance.
 *
 * Subclass `CustomEditor` so app keybindings, autocomplete, paste handling and
 * IME support stay intact. The only change is the dsh prompt glyph on the first
 * content line: the first two padding cells become `❯ `.
 */
import { CustomEditor } from '@earendil-works/pi-coding-agent'
import type { ExtensionContext, KeybindingsManager } from '@earendil-works/pi-coding-agent'
import type { EditorTheme, TUI } from '@earendil-works/pi-tui'

type EditorFactory = NonNullable<Parameters<ExtensionContext['ui']['setEditorComponent']>[0]>

export interface EditorUi {
  getEditorComponent(): EditorFactory | undefined
  setEditorComponent(factory: EditorFactory | undefined): void
}

let installed: EditorFactory | undefined
let installedEmbed: boolean | undefined

const PREFIX_COLS = 2

/**
 * Replace the first `padding` cells of the first content line with `prefix `.
 * At least two padding cells are required, so the glyph and its trailing space
 * both fit; narrower layouts are left untouched instead of shifting text.
 */
export function applyPromptPrefix(
  lines: readonly string[],
  prefix: string,
  color: (text: string) => string,
  padding = PREFIX_COLS,
): string[] {
  const copy = [...lines]
  const cells = Math.max(0, Math.floor(padding))
  const firstContent = copy[1]
  if (cells < PREFIX_COLS || copy.length <= 2 || firstContent === undefined) return copy
  const pad = ' '.repeat(cells)
  if (!firstContent.startsWith(pad)) return copy
  copy[1] = `${color(prefix)}${pad.slice(1)}${firstContent.slice(cells)}`
  return copy
}

export class DshEditor extends CustomEditor {
  readonly #prefix: string

  constructor(
    tui: TUI,
    theme: EditorTheme,
    keybindings: KeybindingsManager,
    prefix: string,
    embedWorkingStatus: boolean,
  ) {
    super(tui, theme, keybindings, { embedWorkingStatus })
    this.#prefix = prefix
  }

  override render(width: number): string[] {
    // Editor.render() reads its private paddingX directly; calling the public
    // setPaddingX() here would request a render on every frame. Keep one
    // guarded private write (restored in finally) and read the base value via
    // the public getter. If the field ever disappears, render without a prefix
    // instead of throwing.
    const saved = this.getPaddingX()
    // SAFETY: pi-tui's Editor keeps paddingX private but Editor.render reads it
    // directly; the field is a number on every supported version, and the write
    // below is restored in finally. Verified by the typeof guard.
    const internals = this as unknown as { paddingX?: number }
    if (typeof internals.paddingX !== 'number') return super.render(width)
    internals.paddingX = saved + PREFIX_COLS
    try {
      return applyPromptPrefix(
        super.render(width),
        this.#prefix,
        (text) => this.borderColor(text),
        PREFIX_COLS,
      )
    } finally {
      internals.paddingX = saved
    }
  }
}

export function createEditorFactory(prefix: string, embedWorkingStatus: boolean): EditorFactory {
  const glyph = Array.from(prefix)[0] ?? '\u276f'
  const factory: EditorFactory = (tui, theme, keybindings) =>
    new DshEditor(tui, theme, keybindings, glyph, embedWorkingStatus)
  return factory
}

/** Install the editor, replacing our own factory when it is already active. */
export function installEditor(ui: EditorUi, prefix: string, embedWorkingStatus = true): void {
  const current = ui.getEditorComponent()
  if (
    installed !== undefined &&
    current === installed &&
    installedEmbed === embedWorkingStatus
  ) {
    return
  }
  installed = createEditorFactory(prefix, embedWorkingStatus)
  installedEmbed = embedWorkingStatus
  ui.setEditorComponent(installed)
}
