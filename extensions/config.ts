/**
 * pi-ds-tui configuration.
 *
 * The file lives at `~/.pi/agent/pi-ds-tui.json`. Missing files mean defaults;
 * malformed files fall back to defaults and report warnings instead of
 * throwing. Unknown keys are ignored with a warning so older/newer configs
 * never break startup.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const CONFIG_FILE = 'pi-ds-tui.json'

export type DiffMode = 'auto' | 'split' | 'unified'

export interface FooterConfig {
  readonly enabled: boolean
  readonly chips: readonly string[]
  readonly narrowWidth: number
}

export interface HeaderConfig {
  readonly enabled: boolean
  readonly logo: boolean
}

export interface EditorConfig {
  readonly enabled: boolean
  readonly prefix: string
}

export interface WorkingConfig {
  readonly enabled: boolean
  readonly message: string | null
}

export interface MarkdownConfig {
  readonly enabled: boolean
  readonly mermaid: boolean
}

export interface ToolCardsConfig {
  readonly enabled: boolean
  readonly diffMode: DiffMode
  readonly collapsedLines: number
}

export interface DsUiConfig {
  readonly enabled: boolean
  readonly footer: FooterConfig
  readonly header: HeaderConfig
  readonly editor: EditorConfig
  readonly working: WorkingConfig
  readonly markdown: MarkdownConfig
  readonly toolCards: ToolCardsConfig
  readonly autocomplete: { readonly enabled: boolean }
  readonly messages: { readonly enabled: boolean }
  readonly entries: { readonly enabled: boolean }
  readonly mouse: { readonly enabled: boolean }
}

export const DEFAULT_CONFIG: DsUiConfig = deepFreeze({
  enabled: true,
  footer: {
    enabled: true,
    chips: ['model', 'context', 'tokens', 'cache', 'cost', 'git', 'effort', 'cwd'],
    narrowWidth: 60,
  },
  header: { enabled: true, logo: true },
  editor: { enabled: true, prefix: '\u276f' },
  working: { enabled: true, message: null },
  markdown: { enabled: true, mermaid: true },
  toolCards: { enabled: true, diffMode: 'auto', collapsedLines: 8 },
  autocomplete: { enabled: true },
  messages: { enabled: true },
  entries: { enabled: true },
  mouse: { enabled: false },
})

export interface ConfigLoadResult {
  readonly config: DsUiConfig
  readonly warnings: readonly string[]
  readonly path: string
  readonly found: boolean
}

export interface LoadConfigOptions {
  /** Override the config file path (tests). */
  readonly path?: string
  /** Override the home directory used to derive the default path. */
  readonly home?: string
  /** Override the file reader (tests). */
  readonly readFile?: (path: string) => string
}

export function configPath(home: string = homedir()): string {
  return join(home, '.pi', 'agent', CONFIG_FILE)
}

/**
 * Read the raw config object for editing. Unknown keys are preserved so a
 * panel edit never drops fields this version does not know about.
 * Missing or unreadable files read as an empty object.
 */
export function readConfigObject(path: string): Record<string, unknown> {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return {}
  }

  try {
    const parsed: unknown = JSON.parse(text)
    return isRecord(parsed) ? { ...parsed } : {}
  } catch {
    return {}
  }
}

/** Write the config object atomically: temp file first, then rename. */
export function writeConfigObject(path: string, value: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.tmp-${process.pid}`
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  renameSync(temp, path)
}

export function loadConfig(options: LoadConfigOptions = {}): ConfigLoadResult {
  const path = options.path ?? configPath(options.home)
  const read = options.readFile ?? ((file: string) => readFileSync(file, 'utf8'))
  const warnings: string[] = []

  let text: string
  try {
    text = read(path)
  } catch (error) {
    if (isMissingFile(error)) {
      return { config: DEFAULT_CONFIG, warnings, path, found: false }
    }
    warnings.push(`${path}: ${messageOf(error)}; using defaults`)
    return { config: DEFAULT_CONFIG, warnings, path, found: false }
  }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (error) {
    warnings.push(`${path}: invalid JSON (${messageOf(error)}); using defaults`)
    return { config: DEFAULT_CONFIG, warnings, path, found: true }
  }

  if (!isRecord(raw)) {
    warnings.push(`${path}: expected a JSON object; using defaults`)
    return { config: DEFAULT_CONFIG, warnings, path, found: true }
  }

  checkUnknown(raw, TOP_LEVEL_KEYS, 'config', warnings)

  const config = deepFreeze<DsUiConfig>({
    enabled: readBoolean(raw, 'enabled', DEFAULT_CONFIG.enabled, 'config', warnings),
    footer: readFooter(raw, warnings),
    header: readHeader(raw, warnings),
    editor: readEditor(raw, warnings),
    working: readWorking(raw, warnings),
    markdown: readMarkdown(raw, warnings),
    toolCards: readToolCards(raw, warnings),
    autocomplete: { enabled: readSectionBoolean(raw, 'autocomplete', 'enabled', true, warnings) },
    messages: { enabled: readSectionBoolean(raw, 'messages', 'enabled', true, warnings) },
    entries: { enabled: readSectionBoolean(raw, 'entries', 'enabled', true, warnings) },
    mouse: { enabled: readSectionBoolean(raw, 'mouse', 'enabled', false, warnings) },
  })

  return { config, warnings, path, found: true }
}

const TOP_LEVEL_KEYS = new Set([
  'enabled',
  'footer',
  'header',
  'editor',
  'working',
  'markdown',
  'toolCards',
  'autocomplete',
  'messages',
  'entries',
  'mouse',
])

const FOOTER_KEYS = new Set(['enabled', 'chips', 'narrowWidth'])
const HEADER_KEYS = new Set(['enabled', 'logo'])
const EDITOR_KEYS = new Set(['enabled', 'prefix'])
const WORKING_KEYS = new Set(['enabled', 'message'])
const MARKDOWN_KEYS = new Set(['enabled', 'mermaid'])
const TOOL_CARDS_KEYS = new Set(['enabled', 'diffMode', 'collapsedLines'])
const SIMPLE_SECTION_KEYS = new Set(['enabled'])

function readFooter(root: Record<string, unknown>, warnings: string[]): FooterConfig {
  const section = readObject(root, 'footer', warnings)
  checkUnknown(section, FOOTER_KEYS, 'footer', warnings)
  return {
    enabled: readBoolean(section, 'enabled', DEFAULT_CONFIG.footer.enabled, 'footer', warnings),
    chips: readStringArray(section, 'chips', DEFAULT_CONFIG.footer.chips, 'footer', warnings),
    narrowWidth: readNumber(section, 'narrowWidth', DEFAULT_CONFIG.footer.narrowWidth, 'footer', warnings, 20),
  }
}

function readHeader(root: Record<string, unknown>, warnings: string[]): HeaderConfig {
  const section = readObject(root, 'header', warnings)
  checkUnknown(section, HEADER_KEYS, 'header', warnings)
  return {
    enabled: readBoolean(section, 'enabled', DEFAULT_CONFIG.header.enabled, 'header', warnings),
    logo: readBoolean(section, 'logo', DEFAULT_CONFIG.header.logo, 'header', warnings),
  }
}

function readEditor(root: Record<string, unknown>, warnings: string[]): EditorConfig {
  const section = readObject(root, 'editor', warnings)
  checkUnknown(section, EDITOR_KEYS, 'editor', warnings)
  return {
    enabled: readBoolean(section, 'enabled', DEFAULT_CONFIG.editor.enabled, 'editor', warnings),
    prefix: readString(section, 'prefix', DEFAULT_CONFIG.editor.prefix, 'editor', warnings),
  }
}

function readWorking(root: Record<string, unknown>, warnings: string[]): WorkingConfig {
  const section = readObject(root, 'working', warnings)
  checkUnknown(section, WORKING_KEYS, 'working', warnings)
  return {
    enabled: readBoolean(section, 'enabled', DEFAULT_CONFIG.working.enabled, 'working', warnings),
    message: readNullableString(section, 'message', DEFAULT_CONFIG.working.message, 'working', warnings),
  }
}

function readMarkdown(root: Record<string, unknown>, warnings: string[]): MarkdownConfig {
  const section = readObject(root, 'markdown', warnings)
  checkUnknown(section, MARKDOWN_KEYS, 'markdown', warnings)
  return {
    enabled: readBoolean(section, 'enabled', DEFAULT_CONFIG.markdown.enabled, 'markdown', warnings),
    mermaid: readBoolean(section, 'mermaid', DEFAULT_CONFIG.markdown.mermaid, 'markdown', warnings),
  }
}

function readToolCards(root: Record<string, unknown>, warnings: string[]): ToolCardsConfig {
  const section = readObject(root, 'toolCards', warnings)
  checkUnknown(section, TOOL_CARDS_KEYS, 'toolCards', warnings)
  return {
    enabled: readBoolean(section, 'enabled', DEFAULT_CONFIG.toolCards.enabled, 'toolCards', warnings),
    diffMode: readEnum(
      section,
      'diffMode',
      DEFAULT_CONFIG.toolCards.diffMode,
      ['auto', 'split', 'unified'] as const,
      'toolCards',
      warnings,
    ),
    collapsedLines: readNumber(
      section,
      'collapsedLines',
      DEFAULT_CONFIG.toolCards.collapsedLines,
      'toolCards',
      warnings,
      1,
    ),
  }
}

function readSectionBoolean(
  root: Record<string, unknown>,
  sectionKey: string,
  key: string,
  fallback: boolean,
  warnings: string[],
): boolean {
  const section = readObject(root, sectionKey, warnings)
  checkUnknown(section, SIMPLE_SECTION_KEYS, sectionKey, warnings)
  return readBoolean(section, key, fallback, sectionKey, warnings)
}

function readObject(
  root: Record<string, unknown>,
  key: string,
  warnings: string[],
): Record<string, unknown> {
  const value = root[key]
  if (value === undefined) return {}
  if (!isRecord(value)) {
    warnings.push(`${key}: expected an object`)
    return {}
  }
  return value
}

function readBoolean(
  record: Record<string, unknown>,
  key: string,
  fallback: boolean,
  path: string,
  warnings: string[],
): boolean {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') {
    warnings.push(`${path}.${key}: expected boolean`)
    return fallback
  }
  return value
}

function readString(
  record: Record<string, unknown>,
  key: string,
  fallback: string,
  path: string,
  warnings: string[],
): string {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'string') {
    warnings.push(`${path}.${key}: expected string`)
    return fallback
  }
  return value
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
  fallback: string | null,
  path: string,
  warnings: string[],
): string | null {
  const value = record[key]
  if (value === undefined) return fallback
  if (value === null) return null
  if (typeof value !== 'string') {
    warnings.push(`${path}.${key}: expected string or null`)
    return fallback
  }
  return value
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
  fallback: number,
  path: string,
  warnings: string[],
  min: number,
): number {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) {
    warnings.push(`${path}.${key}: expected a number >= ${min}`)
    return fallback
  }
  return Math.floor(value)
}

function readStringArray(
  record: Record<string, unknown>,
  key: string,
  fallback: readonly string[],
  path: string,
  warnings: string[],
): readonly string[] {
  const value = record[key]
  if (value === undefined) return fallback
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    warnings.push(`${path}.${key}: expected an array of strings`)
    return fallback
  }
  return [...value] as string[]
}

function readEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  fallback: T,
  allowed: readonly T[],
  path: string,
  warnings: string[],
): T {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    warnings.push(`${path}.${key}: expected one of ${allowed.join(', ')}`)
    return fallback
  }
  return value as T
}

function checkUnknown(
  record: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
  warnings: string[],
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) warnings.push(`${path}: unknown key "${key}"`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { readonly code?: unknown }).code === 'ENOENT'
  )
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item)
    return Object.freeze(value) as T
  }
  if (isRecord(value)) {
    for (const key of Object.keys(value)) deepFreeze(value[key])
    return Object.freeze(value) as T
  }
  return value
}
