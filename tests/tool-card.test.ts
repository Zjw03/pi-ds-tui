import test from 'node:test'
import assert from 'node:assert/strict'
import type { AgentToolResult, Theme, ToolRenderers } from '@earendil-works/pi-coding-agent'
import { DEFAULT_CONFIG } from '../extensions/config.ts'
import { CLAIMED_TOOLS, createToolRenderers } from '../extensions/transcript/tool-card.ts'
import { ToolCallCard, describeCall } from '../extensions/transcript/tool-call.ts'
import { ToolResultCard, toolResultText } from '../extensions/transcript/tool-result.ts'
import {
  SPLIT_MIN_WIDTH,
  diffStats,
  parseDisplayDiff,
  renderDiff,
} from '../extensions/transcript/diff.ts'
import type { ToolRenderContext } from '../extensions/transcript/types.ts'
import { assertWidth } from './helpers/render.ts'

const CONFIG = DEFAULT_CONFIG.toolCards

interface ThemeSpy {
  readonly theme: Theme
  readonly calls: { color: string; text: string }[]
}

function themeSpy(): ThemeSpy {
  const calls: { color: string; text: string }[] = []
  const theme = {
    fg: (color: string, text: string) => {
      calls.push({ color, text })
      return text
    },
    bold: (text: string) => text,
  }
  return { theme: theme as unknown as Theme, calls }
}

function context(overrides: Partial<Record<string, unknown>> = {}): ToolRenderContext {
  // SAFETY: the cards read only these fields; the cast keeps the fixture small.
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

function callLines(toolName: string, args: unknown, width = 80, overrides = {}): string[] {
  const { theme } = themeSpy()
  return new ToolCallCard(toolName, args, theme, context(overrides)).render(width)
}

function resultLines(
  toolName: string,
  value: AgentToolResult<unknown>,
  overrides: Partial<Record<string, unknown>> = {},
  expanded = false,
): string[] {
  const { theme } = themeSpy()
  const ctx = context(overrides)
  const options = { expanded, isPartial: Boolean(overrides.isPartial) }
  return new ToolResultCard(toolName, value, options, theme, ctx, CONFIG).render(80)
}

test('resolver claims built-in tools and defers everything else', () => {
  const resolver = createToolRenderers(CONFIG)
  const sentinel: ToolRenderers = {
    renderCall: () => ({ render: () => [], invalidate: () => {} }),
  }

  for (const name of CLAIMED_TOOLS) {
    const renderers = resolver(name, () => sentinel)
    assert.ok(renderers !== sentinel, `${name} should be claimed`)
    assert.equal(typeof renderers?.renderCall, 'function')
    assert.equal(typeof renderers?.renderResult, 'function')
  }

  for (const name of ['task', 'mcp__server__tool', 'todo', 'ask_user_question']) {
    assert.equal(resolver(name, () => sentinel), sentinel, `${name} should defer`)
  }
})

test('read call shows path and range', () => {
  const text = callLines('read', { path: '/work/src/app.ts', offset: 10, limit: 20 }).join('\n')
  assert.match(text, /read/)
  assert.match(text, /src[\\/]app\.ts:10\+20/)
  assert.match(text, /1\.2s/)
})

test('write call shows line count, not the body', () => {
  const args = { path: '/work/a.md', content: 'one\ntwo\nthree' }
  const collapsed = callLines('write', args)
  assert.equal(collapsed.length, 1)
  assert.match(collapsed.join('\n'), /\+3 lines/)

  const expanded = callLines('write', args, 80, { expanded: true })
  assert.ok(expanded.length > 1)
  assert.match(expanded.join('\n'), /three/)
})

test('edit call reports the edit count', () => {
  const args = { path: '/work/a.ts', edits: [{ oldText: 'a', newText: 'b' }, { oldText: 'c', newText: 'd' }] }
  assert.match(callLines('edit', args).join('\n'), /2 edits/)
})

test('bash call keeps the tail of a long command', () => {
  const command = `echo ${'x'.repeat(200)} && npm run verify`
  const text = callLines('bash', { command }, 60).join('\n')
  assert.match(text, /npm run verify/)
  assert.doesNotMatch(text, /^echo/)
})

test('grep and find show the pattern and location', () => {
  assert.match(callLines('grep', { pattern: 'TODO', path: '/work/src' }).join('\n'), /TODO.*in src/)
  assert.match(callLines('find', { pattern: '*.ts', path: '/work/src' }).join('\n'), /\*\.ts.*in src/)
  assert.match(callLines('ls', { path: '/work/src' }).join('\n'), /src/)
})

test('call rows fit every width', () => {
  const cases: [string, unknown][] = [
    ['read', { path: '/work/' + 'very/long/'.repeat(8) + 'file.ts', offset: 1, limit: 2 }],
    ['write', { path: '/work/x.md', content: 'a'.repeat(500) }],
    ['edit', { path: '/work/x.ts', edits: [{ oldText: 'a', newText: 'b' }] }],
    ['bash', { command: 'x'.repeat(300) }],
    ['grep', { pattern: 'p'.repeat(120), path: '/work' }],
    ['find', { pattern: 'f'.repeat(120), path: '/work' }],
    ['ls', { path: '/work/' + 'deep/'.repeat(20) }],
    ['unknown', {}],
  ]
  for (const width of [40, 60, 80, 120, 160]) {
    for (const [name, args] of cases) {
      assertWidth(callLines(name, args, width), width, `${name}@${width}`)
    }
  }
})

test('describeCall tolerates missing and malformed arguments', () => {
  assert.doesNotThrow(() => describeCall('read', null, context()))
  assert.doesNotThrow(() => describeCall('read', { path: 42 }, context()))
  assert.doesNotThrow(() => describeCall('edit', { edits: 'nope' }, context()))
  assert.equal(describeCall('read', null, context()).detail, '(no path)')
})

test('result collapses long output with an expand hint', () => {
  const text = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`).join('\n')
  const lines = resultLines('read', result(text))
  assert.equal(lines.length, CONFIG.collapsedLines + 1)
  assert.match(lines.at(-1) ?? '', /\+16 lines/)
  assert.match(lines.at(-1) ?? '', /ctrl\+o to expand/)
})

test('bash result keeps the newest lines', () => {
  const text = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`).join('\n')
  const lines = resultLines('bash', result(text))
  assert.match(lines[0] ?? '', /16 earlier lines/)
  assert.equal((lines.at(-1) ?? '').trim(), 'line 40')
})

test('expanded result shows everything', () => {
  const text = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`).join('\n')
  const lines = resultLines('read', result(text), {}, true)
  assert.equal(lines.length, 40)
})

test('empty partial result shows a running line', () => {
  assert.deepEqual(resultLines('read', result(''), { isPartial: true }), ['running\u2026'])
  assert.deepEqual(resultLines('read', result('')), [])
})

test('error results are painted with the error token', () => {
  const spy = themeSpy()
  const ctx = context({ isError: true })
  const options = { expanded: false, isPartial: false }
  const lines = new ToolResultCard('read', result('boom'), options, spy.theme, ctx, CONFIG).render(80)
  assert.equal(lines.join('\n'), 'boom')
  assert.ok(spy.calls.some((call) => call.color === 'error' && call.text === 'boom'))
})

test('images become a placeholder unless pi draws them', () => {
  const withImage: AgentToolResult<unknown> = {
    content: [{ type: 'image', data: 'AAAA', mimeType: 'image/png' }],
    details: undefined,
  }
  assert.equal(toolResultText(withImage, false), '[image image/png]')
  assert.equal(toolResultText(withImage, true), '')
})

test('truncation notes come from tool details', () => {
  const truncated = result('body', {
    details: { truncation: { truncated: true, outputLines: 10, totalLines: 99 } },
  })
  assert.match(resultLines('read', truncated).at(-1) ?? '', /10 of 99 lines/)

  const bash = result('body', { details: { fullOutputPath: '/tmp/out.log' } })
  assert.match(resultLines('bash', bash).at(-1) ?? '', /full output: \/tmp\/out\.log/)
})

const DISPLAY_DIFF = ['+10 const a = 1', '-11 const a = 0', ' 12 return a', ' 13 }'].join('\n')

test('display diffs parse into rows and stats', () => {
  const rows = parseDisplayDiff(DISPLAY_DIFF)
  assert.deepEqual(
    rows.map((row) => row.kind),
    ['add', 'remove', 'context', 'context'],
  )
  assert.deepEqual(diffStats(rows), { added: 1, removed: 1 })
  assert.equal(rows[0]?.number, '10')
  assert.equal(rows[0]?.content, 'const a = 1')
})

test('edit result renders a unified diff on narrow terminals', () => {
  const spy = themeSpy()
  const options = { expanded: false, isPartial: false }
  const value = result('ok', { details: { diff: DISPLAY_DIFF } })
  const lines = new ToolResultCard('edit', value, options, spy.theme, context(), CONFIG).render(80)

  assertWidth(lines, 80)
  assert.match(lines.join('\n'), /\+ ?10/)
  assert.match(lines.join('\n'), /- ?11/)
  assert.ok(spy.calls.some((call) => call.color === 'toolDiffAdded'))
  assert.ok(spy.calls.some((call) => call.color === 'toolDiffRemoved'))
})

test('edit result renders two columns on wide terminals', () => {
  const spy = themeSpy()
  const options = { expanded: false, isPartial: false }
  const value = result('ok', { details: { diff: DISPLAY_DIFF } })
  const lines = new ToolResultCard('edit', value, options, spy.theme, context(), CONFIG).render(
    SPLIT_MIN_WIDTH,
  )
  assertWidth(lines, SPLIT_MIN_WIDTH)
  assert.ok(lines.some((line) => line.includes('\u2502')))
})

test('wide diffs can be forced back to one column', () => {
  const spy = themeSpy()
  const options = { expanded: false, isPartial: false }
  const value = result('ok', { details: { diff: DISPLAY_DIFF } })
  const card = new ToolResultCard('edit', value, options, spy.theme, context(), {
    ...CONFIG,
    diffMode: 'unified',
  })
  assert.ok(card.render(SPLIT_MIN_WIDTH).every((line) => !line.includes('\u2502')))
})

test('diff rows collapse with an elision line', () => {
  const rows = parseDisplayDiff(
    Array.from({ length: 60 }, (_, index) => `+${index + 1} line ${index + 1}`).join('\n'),
  )
  const { theme } = themeSpy()
  const lines = renderDiff(rows, {
    theme,
    width: 80,
    expanded: false,
    maxLines: CONFIG.collapsedLines,
    mode: 'auto',
    hint: 'ctrl+o to expand',
  })
  assertWidth(lines, 80)
  assert.match(lines.at(-1) ?? '', /\+36 lines/)
})

test('diff rendering never exceeds the width', () => {
  const rows = parseDisplayDiff(
    [
      `+1 ${'wide'.repeat(40)}`,
      `-2 ${'emoji \u{1f41b}\u{1f41b} '.repeat(20)}`,
      ` 3 ${'\u4e2d\u6587'.repeat(40)}`,
    ].join('\n'),
  )
  const { theme } = themeSpy()
  for (const width of [20, 40, 80, 120, 160]) {
    for (const mode of ['auto', 'split', 'unified'] as const) {
      const lines = renderDiff(rows, {
        theme,
        width,
        expanded: true,
        maxLines: CONFIG.collapsedLines,
        mode,
        hint: 'ctrl+o',
      })
      assertWidth(lines, width, `${mode}@${width}`)
    }
  }
})
