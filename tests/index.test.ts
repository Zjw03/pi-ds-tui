import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

// Keep the config lookup away from the developer's real ~/.pi/agent file.
const home = mkdtempSync(join(tmpdir(), 'pi-ds-tui-index-'))
process.env.HOME = home
process.env.USERPROFILE = home
const { default: piDsTui } = await import('../extensions/index.ts')

type Handler = (event: unknown, ctx: unknown) => unknown

function harness(): {
  commands: Map<string, unknown>
  events: Map<string, Handler[]>
  headerCalls: unknown[]
  markdownTransformers: unknown[]
  ctx: unknown
} {
  const commands = new Map<string, unknown>()
  const events = new Map<string, Handler[]>()
  const headerCalls: unknown[] = []
  const markdownTransformers: unknown[] = []
  const ui = {
    theme: { fg: (_color: string, text: string) => text, bold: (text: string) => text },
    setFooter: () => {},
    setHeader: (factory: unknown) => headerCalls.push(factory),
    getEditorComponent: () => undefined,
    setEditorComponent: () => {},
    setWorkingMessage: () => {},
    setWorkingIndicator: () => {},
    setWorkingVisible: () => {},
    setStatus: () => {},
    notify: () => {},
  }
  const ctx = {
    hasUI: true,
    mode: 'tui',
    cwd: '/work',
    model: { id: 'model-x', provider: 'p' },
    thinkingLevel: 'high',
    getContextUsage: () => ({ percent: 10, contextWindow: 100, tokens: 10 }),
    sessionManager: { getEntryCount: () => 0, getEntries: () => [] },
    ui,
  }
  return { commands, events, headerCalls, markdownTransformers, ctx }
}

function api(harnessed: ReturnType<typeof harness>): ExtensionAPI {
  // SAFETY: the extension only calls registerCommand/on/registerToolRenderer/
  // registerMarkdownTransformer.
  return {
    registerCommand: (name: string, options: unknown) => harnessed.commands.set(name, options),
    on: (event: string, handler: Handler) => {
      const list = harnessed.events.get(event) ?? []
      list.push(handler)
      harnessed.events.set(event, list)
    },
    registerToolRenderer: () => {},
    registerMarkdownTransformer: (transformer: unknown) =>
      harnessed.markdownTransformers.push(transformer),
  } as unknown as ExtensionAPI
}

test('header is re-applied after resources_discover', async () => {
  const h = harness()
  piDsTui(api(h))

  for (const handler of h.events.get('session_start') ?? []) await handler({}, h.ctx)
  assert.ok(h.headerCalls.length > 0)
  assert.ok(h.commands.has('ds-header'))
  assert.ok((h.events.get('model_select') ?? []).length > 0)
  assert.ok((h.events.get('thinking_level_select') ?? []).length > 0)

  // Simulate an extension loaded before us that sets its header asynchronously
  // after our session_start handler has already returned.
  h.headerCalls.push('feynman-header')
  for (const handler of h.events.get('resources_discover') ?? []) await handler({}, h.ctx)

  const last = h.headerCalls.at(-1)
  assert.notEqual(last, 'feynman-header')
  assert.equal(typeof last, 'function')
})

test('ds-header re-applies the header on demand', async () => {
  const h = harness()
  piDsTui(api(h))
  const command = h.commands.get('ds-header') as { handler: (args: string, ctx: unknown) => Promise<void> }
  h.headerCalls.push('other')
  await command.handler('', h.ctx)
  assert.equal(typeof h.headerCalls.at(-1), 'function')
})

test('markdown transformer is registered when enabled', () => {
  const h = harness()
  piDsTui(api(h))
  assert.equal(h.markdownTransformers.length, 1)
})
