import test from 'node:test'
import assert from 'node:assert/strict'
import { BaseComponent } from '../extensions/ui/component.ts'
import { assertWidth } from './helpers/render.ts'

class Demo extends BaseComponent {
  paints = 0

  protected override paint(width: number): readonly string[] {
    this.paints += 1
    return [`x`.repeat(width + 10), 'short']
  }
}

test('BaseComponent caches by width', () => {
  const component = new Demo()
  const first = component.render(10)
  const second = component.render(10)
  assert.equal(component.paints, 1)
  assert.deepEqual(first, second)
})

test('BaseComponent enforces the width on every line', () => {
  const component = new Demo()
  for (const width of [1, 5, 10, 40]) {
    assertWidth(component.render(width), width)
  }
})

test('invalidate clears the cache and the returned array is a copy', () => {
  const component = new Demo()
  const lines = component.render(10)
  lines[0] = 'mutated'
  assert.notEqual(component.render(10)[0], 'mutated')

  component.invalidate()
  component.render(10)
  assert.equal(component.paints, 2)
})
