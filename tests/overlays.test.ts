import test from 'node:test'
import assert from 'node:assert/strict'
import type { Theme } from '@earendil-works/pi-coding-agent'
import {
  APPROVAL_OPTIONS,
  ApprovalPanel,
  renderApproval,
  type ApprovalKeys,
  type ApprovalResult,
} from '../extensions/overlays/approval.ts'
import { renderPanel } from '../extensions/overlays/base.ts'
import { assertWidth } from './helpers/render.ts'

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
  dim: (text: string) => text,
} as unknown as Theme

const keys: ApprovalKeys = {
  matches: (data, binding) => {
    const map: Record<string, string> = {
      up: 'tui.select.up',
      down: 'tui.select.down',
      enter: 'tui.select.confirm',
      escape: 'tui.select.cancel',
    }
    return map[data] === binding
  },
}

const request = { title: 'Run command?', tool: 'bash', detail: 'rm -rf build' }

function panel(done: (result: ApprovalResult) => void, renders = { count: 0 }) {
  return new ApprovalPanel(request, theme, keys, { requestRender: () => (renders.count += 1) }, done)
}

test('approval panel renders a bordered list within the width', () => {
  const lines = renderApproval(request, 0, 40, theme)
  assertWidth(lines, 40)
  const text = lines.join('\n')
  assert.ok(text.includes('Run command?'))
  assert.ok(text.includes('tool: bash'))
  assert.ok(text.includes('rm -rf build'))
  for (const option of APPROVAL_OPTIONS) assert.ok(text.includes(option.label))
  assert.ok(text.includes('\u276f Allow'))
})

test('approval panel keeps the width on narrow terminals', () => {
  for (const width of [5, 10, 20]) {
    const lines = renderApproval(request, 0, width, theme)
    assertWidth(lines, width)
  }
})

test('down/up move the selection and request a render', () => {
  const renders = { count: 0 }
  const p = panel(() => {}, renders)
  p.handleInput('down')
  assert.equal(renders.count, 1)
  assert.ok(p.render(40).join('\n').includes('\u276f Deny'))
  p.handleInput('down')
  assert.ok(p.render(40).join('\n').includes('\u276f Always allow'))
  p.handleInput('up')
  assert.ok(p.render(40).join('\n').includes('\u276f Deny'))
})

test('up from the first option wraps to the last', () => {
  const p = panel(() => {})
  p.handleInput('up')
  assert.ok(p.render(40).join('\n').includes('\u276f Always allow'))
})

test('enter resolves the selected option', () => {
  let result: ApprovalResult = 'deny'
  const p = panel((value) => (result = value))
  p.handleInput('enter')
  assert.equal(result, 'allow')
})

test('escape cancels with undefined', () => {
  let result: ApprovalResult = 'allow'
  const p = panel((value) => (result = value))
  p.handleInput('escape')
  assert.equal(result, undefined)
})

test('a finished panel ignores further input', () => {
  let calls = 0
  let result: ApprovalResult
  const p = panel((value) => {
    calls += 1
    result = value
  })
  p.handleInput('enter')
  p.handleInput('down')
  p.handleInput('enter')
  assert.equal(calls, 1)
  assert.equal(result, 'allow')
})

test('renderPanel falls back to plain lines below eight columns', () => {
  const lines = renderPanel('Title', ['body'], 6, theme)
  assertWidth(lines, 6)
  assert.deepEqual(lines, ['Title', 'body'])
})
