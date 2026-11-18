import test from 'node:test'
import assert from 'node:assert/strict'
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import {
  DEFAULT_WORKING_LABEL,
  WORKING_FRAMES,
  applyWorking,
  clearWorking,
  formatElapsed,
  formatTokenCount,
  formatWorkingMessage,
  installWorkingTracker,
  outputTokens,
} from '../extensions/ui/working.ts'

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

interface TrackerHarness {
  readonly ui: ReturnType<typeof fakeUi>
  readonly listeners: Map<string, (event: unknown, ctx: unknown) => unknown>
  readonly ctx: unknown
  emit(event: string, payload?: unknown): unknown
  lastMessage(): string | undefined
}

function track(message: string | null = null): TrackerHarness {
  const ui = fakeUi()
  const listeners = new Map<string, (event: unknown, ctx: unknown) => unknown>()
  const api = {
    on: (event: string, handler: (event: unknown, ctx: unknown) => unknown) => {
      listeners.set(event, handler)
    },
  } as unknown as ExtensionAPI
  installWorkingTracker(api, { enabled: true, message })

  const ctx = { ui }
  const lastMessage = (): string | undefined => {
    for (let index = ui.calls.length - 1; index >= 0; index--) {
      const call = ui.calls[index]
      if (call?.[0] === 'message') return call[1] as string | undefined
    }
    return undefined
  }
  return {
    ui,
    listeners,
    ctx,
    lastMessage,
    emit: (event, payload = {}) => listeners.get(event)?.(payload, ctx),
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

test('token counts use thousands separators', () => {
  assert.equal(formatTokenCount(0), '0')
  assert.equal(formatTokenCount(742), '742')
  assert.equal(formatTokenCount(12_345), '12,345')
  assert.equal(formatTokenCount(1_234_567), '1,234,567')
})

test('elapsed time reads as seconds, then minutes', () => {
  assert.equal(formatElapsed(0), '0s')
  assert.equal(formatElapsed(11_400), '11s')
  assert.equal(formatElapsed(59_400), '59s')
  assert.equal(formatElapsed(60_000), '1m')
  assert.equal(formatElapsed(92_000), '1m 32s')
})

test('the working message carries tokens and elapsed time', () => {
  assert.equal(formatWorkingMessage('Working...', 0, 500), 'Working...')
  assert.equal(
    formatWorkingMessage('Working...', 742, 500),
    'Working... (\u2193 742 tokens \u00b7 0s)',
  )
  assert.equal(formatWorkingMessage('Working...', 0, 4_200), 'Working... (4s)')
  assert.equal(
    formatWorkingMessage('Thinking', 12_345, 11_000),
    'Thinking (\u2193 12,345 tokens \u00b7 11s)',
  )
})

test('outputTokens reads assistant usage only', () => {
  assert.equal(outputTokens({ usage: { output: 742 } }), 742)
  assert.equal(outputTokens({ usage: { output: 0 } }), 0)
  assert.equal(outputTokens({ usage: { output: '12' } }), 12)
  assert.equal(outputTokens(null), 0)
  assert.equal(outputTokens({}), 0)
})

test('a disabled tracker registers nothing', () => {
  const listeners = new Map<string, unknown>()
  const api = { on: (event: string, handler: unknown) => listeners.set(event, handler) }
  installWorkingTracker(api as unknown as ExtensionAPI, { enabled: false, message: null })
  assert.equal(listeners.size, 0)
})

test('the tracker shows the label, then tokens and time', () => {
  const harness = track()
  assert.deepEqual([...harness.listeners.keys()].sort(), [
    'agent_end',
    'agent_start',
    'message_end',
    'message_update',
    'session_shutdown',
    'turn_start',
  ])

  harness.emit('agent_start')
  assert.equal(harness.lastMessage(), DEFAULT_WORKING_LABEL)

  harness.emit('message_update', { message: { role: 'assistant', usage: { output: 742 } } })
  assert.match(harness.lastMessage() ?? '', /\u2193 742 tokens/)

  harness.emit('message_end', { message: { role: 'assistant', usage: { output: 742 } } })
  assert.match(harness.lastMessage() ?? '', /\u2193 742 tokens/)

  harness.emit('agent_end', {})
  assert.equal(harness.lastMessage(), undefined)
})

test('a second assistant message adds to the same run', () => {
  const harness = track('Thinking')
  harness.emit('agent_start')
  harness.emit('message_end', { message: { role: 'assistant', usage: { output: 100 } } })
  harness.emit('message_update', { message: { role: 'assistant', usage: { output: 50 } } })
  assert.match(harness.lastMessage() ?? '', /Thinking \(\u2193 150 tokens/)
  harness.emit('agent_end', {})
})

test('tool results do not add tokens', () => {
  const harness = track()
  harness.emit('agent_start')
  harness.emit('message_end', { message: { role: 'toolResult', usage: { output: 999 } } })
  assert.equal(harness.lastMessage(), DEFAULT_WORKING_LABEL)
  harness.emit('agent_end', {})
})
