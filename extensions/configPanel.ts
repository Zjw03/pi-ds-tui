/**
 * `/ds-config`: a settings list for `~/.pi/agent/pi-ds-tui.json`.
 *
 * Every change is written to disk immediately, preserving keys this version
 * does not know about. The panel closes on Esc; the caller reloads so the new
 * values take effect.
 */
import { Container, SettingsList, Text } from '@earendil-works/pi-tui'
import type { Component, SettingItem, SettingsListTheme } from '@earendil-works/pi-tui'
import type { Theme } from '@earendil-works/pi-coding-agent'
import {
  DEFAULT_CONFIG,
  writeConfigObject,
} from './config.ts'

export type FieldKind = 'boolean' | 'enum' | 'number'

export interface ConfigField {
  readonly id: string
  readonly path: readonly string[]
  readonly label: string
  readonly description: string
  readonly kind: FieldKind
  readonly values: readonly string[]
}

const ON_OFF = ['on', 'off'] as const

export const CONFIG_FIELDS: readonly ConfigField[] = [
  {
    id: 'enabled',
    path: ['enabled'],
    label: 'pi-ds-tui',
    description: 'Master switch. Off restores every pi default.',
    kind: 'boolean',
    values: ON_OFF,
  },
  {
    id: 'header.enabled',
    path: ['header', 'enabled'],
    label: 'Header',
    description: 'Whale, wordmark, model and cwd banner.',
    kind: 'boolean',
    values: ON_OFF,
  },
  {
    id: 'header.logo',
    path: ['header', 'logo'],
    label: 'Header logo',
    description: 'Pixel whale and block wordmark. Off uses plain text.',
    kind: 'boolean',
    values: ON_OFF,
  },
  {
    id: 'footer.enabled',
    path: ['footer', 'enabled'],
    label: 'Footer',
    description: 'cwd, context, tokens, cache, cost, git, mode, effort, model.',
    kind: 'boolean',
    values: ON_OFF,
  },
  {
    id: 'editor.enabled',
    path: ['editor', 'enabled'],
    label: 'Editor prefix',
    description: 'The prompt glyph in front of the input box.',
    kind: 'boolean',
    values: ON_OFF,
  },
  {
    id: 'working.enabled',
    path: ['working', 'enabled'],
    label: 'Working row',
    description: 'Custom working message and spinner frames.',
    kind: 'boolean',
    values: ON_OFF,
  },
  {
    id: 'markdown.enabled',
    path: ['markdown', 'enabled'],
    label: 'Markdown transformer',
    description: 'Register the extension Markdown transformer at all.',
    kind: 'boolean',
    values: ON_OFF,
  },
  {
    id: 'markdown.mermaid',
    path: ['markdown', 'mermaid'],
    label: 'Diagram fences',
    description: 'Draw statediagram/classdiagram/erdiagram/sequencediagram fences.',
    kind: 'boolean',
    values: ON_OFF,
  },
  {
    id: 'toolCards.enabled',
    path: ['toolCards', 'enabled'],
    label: 'Tool cards',
    description: 'Custom cards for read, write, edit, bash, grep, find, ls.',
    kind: 'boolean',
    values: ON_OFF,
  },
  {
    id: 'toolCards.diffMode',
    path: ['toolCards', 'diffMode'],
    label: 'Diff mode',
    description: 'auto: two columns from 120 columns; split/unified force one layout.',
    kind: 'enum',
    values: ['auto', 'split', 'unified'],
  },
  {
    id: 'toolCards.collapsedLines',
    path: ['toolCards', 'collapsedLines'],
    label: 'Collapsed lines',
    description: 'Result lines shown before the expand hint.',
    kind: 'number',
    values: ['8', '12', '16', '24', '32', '48'],
  },
  {
    id: 'autocomplete.enabled',
    path: ['autocomplete', 'enabled'],
    label: 'Autocomplete',
    description: 'Extension autocomplete providers.',
    kind: 'boolean',
    values: ON_OFF,
  },
  {
    id: 'messages.enabled',
    path: ['messages', 'enabled'],
    label: 'Custom messages',
    description: 'Renderer for pi-ds-tui custom messages.',
    kind: 'boolean',
    values: ON_OFF,
  },
  {
    id: 'entries.enabled',
    path: ['entries', 'enabled'],
    label: 'Custom entries',
    description: 'Renderer for pi-ds-tui session entries.',
    kind: 'boolean',
    values: ON_OFF,
  },
  {
    id: 'mouse.enabled',
    path: ['mouse', 'enabled'],
    label: 'Mouse',
    description: 'Optional mouse handling; off by default.',
    kind: 'boolean',
    values: ON_OFF,
  },
]

const FIELDS_BY_ID = new Map(CONFIG_FIELDS.map((field) => [field.id, field]))

export function fieldById(id: string): ConfigField | undefined {
  return FIELDS_BY_ID.get(id)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A leaf value a config field can hold. */
type ConfigValue = string | number | boolean | null | undefined

function getAt(source: unknown, path: readonly string[]): ConfigValue {
  let node: unknown = source
  for (const key of path) {
    if (!isRecord(node)) return undefined
    node = node[key]
  }
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') return node
  return node === null ? null : undefined
}

function setAt(target: Record<string, unknown>, path: readonly string[], value: unknown): void {
  let node = target
  for (const key of path.slice(0, -1)) {
    const next = node[key]
    if (isRecord(next)) {
      node = next
      continue
    }
    const created: Record<string, unknown> = {}
    node[key] = created
    node = created
  }
  const last = path.at(-1)
  if (last !== undefined) node[last] = value
}

function parseValue(field: ConfigField, value: string): string | number | boolean {
  if (field.kind === 'boolean') return value === 'on'
  if (field.kind === 'number') {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return value
}

function displayValue(field: ConfigField, value: unknown): string {
  if (field.kind === 'boolean') return value === true ? 'on' : 'off'
  if (field.kind === 'number') {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
  }
  return typeof value === 'string' ? value : ''
}

/** Items for the list: values from the file, falling back to defaults. */
export function createConfigItems(draft: Record<string, unknown>): SettingItem[] {
  return CONFIG_FIELDS.map((field) => {
    const current = getAt(draft, field.path) ?? getAt(DEFAULT_CONFIG, field.path)
    return {
      id: field.id,
      label: field.label,
      description: field.description,
      currentValue: displayValue(field, current),
      values: [...field.values],
    }
  })
}

/** Apply one list value to the draft object. Unknown ids are ignored. */
export function applyFieldValue(draft: Record<string, unknown>, id: string, value: string): boolean {
  const field = fieldById(id)
  if (field === undefined) return false
  setAt(draft, field.path, parseValue(field, value))
  return true
}

export function settingsListTheme(theme: Theme): SettingsListTheme {
  return {
    label: (text, selected) => (selected ? theme.fg('accent', text) : text),
    value: (text, selected) => (selected ? theme.fg('accent', text) : theme.fg('muted', text)),
    description: (text) => theme.fg('dim', text),
    cursor: theme.fg('accent', '\u2192 '),
    hint: (text) => theme.fg('dim', text),
  }
}

export interface ConfigPanelOptions {
  readonly theme: Theme
  readonly path: string
  readonly draft: Record<string, unknown>
  /** Called after a successful write so the host can repaint. */
  readonly requestRender: () => void
  /** Resolves the custom component. */
  readonly done: (result: { readonly dirty: boolean }) => void
}

export class ConfigPanel extends Container {
  readonly #path: string
  readonly #draft: Record<string, unknown>
  readonly #theme: Theme
  readonly #status: Text
  readonly #list: SettingsList
  readonly #done: (result: { readonly dirty: boolean }) => void
  readonly #requestRender: () => void
  #dirty = false

  constructor(options: ConfigPanelOptions) {
    super()
    this.#path = options.path
    this.#draft = options.draft
    this.#theme = options.theme
    this.#done = options.done
    this.#requestRender = options.requestRender

    // Same shape as `/settings`: a rule, the list, an optional error line, a rule.
    this.addChild(new Rule(this.#theme))

    this.#list = new SettingsList(
      createConfigItems(this.#draft),
      Math.min(CONFIG_FIELDS.length, 12),
      settingsListTheme(this.#theme),
      (id, value) => this.#apply(id, value),
      () => this.#done({ dirty: this.#dirty }),
      { enableSearch: true },
    )
    this.addChild(this.#list)

    this.#status = new Text('', 0, 0)
    this.addChild(this.#status)
    this.addChild(new Rule(this.#theme))
  }

  #apply(id: string, value: string): void {
    if (!applyFieldValue(this.#draft, id, value)) return
    try {
      writeConfigObject(this.#path, this.#draft)
      this.#dirty = true
      this.#status.setText('')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.#status.setText(this.#theme.fg('error', `save failed: ${message}`))
    }
    this.#requestRender()
  }

  handleInput(data: string): void {
    this.#list.handleInput(data)
  }
}

/** Full-width rule, the same visual divider `/settings` uses above and below. */
export class Rule implements Component {
  readonly #theme: Theme

  constructor(theme: Theme) {
    this.#theme = theme
  }

  render(width: number): string[] {
    if (width <= 0) return []
    return [this.#theme.fg('borderMuted', '\u2500'.repeat(width))]
  }

  invalidate(): void {}
}
