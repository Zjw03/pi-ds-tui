import test from 'node:test'
import assert from 'node:assert/strict'
import { visibleWidth } from '@earendil-works/pi-tui'
import {
  fitLine,
  padRight,
  sanitizeSingleLine,
  truncateMiddle,
  truncateTail,
} from '../extensions/ui/text.ts'

const ANSI = '\u001b[31mred\u001b[0m'
const MIXED = `hello \u4e16\u754c \ud83d\ude00 ${ANSI}`

test('fitLine never exceeds the requested width', () => {
  for (const width of [0, 1, 2, 5, 10, 20, 40]) {
    for (const text of ['hello', MIXED, '\u4e16\u754c\u4f60\u597d', '\ud83d\ude00\ud83d\ude00\ud83d\ude00']) {
      const line = fitLine(text, width)
      assert.ok(visibleWidth(line) <= width, `${JSON.stringify(text)} at ${width}: ${visibleWidth(line)}`)
    }
  }
})

test('truncateMiddle keeps both ends and fits', () => {
  const text = '/very/long/path/to/some/deeply/nested/file.ts'
  for (const width of [10, 20, 30]) {
    const line = truncateMiddle(text, width)
    assert.ok(visibleWidth(line) <= width)
    assert.ok(line.includes('\u2026'))
    assert.ok(line.startsWith('/very'))
    assert.ok(line.endsWith('.ts') || width < 8)
  }
})

test('truncateMiddle strips ANSI instead of leaking styles', () => {
  const line = truncateMiddle(`${ANSI}/some/really/long/path/file.ts`, 12)
  assert.ok(!line.includes('\u001b['))
  assert.ok(visibleWidth(line) <= 12)
})

test('padRight returns exactly the requested width', () => {
  for (const width of [1, 5, 10]) {
    assert.equal(visibleWidth(padRight('hi', width)), width)
    assert.equal(visibleWidth(padRight('\u4e16\u754c\u4f60\u597d', width)), width)
  }
})

test('truncateTail keeps the end and fits', () => {
  const text = 'npm run verify -- --watch --reporter spec'
  for (const width of [10, 20, 30]) {
    const line = truncateTail(text, width)
    assert.ok(visibleWidth(line) <= width)
    assert.ok(line.endsWith('spec') || width < 8)
  }
})

test('sanitizeSingleLine collapses newlines and tabs', () => {
  assert.equal(sanitizeSingleLine(' a\n\tb   c '), 'a b c')
})
