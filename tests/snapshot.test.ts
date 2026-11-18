import test from 'node:test'
import assert from 'node:assert/strict'
import { visibleWidth } from '@earendil-works/pi-tui'
import { BaseComponent } from '../extensions/ui/component.ts'
import { assertWidth, renderAt, snapshot } from './helpers/render.ts'

class Sample extends BaseComponent {
  protected override paint(): readonly string[] {
    return ['hello', '\u4e16\u754c']
  }
}

test('snapshot helper renders and asserts width', () => {
  const component = new Sample()
  const lines = renderAt(component, 10)
  assert.deepEqual(lines, ['hello', '\u4e16\u754c'])
  assertWidth(lines, 10)
  assert.equal(snapshot(component, 10), 'hello\n\u4e16\u754c')
})

test('snapshot output truncates at narrow widths', () => {
  const lines = renderAt(new Sample(), 4)
  assert.equal(visibleWidth(lines[0] ?? ''), 4)
  assert.ok((lines[0] ?? '').startsWith('hel'))
  assert.equal(lines[1], '\u4e16\u754c')
  assertWidth(lines, 4)
})
