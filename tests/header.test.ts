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

test('wide header shows name, version and hints', () => {
  const lines = renderHeader(info, 80, theme)
  assertWidth(lines, 80)
  assert.equal(lines.length, 2)
  assert.ok(lines[0]?.includes('pi-ds-tui'))
  assert.ok(lines[0]?.includes('1.2.3'))
  assert.ok(lines[1]?.includes('/ commands'))
})

test('mid-width header collapses to one line', () => {
  const lines = renderHeader(info, 20, theme)
  assertWidth(lines, 20)
  assert.equal(lines.length, 1)
  assert.ok(lines[0]?.includes('pi-ds-tui'))
  assert.ok(lines[0]?.includes('1.2.3'))
  assert.ok(!lines[0]?.includes('/ commands'))
})

test('narrow header drops the version first', () => {
  const lines = renderHeader(info, 12, theme)
  assertWidth(lines, 12)
  assert.equal(lines.length, 1)
  assert.ok(lines[0]?.includes('pi-ds-tui'))
  assert.ok(!lines[0]?.includes('1.2.3'))
})

test('zero width renders nothing', () => {
  assert.deepEqual(renderHeader(info, 0, theme), [])
})
