import test from 'node:test'
import assert from 'node:assert/strict'
import { applyWorking, clearWorking, WORKING_FRAMES } from '../extensions/ui/working.ts'

type Call = [string, unknown]

function fakeUi(): {
  calls: Call[]
  setWorkingMessage(message?: string): void
  setWorkingIndicator(options?: { frames?: string[]; intervalMs?: number }): void
  setWorkingVisible(visible: boolean): void
  theme: { fg(color: string, text: string): string }
} {
  const calls: Call[] = []
  return {
    calls,
    setWorkingMessage: (message?: string) => calls.push(['message', message]),
    setWorkingIndicator: (options?: { frames?: string[]; intervalMs?: number }) =>
      calls.push(['indicator', options]),
    setWorkingVisible: (visible: boolean) => calls.push(['visible', visible]),
    theme: { fg: (_color: string, text: string) => text },
  }
}

test('applyWorking sets the message, frames and visibility', () => {
  const ui = fakeUi()
  applyWorking(ui, { enabled: true, message: 'Thinking' })
  assert.deepEqual(ui.calls[0], ['message', 'Thinking'])
  assert.deepEqual(ui.calls[1], [
    'indicator',
    { frames: [...WORKING_FRAMES], intervalMs: 90 },
  ])
  assert.deepEqual(ui.calls[2], ['visible', true])
})

test('a null message restores the default message', () => {
  const ui = fakeUi()
  applyWorking(ui, { enabled: true, message: null })
  assert.deepEqual(ui.calls[0], ['message', undefined])
})

test('a disabled working row makes no calls', () => {
  const ui = fakeUi()
  applyWorking(ui, { enabled: false, message: 'Thinking' })
  assert.deepEqual(ui.calls, [])
})

test('clearWorking restores pi defaults', () => {
  const ui = fakeUi()
  clearWorking(ui)
  assert.deepEqual(ui.calls, [
    ['message', undefined],
    ['indicator', undefined],
    ['visible', true],
  ])
})
