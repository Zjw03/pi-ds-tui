import test from 'node:test'
import assert from 'node:assert/strict'
import { renderHeader, type HeaderInfo } from '../extensions/ui/header.ts'
import { assertWidth } from './helpers/render.ts'

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
}

const info: HeaderInfo = {
  name: 'pi-ds-tui',
  version: '1.2.3',
  hints: '/ commands \u00b7 ! bash \u00b7 ctrl+o tools',
}

test('wide text header shows name, version and hints', () => {
  const lines = renderHeader(info, 80, theme, false)
  assertWidth(lines, 80)
  assert.equal(lines.length, 2)
  assert.ok(lines[0]?.includes('pi-ds-tui'))
  assert.ok(lines[0]?.includes('1.2.3'))
  assert.ok(lines[1]?.includes('/ commands'))
})

test('mid-width text header collapses to one line', () => {
  const lines = renderHeader(info, 20, theme, false)
  assertWidth(lines, 20)
  assert.equal(lines.length, 1)
  assert.ok(lines[0]?.includes('pi-ds-tui'))
  assert.ok(lines[0]?.includes('1.2.3'))
  assert.ok(!lines[0]?.includes('/ commands'))
})

test('narrow text header drops the version first', () => {
  const lines = renderHeader(info, 12, theme, false)
  assertWidth(lines, 12)
  assert.equal(lines.length, 1)
  assert.ok(lines[0]?.includes('pi-ds-tui'))
  assert.ok(!lines[0]?.includes('1.2.3'))
})

test('wide header shows the whale and the text column', () => {
  const lines = renderHeader(info, 80, theme, true)
  assertWidth(lines, 80)
  assert.equal(lines.length, 13)
  assert.ok(lines.some((line) => line.includes('\u2580') || line.includes('\u2584')))
  assert.ok(lines.join('\n').includes('DEEPSEEK HARNESS'))
})

test('medium header shows the whale with a title line', () => {
  const lines = renderHeader(info, 40, theme, true)
  assertWidth(lines, 40)
  assert.equal(lines.length, 14)
  assert.ok(lines.at(-1)?.includes('pi-ds-tui'))
})

test('logo: false keeps the text header', () => {
  const lines = renderHeader(info, 80, theme, false)
  assert.equal(lines.length, 2)
})

test('zero width renders nothing', () => {
  assert.deepEqual(renderHeader(info, 0, theme), [])
})
