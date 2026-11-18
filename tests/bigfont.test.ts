import test from 'node:test'
import assert from 'node:assert/strict'
import { bigWordWidth, renderBigWord } from '../extensions/ui/bigfont.ts'

test('PI renders in both block sizes', () => {
  for (const size of ['large', 'compact'] as const) {
    const rows = renderBigWord('PI', size)
    assert.equal(rows.length, 5)
    assert.equal(bigWordWidth('PI', size), size === 'large' ? 11 : 8)
    for (const row of rows) {
      assert.ok(row.length <= bigWordWidth('PI', size))
      assert.ok(row.includes('\u2588') || row.includes('\u2580') || row.includes('\u2584'))
    }
  }
})
