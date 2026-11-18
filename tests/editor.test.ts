import test from 'node:test'
import assert from 'node:assert/strict'
import { applyPromptPrefix, installEditor, restoreEditor, type EditorUi } from '../extensions/ui/editor.ts'

type Factory = NonNullable<Parameters<EditorUi['setEditorComponent']>[0]>

const color = (text: string): string => text

test('the prompt replaces the first two padding cells of the first content line', () => {
  const input = ['\u2500\u2500\u2500\u2500', '  hello', '\u2500\u2500\u2500\u2500']
  assert.deepEqual(applyPromptPrefix(input, '\u276f', color), [
    '\u2500\u2500\u2500\u2500',
    '\u276f hello',
    '\u2500\u2500\u2500\u2500',
  ])
})

test('continuation lines keep their padding', () => {
  const input = ['border', '  first', '  second', 'border']
  const output = applyPromptPrefix(input, '\u276f', color)
  assert.equal(output[1], '\u276f first')
  assert.equal(output[2], '  second')
})

test('the input array is not mutated', () => {
  const input = ['border', '  hello', 'border']
  applyPromptPrefix(input, '\u276f', color)
  assert.equal(input[1], '  hello')
})

test('no prefix is added without leading padding', () => {
  const input = ['border', 'hello', 'border']
  assert.deepEqual(applyPromptPrefix(input, '\u276f', color), input)
})

test('short editor output is left alone', () => {
  assert.deepEqual(applyPromptPrefix(['border', '  hello'], '\u276f', color), ['border', '  hello'])
  assert.deepEqual(applyPromptPrefix([], '\u276f', color), [])
})

test('the prefix is colored through the callback', () => {
  const seen: string[] = []
  applyPromptPrefix(['border', '  hello', 'border'], '\u276f', (text) => {
    seen.push(text)
    return `<${text}>`
  })
  assert.deepEqual(seen, ['\u276f'])
})

test('installEditor works when the slot starts empty', () => {
  let current: Factory | undefined
  const ui: EditorUi = {
    getEditorComponent: () => current,
    setEditorComponent: (factory) => {
      current = factory
    },
  }

  installEditor(ui, '\u276f')
  assert.equal(typeof current, 'function')
  restoreEditor(ui)
  assert.equal(current, undefined)
})

test('installEditor remembers and restores the previous factory', () => {
  // SAFETY: the test only compares factory identity; it never invokes them.
  const before = (() => undefined) as unknown as Factory
  let current: Factory | undefined = before
  const ui: EditorUi = {
    getEditorComponent: () => current,
    setEditorComponent: (factory) => {
      current = factory
    },
  }

  installEditor(ui, '\u276f')
  const installed = current
  assert.ok(installed !== undefined)
  assert.ok(installed !== before)

  installEditor(ui, '\u276f')
  assert.equal(current, installed)

  restoreEditor(ui)
  assert.equal(current, before)
})
