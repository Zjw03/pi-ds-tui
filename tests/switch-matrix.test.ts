/**
 * X4 switch matrix.
 *
 * Every capability sits behind its own config switch, and the contract is that
 * turning one off removes exactly that capability: no registration, no event
 * listener, no UI hook. Each case loads a fresh copy of the extension with its
 * own HOME so `loadConfig()` sees that case's file.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

type Config = Record<string, unknown>

interface Registrations {
  readonly commands: string[]
  readonly events: Record<string, number>
  readonly markdownTransformers: number
  readonly toolRenderers: number
  readonly ui: {
    readonly footer: number
    readonly header: number
    readonly editor: number
    readonly working: number
  }
}

interface Harness {
  readonly registrations: Registrations
  readonly statusWrites: number
  readonly status: (key: string) => string | undefined
}

let caseId = 0

const CONFIG_DIR = join('.pi', 'agent')
const CONFIG_NAME = 'pi-ds-tui.json'

function configDir(home: string): string {
  return join(home, CONFIG_DIR)
}

async function loadExtension(config: Config | null): Promise<Harness> {
  const home = mkdtempSync(join(tmpdir(), 'pi-ds-tui-x4-'))
  mkdirSync(configDir(home), { recursive: true })
  if (config !== null) {
    writeFileSync(join(configDir(home), CONFIG_NAME), JSON.stringify(config), 'utf8')
  }

  process.env.HOME = home
  process.env.USERPROFILE = home

  const commands: string[] = []
  const events: Record<string, number> = {}
  let markdownTransformers = 0
  let toolRenderers = 0
  const ui = { footer: 0, header: 0, editor: 0, working: 0 }
  const statuses = new Map<string, string>()
  let statusWrites = 0

  const uiContext = {
    theme: { fg: (_color: string, text: string) => text, bold: (text: string) => text },
    setFooter: () => {
      ui.footer++
    },
    setHeader: () => {
      ui.header++
    },
    getEditorComponent: () => undefined,
    setEditorComponent: () => {
      ui.editor++
    },
    setWorkingMessage: () => {
      ui.working++
    },
    setWorkingIndicator: () => {},
    setWorkingVisible: () => {},
    setStatus: (key: string, text: string | undefined) => {
      statusWrites++
      if (text === undefined) statuses.delete(key)
      else statuses.set(key, text)
    },
    notify: () => {},
    custom: async () => ({ dirty: false }),
  }

  const handlers = new Map<string, ((event: unknown, ctx: unknown) => unknown)[]>()
  const api = {
    registerCommand: (name: string) => {
      commands.push(name)
    },
    on: (event: string, handler: (event: unknown, ctx: unknown) => unknown) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler])
      events[event] = (events[event] ?? 0) + 1
    },
    registerToolRenderer: () => {
      toolRenderers++
    },
    registerMarkdownTransformer: () => {
      markdownTransformers++
    },
  } as unknown as ExtensionAPI

  const ctx = {
    hasUI: true,
    mode: 'tui',
    cwd: '/work',
    model: { id: 'model-x', provider: 'p' },
    thinkingLevel: 'high',
    getContextUsage: () => ({ percent: 10, contextWindow: 100, tokens: 10 }),
    sessionManager: { getEntryCount: () => 0, getEntries: () => [] },
    ui: uiContext,
  }

  const module = await import(`../extensions/index.ts?matrix=${++caseId}`)
  module.default(api)

  for (const handler of handlers.get('session_start') ?? []) await handler({}, ctx)

  return {
    registrations: {
      commands: [...commands].sort(),
      events,
      markdownTransformers,
      toolRenderers,
      ui,
    },
    statusWrites,
    status: (key) => statuses.get(key),
  }
}

function allOn(): Config {
  return {
    footer: { enabled: true },
    header: { enabled: true },
    editor: { enabled: true },
    working: { enabled: true },
    markdown: { enabled: true },
    toolCards: { enabled: true },
  }
}

function withSwitch(path: readonly string[]): Config {
  const config = allOn()
  let node: Record<string, unknown> = config
  for (const key of path.slice(0, -1)) {
    const next = node[key]
    node = typeof next === 'object' && next !== null ? (next as Record<string, unknown>) : {}
  }
  const last = path.at(-1)
  if (last !== undefined) node[last] = { enabled: false }
  return config
}

const DEFAULT_EVENTS = {
  session_start: 4,
  resources_discover: 1,
  model_select: 1,
  thinking_level_select: 1,
  agent_start: 1,
  turn_start: 1,
  message_update: 1,
  message_end: 1,
  agent_end: 1,
  session_shutdown: 1,
}

test('all switches on registers everything once', async () => {
  const { registrations } = await loadExtension(allOn())

  assert.deepEqual(registrations.commands, ['ds-config', 'ds-header', 'ds-ui'])
  assert.deepEqual(registrations.events, DEFAULT_EVENTS)
  assert.equal(registrations.markdownTransformers, 1)
  assert.equal(registrations.toolRenderers, 1)
  assert.deepEqual(registrations.ui, { footer: 1, header: 1, editor: 1, working: 1 })
})

test('master switch off leaves only the two always-available commands', async () => {
  const { registrations } = await loadExtension({ enabled: false })

  assert.deepEqual(registrations.commands, ['ds-config', 'ds-ui'])
  assert.deepEqual(registrations.events, {})
  assert.equal(registrations.markdownTransformers, 0)
  assert.equal(registrations.toolRenderers, 0)
  assert.deepEqual(registrations.ui, { footer: 0, header: 0, editor: 0, working: 0 })
})

test('every switch off is equivalent to the master switch', async () => {
  const off = {
    footer: { enabled: false },
    header: { enabled: false },
    editor: { enabled: false },
    working: { enabled: false },
    markdown: { enabled: false },
    toolCards: { enabled: false },
  }
  const { registrations } = await loadExtension(off)

  assert.deepEqual(registrations.commands, ['ds-config', 'ds-ui'])
  assert.deepEqual(registrations.events, {})
  assert.equal(registrations.markdownTransformers, 0)
  assert.equal(registrations.toolRenderers, 0)
  assert.deepEqual(registrations.ui, { footer: 0, header: 0, editor: 0, working: 0 })
})

test('footer switch removes only the footer', async () => {
  const { registrations } = await loadExtension(withSwitch(['footer']))

  assert.equal(registrations.ui.footer, 0)
  assert.equal(registrations.ui.header, 1)
  assert.equal(registrations.ui.editor, 1)
  assert.equal(registrations.ui.working, 1)
  assert.equal(registrations.events.session_start, 3)
  assert.equal(registrations.toolRenderers, 1)
})

test('header switch removes the header, its refresh listeners and /ds-header', async () => {
  const { registrations } = await loadExtension(withSwitch(['header']))

  assert.deepEqual(registrations.commands, ['ds-config', 'ds-ui'])
  assert.equal(registrations.ui.header, 0)
  assert.equal(registrations.events.session_start, 3)
  assert.equal(registrations.events.resources_discover, undefined)
  assert.equal(registrations.events.model_select, undefined)
  assert.equal(registrations.events.thinking_level_select, undefined)
  assert.equal(registrations.ui.footer, 1)
})

test('editor switch removes only the editor factory', async () => {
  const { registrations } = await loadExtension(withSwitch(['editor']))

  assert.equal(registrations.ui.editor, 0)
  assert.equal(registrations.ui.footer, 1)
  assert.equal(registrations.ui.header, 1)
  assert.equal(registrations.ui.working, 1)
  assert.equal(registrations.events.session_start, 3)
})

test('working switch removes the row and its run listeners', async () => {
  const { registrations } = await loadExtension(withSwitch(['working']))

  assert.equal(registrations.ui.working, 0)
  assert.equal(registrations.ui.footer, 1)
  assert.equal(registrations.ui.header, 1)
  assert.equal(registrations.ui.editor, 1)
  assert.equal(registrations.events.session_start, 3)
  assert.equal(registrations.events.agent_start, undefined)
  assert.equal(registrations.events.message_update, undefined)
  assert.equal(registrations.events.agent_end, undefined)
})

test('markdown switch removes the transformer and nothing else', async () => {
  const { registrations } = await loadExtension(withSwitch(['markdown']))

  assert.equal(registrations.markdownTransformers, 0)
  assert.equal(registrations.toolRenderers, 1)
  assert.deepEqual(registrations.events, DEFAULT_EVENTS)
})

test('tool card switch removes the renderer and nothing else', async () => {
  const { registrations } = await loadExtension(withSwitch(['toolCards']))

  assert.equal(registrations.toolRenderers, 0)
  assert.equal(registrations.markdownTransformers, 1)
  assert.deepEqual(registrations.events, DEFAULT_EVENTS)
})

test('no unrelated event listeners are registered', async () => {
  const { registrations } = await loadExtension(allOn())
  const allowed = new Set(Object.keys(DEFAULT_EVENTS))
  for (const event of Object.keys(registrations.events)) {
    assert.ok(allowed.has(event), `unexpected listener: ${event}`)
  }
})

test('the extension never writes extension statuses', async () => {
  const { registrations, statusWrites, status } = await loadExtension(allOn())
  assert.equal(registrations.events.session_start, 4)
  assert.equal(statusWrites, 0)
  assert.equal(status('pi-ds-tui'), undefined)
})
