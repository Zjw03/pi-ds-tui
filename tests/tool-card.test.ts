import test from 'node:test'
import assert from 'node:assert/strict'
import type { AgentToolResult } from '@earendil-works/pi-coding-agent'
import { DEFAULT_CONFIG } from '../extensions/config.ts'
import { createReadRenderer } from '../extensions/transcript/tool-card.ts'
import { ReadCallCard, formatDuration, readArgs } from '../extensions/transcript/tool-call.ts'
import { ReadResultCard, toolResultText } from '../extensions/transcript/tool-result.ts'
import type { ToolRenderContext } from '../extensions/transcript/types.ts'
import { assertWidth } from './helpers/render.ts'

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
  dim: (text: string) => text,
}

function context(overrides: Partial<Record<string, unknown>> = {}): ToolRenderContext {
  return {
    args: {},
    toolCallId: 'call-1',
    invalidate: () => {},
    lastComponent: undefined,
    state: {},
    cwd: '/work',
    executionStarted: true,
    argsComplete: true,
    isPartial: false,
    expanded: false,
    showImages: false,
    isError: false,
    durationMs: 1234,
    outputPad: 0,
    keyText: () => 'ctrl+o',
    keyHint: (_binding: string, description: string) => `ctrl+o ${description}`,
    ...overrides,
  } as unknown as ToolRenderContext
}

function result(text: string, overrides: Partial<AgentToolResult<unknown>> = {}): AgentToolResult<unknown> {
  return { content: [{ type: 'text', text }], details: undefined, ...overrides }
}

test('readArgs decodes only the fields it uses', () => {
  assert.deepEqual(readArgs({ path: '/a', offset: 2, limit: 5 }), { path: '/a', offset: 2, limit: 5 })
  assert.deepEqual(readArgs({ path: 1 }), { path: null, offset: null, limit: null })
  assert.deepEqual(readArgs(null), { path: null, offset: null, limit: null })
})

test('read call card renders status, name, path and range', () => {
  const card = new ReadCallCard({ path: '/very/long/path/to/file.ts', offset: 10, limit: 20 }, theme, context())
  const lines = card.render(40)
  assertWidth(lines, 40)
  const text = lines.join('\n')
  assert.ok(text.includes('read'))
  assert.ok(text.includes(':10+20'))
  assert.ok(text.includes('\u00b7 1.2s'))
})

test('read call card shows partial and error status', () => {
  const partial = new ReadCallCard({ path: '/a' }, theme, context({ isPartial: true })).render(40)
  assert.ok(partial.join('\n').includes('\u25cf'))
  const error = new ReadCallCard({ path: '/a' }, theme, context({ isError: true })).render(40)
  assert.ok(error.join('\n').includes('\u2717'))
})

test('read result collapses long output and points at the expand key', () => {
  const text = Array.from({ length: 10 }, (_, index) => `line ${index}`).join('\n')
  const config = { ...DEFAULT_CONFIG.toolCards, collapsedLines: 5 }
  const lines = new ReadResultCard(result(text), { expanded: false, isPartial: false }, theme, context(), config).render(40)
  assertWidth(lines, 40)
  assert.equal(lines.length, 6)
  assert.ok(lines[5]?.includes('+5 lines'))
  assert.ok(lines[5]?.includes('ctrl+o to expand'))
})

test('read result shows everything when expanded', () => {
  const text = Array.from({ length: 10 }, (_, index) => `line ${index}`).join('\n')
  const config = { ...DEFAULT_CONFIG.toolCards, collapsedLines: 5 }
  const lines = new ReadResultCard(result(text), { expanded: true, isPartial: false }, theme, context(), config).render(40)
  assert.equal(lines.length, 10)
  assertWidth(lines, 40)
})

test('read result handles partial, error and empty results', () => {
  const config = { ...DEFAULT_CONFIG.toolCards, collapsedLines: 5 }
  const partial = new ReadResultCard(result('half'), { expanded: false, isPartial: true }, theme, context(), config)
  assert.ok(partial.render(40).join('\n').includes('reading'))
  const error = new ReadResultCard(
    result('boom', { isError: true }),
    { expanded: false, isPartial: false },
    theme,
    context(),
    config,
  )
  assert.ok(error.render(40)[0]?.includes('\u2717'))
  const empty = new ReadResultCard(result(''), { expanded: false, isPartial: false }, theme, context(), config)
  assert.ok(empty.render(40).join('\n').includes('(no output)'))
})

test('toolResultText joins text and image blocks', () => {
  const value = {
    content: [
      { type: 'text' as const, text: 'hello' },
      { type: 'image' as const, data: 'x', mimeType: 'image/png' },
    ],
    details: undefined,
  }
  assert.equal(toolResultText(value), 'hello\n[image image/png]')
})

test('formatDuration is compact', () => {
  assert.equal(formatDuration(12), '12ms')
  assert.equal(formatDuration(1234), '1.2s')
  assert.equal(formatDuration(120_000), '2m')
})

test('the resolver claims read and defers every other tool', () => {
  const resolver = createReadRenderer(DEFAULT_CONFIG.toolCards)
  const sentinel = { renderShell: 'self' as const }
  assert.equal(resolver('bash', () => sentinel), sentinel)
  const read = resolver('read', () => sentinel)
  assert.ok(read !== undefined)
  assert.equal(typeof read?.renderCall, 'function')
  assert.equal(typeof read?.renderResult, 'function')
})
