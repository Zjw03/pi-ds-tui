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
  provider: 'provider-a',
  thinking: 'high',
  contextPercent: 42,
  contextWindow: 200_000,
  contextTokens: 84_000,
  totalTokens: 12_345,
  cacheTokens: 8_100,
  cost: 0.0123,
  gitBranch: 'main',
  statuses: ['building'],
}

test('wide footer shows every chip, model, cwd and status', () => {
  const lines = renderFooter(snapshot, 120, DEFAULT_CONFIG.footer, theme)
  assertWidth(lines, 120)
  const text = lines.join('\n')
  assert.ok(text.includes('/home/user/projects/pi-ds-tui'))
  assert.ok(text.includes('42.0%/200k'))
  assert.ok(text.includes('\u03a3 12k'))
  assert.ok(text.includes('cache 8.1k'))
  assert.ok(text.includes('$0.0123'))
  assert.ok(text.includes('git:main'))
  assert.ok(text.includes('think:high'))
  assert.ok(text.includes('model-x'))
  assert.ok(text.includes('building'))
})

test('narrow footer keeps context and model, dropping lower-priority chips', () => {
  const lines = renderFooter(snapshot, 40, DEFAULT_CONFIG.footer, theme)
  assertWidth(lines, 40)
  const text = lines.join('\n')
  assert.ok(text.includes('42.0%'))
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

test('cwd can be turned off through the chip list', () => {
  const lines = renderFooter(
    snapshot,
    80,
    { ...DEFAULT_CONFIG.footer, chips: ['model', 'context'] },
    theme,
  )
  assert.ok(!lines.join('\n').includes('/home/user/projects/pi-ds-tui'))
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
  const cache = { entryCount: -1, totalTokens: 0, cacheTokens: 0, cost: 0 }
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
            usage: { totalTokens: 200, cacheRead: 10, cacheWrite: 0, cost: { total: 0.02 } },
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

  const cached = snapshotFooter(ctx, data, cache)
  assert.equal(cached.totalTokens, 300)
})
