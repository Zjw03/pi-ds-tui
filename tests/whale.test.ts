import test from 'node:test'
import assert from 'node:assert/strict'
import { visibleWidth } from '@earendil-works/pi-tui'
import { renderWhaleRows, WHALE_WIDTH, whaleBlue } from '../extensions/ui/whale.ts'

test('the whale is 13 rows of 40 cells', () => {
  const rows = renderWhaleRows()
  assert.equal(rows.length, 13)
  for (const row of rows) {
    assert.equal(visibleWidth(row), WHALE_WIDTH)
    assert.ok(row.endsWith('\u001b[0m'))
  }
})

test('transparent cells do not leak a background color to the right', () => {
  for (const row of renderWhaleRows()) {
    const lastGlyph = Math.max(row.lastIndexOf('\u2580'), row.lastIndexOf('\u2584'), row.lastIndexOf('\u2588'))
    const tail = row.slice(lastGlyph + 1)
    assert.ok(
      !tail.includes('\u001b[48;2;'),
      `background leaked past the last glyph: ${JSON.stringify(row)}`,
    )
  }
})

test('whaleBlue uses the whale body color', () => {
  const text = whaleBlue('x')
  assert.ok(text.includes('\u001b[38;2;78;111;255m'))
  assert.ok(text.endsWith('\u001b[39m'))
})
