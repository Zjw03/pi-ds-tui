import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_CONFIG } from '../extensions/config.ts'
import {
  formatCost,
  formatTokens,
  renderFooter,
  snapshotFooter,
  type FooterSnapshot,
} from '../extensions/ui/footer.ts'
import { assertWidth } from './helpers/render.ts'

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
  dim: (text: string) => text,
}

const snapshot: FooterSnapshot = {
  cwd: '/home/user/projects/pi-ds-tui',
  model: 'model-x',
  thinking: 'high',
  contextPercent: 42,
  contextWindow: 200_000,
  totalTokens: 12_345,
  cacheTokens: 8_100,
  cacheHitPercent: 87,
  cost: 0.0123,
  gitBranch: 'main',
  statuses: ['building'],
}

test('wide footer shows cwd and chips, a full-width bar, then model and statuses', () => {
  const lines = renderFooter(snapshot, 120, DEFAULT_CONFIG.footer, theme)
  assertWidth(lines, 120)
  assert.equal(lines.length, 3)

  const [status, bar, model] = lines as [string, string, string]
  assert.ok(status.includes('/home/user/projects/pi-ds-tui'))
  assert.ok(status.includes('\u03a3 12k'))
  assert.ok(status.includes('cache 8.1k'))
  assert.ok(status.includes('$0.0123'))
  assert.ok(status.includes('git:main'))
  assert.ok(status.includes('think:high'))

  assert.ok(bar.includes('42% \u00b7 200k \u00b7 CH 87%'))
  assert.ok(bar.includes('\u2588'))
  assert.ok(bar.includes('\u2591'))

  assert.ok(model.includes('model-x'))
  assert.ok(model.includes('building'))
})

test('the bar fills the line and grows with the width', () => {
  for (const width of [40, 80, 120]) {
    const lines = renderFooter(snapshot, width, DEFAULT_CONFIG.footer, theme)
    const bar = lines[1] ?? ''
    assert.equal(bar.length, width)
    const filled = (bar.match(/\u2588/g) ?? []).length
    // 42% of the track, which excludes one space and the readout.
    const track = width - '42% \u00b7 200k \u00b7 CH 87%'.length - 1
    assert.equal(filled, Math.round(0.42 * track), `width ${width}`)
  }
})

test('bar colours follow pressure', () => {
  const calls: { color: string; text: string }[] = []
  const spy = {
    fg: (color: string, text: string) => {
      calls.push({ color, text })
      return text
    },
    bold: (text: string) => text,
    dim: (text: string) => text,
  }

  renderFooter({ ...snapshot, contextPercent: 85 }, 80, DEFAULT_CONFIG.footer, spy)
  assert.ok(calls.some((call) => call.color === 'warning' && call.text.includes('\u2588')))

  calls.length = 0
  renderFooter({ ...snapshot, contextPercent: 97 }, 80, DEFAULT_CONFIG.footer, spy)
  assert.ok(calls.some((call) => call.color === 'error' && call.text.includes('\u2588')))
})

test('unknown context or cache reads render as placeholders', () => {
  const lines = renderFooter(
    { ...snapshot, contextPercent: null, cacheHitPercent: null },
    80,
    DEFAULT_CONFIG.footer,
    theme,
  )
  const bar = lines[1] ?? ''
  assert.ok(bar.includes('?'))
  assert.ok(!bar.includes('CH'))
  assert.ok(bar.includes('200k'))
})

test('narrow footer drops chips but keeps the bar and model', () => {
  const lines = renderFooter(snapshot, 40, DEFAULT_CONFIG.footer, theme)
  assertWidth(lines, 40)
  const text = lines.join('\n')
  assert.ok(text.includes('42%'))
  assert.ok(text.includes('model-x'))
  assert.ok(!text.includes('$0.0123'))
  assert.ok(!text.includes('cache'))

  const tighter = renderFooter(snapshot, 30, DEFAULT_CONFIG.footer, theme)
  assertWidth(tighter, 30)
  assert.ok(!tighter.join('\n').includes('git:main'))
})

test('very narrow footer still respects the width', () => {
  for (const width of [5, 10, 20]) {
    const lines = renderFooter(snapshot, width, DEFAULT_CONFIG.footer, theme)
    assertWidth(lines, width)
    assert.ok(lines.length > 0)
  }
})

test('cwd and status lines truncate independently', () => {
  const lines = renderFooter(
    { ...snapshot, statuses: ['a very long extension status that will not fit'] },
    20,
    DEFAULT_CONFIG.footer,
    theme,
  )
  assertWidth(lines, 20)
})

test('the context bar can be turned off through the chip list', () => {
  const withoutContext = renderFooter(
    snapshot,
    80,
    { ...DEFAULT_CONFIG.footer, chips: ['model', 'cwd'] },
    theme,
  )
  assert.ok(!withoutContext.some((line) => line.includes('\u2591')))
})

test('cwd can be turned off through the chip list', () => {
  const lines = renderFooter(
    snapshot,
    80,
    { ...DEFAULT_CONFIG.footer, chips: ['model', 'context'] },
    theme,
  )
  assert.ok(!lines.join('\n').includes('/home/user/projects/pi-ds-tui'))
  assert.ok(lines.some((line) => line.includes('\u2591')))
})

test('formatTokens follows the pi compact format', () => {
  assert.equal(formatTokens(999), '999')
  assert.equal(formatTokens(1_500), '1.5k')
  assert.equal(formatTokens(12_345), '12k')
  assert.equal(formatTokens(1_500_000), '1.5M')
  assert.equal(formatTokens(0), '0')
})

test('formatCost keeps four decimals below one dollar', () => {
  assert.equal(formatCost(0.0123), '$0.0123')
  assert.equal(formatCost(12.3), '$12.30')
  assert.equal(formatCost(0), '$0')
})

test('snapshotFooter sums usage entries and reads context/model/git', () => {
  const cache = { entryCount: -1, totalTokens: 0, cacheTokens: 0, cacheHitPercent: null, cost: 0 }
  const ctx = {
    cwd: '/work',
    model: { id: 'model-x', provider: 'provider-a' },
    thinkingLevel: 'high',
    getContextUsage: () => ({ percent: 42, contextWindow: 200_000, tokens: 84_000 }),
    sessionManager: {
      getEntryCount: () => 3,
      getEntries: () => [
        { type: 'usage', usage: { totalTokens: 100, cacheRead: 20, cacheWrite: 5, cost: { total: 0.01 } } },
        {
          type: 'message',
          message: {
            role: 'assistant',
            usage: { totalTokens: 200, input: 30, cacheRead: 10, cacheWrite: 0, cost: { total: 0.02 } },
          },
        },
        { type: 'message', message: { role: 'user', usage: { totalTokens: 999 } } },
      ],
    },
  }
  const data = {
    getGitBranch: () => 'main',
    getExtensionStatuses: () => new Map([['k', ' busy ']]),
  }

  const result = snapshotFooter(ctx, data, cache)
  assert.equal(result.totalTokens, 300)
  assert.equal(result.cacheTokens, 35)
  assert.equal(result.cost, 0.03)
  assert.equal(result.contextPercent, 42)
  assert.equal(result.model, 'model-x')
  assert.equal(result.gitBranch, 'main')
  assert.deepEqual(result.statuses, ['busy'])
  assert.equal(result.cacheHitPercent, 25)

  const cached = snapshotFooter(ctx, data, cache)
  assert.equal(cached.totalTokens, 300)
})
