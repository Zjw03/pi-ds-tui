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
let previous: EditorFactory | undefined

const PREFIX_COLS = 2

/** Replace the first two padding cells of the first content line with `prefix `. */
export function applyPromptPrefix(
  lines: readonly string[],
  prefix: string,
  color: (text: string) => string,
): string[] {
  const copy = [...lines]
  const firstContent = copy[1]
  if (copy.length > 2 && firstContent !== undefined && firstContent.startsWith('  ')) {
    copy[1] = `${color(prefix)} ${firstContent.slice(PREFIX_COLS)}`
  }
  return copy
}

export class DshEditor extends CustomEditor {
  readonly #prefix: string

  constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager, prefix: string) {
    super(tui, theme, keybindings)
    this.#prefix = prefix
  }

  override render(width: number): string[] {
    // SAFETY: Editor keeps paddingX private; this subclass only reads and
    // restores it around the super.render call, so it is always a number.
    const self = this as unknown as { paddingX: number } // SAFETY: Editor's private paddingX is a number; we only read and restore it around super.render.
    const saved = self.paddingX
    self.paddingX = saved + PREFIX_COLS
    try {
      return applyPromptPrefix(super.render(width), this.#prefix, (text) => this.borderColor(text))
    } finally {
      self.paddingX = saved
    }
  }
}

export function createEditorFactory(prefix: string): EditorFactory {
  const glyph = Array.from(prefix)[0] ?? '\u276f'
  const factory: EditorFactory = (tui, theme, keybindings) =>
    new DshEditor(tui, theme, keybindings, glyph)
  return factory
}

/** Install the editor, remembering the factory that owned the slot before us. */
export function installEditor(ui: EditorUi, prefix: string): void {
  const current = ui.getEditorComponent()
  if (installed !== undefined && current === installed) return
  previous = current
  installed = createEditorFactory(prefix)
  ui.setEditorComponent(installed)
}

/** Put the previous editor factory back. */
export function restoreEditor(ui: EditorUi): void {
  if (installed === undefined) return
  ui.setEditorComponent(previous)
  installed = undefined
  previous = undefined
}
