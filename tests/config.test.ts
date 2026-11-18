import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DEFAULT_CONFIG, configPath, loadConfig } from '../extensions/config.ts'

const missing = join(tmpdir(), `pi-ds-tui-missing-${process.pid}-${Date.now()}.json`)

test('a missing config file uses defaults without warnings', () => {
  const result = loadConfig({ path: missing })
  assert.equal(result.found, false)
  assert.deepEqual(result.warnings, [])
  assert.deepEqual(result.config, DEFAULT_CONFIG)
})

test('invalid JSON falls back to defaults and reports it', () => {
  const result = loadConfig({ path: '/virtual/pi-ds-tui.json', readFile: () => '{' })
  assert.equal(result.found, true)
  assert.equal(result.warnings.length, 1)
  assert.match(result.warnings[0] ?? '', /invalid JSON/)
  assert.deepEqual(result.config, DEFAULT_CONFIG)
})

test('a non-object root falls back to defaults', () => {
  const result = loadConfig({ path: '/virtual/pi-ds-tui.json', readFile: () => '[]' })
  assert.match(result.warnings[0] ?? '', /expected a JSON object/)
  assert.deepEqual(result.config, DEFAULT_CONFIG)
})

test('unknown keys are ignored with warnings', () => {
  const result = loadConfig({
    path: '/virtual/pi-ds-tui.json',
    readFile: () => JSON.stringify({ extra: true, footer: { enabled: false, bogus: 1 } }),
  })
  assert.equal(result.config.footer.enabled, false)
  assert.ok(result.warnings.some((warning) => warning.includes('unknown key "extra"')))
  assert.ok(result.warnings.some((warning) => warning.includes('unknown key "bogus"')))
})

test('invalid values fall back field by field', () => {
  const result = loadConfig({
    path: '/virtual/pi-ds-tui.json',
    readFile: () =>
      JSON.stringify({
        footer: { enabled: 'yes', narrowWidth: -1 },
        toolCards: { diffMode: 'sideways', collapsedLines: 0 },
        mouse: { enabled: true },
      }),
  })
  assert.equal(result.config.footer.enabled, DEFAULT_CONFIG.footer.enabled)
  assert.equal(result.config.footer.narrowWidth, DEFAULT_CONFIG.footer.narrowWidth)
  assert.equal(result.config.toolCards.diffMode, DEFAULT_CONFIG.toolCards.diffMode)
  assert.equal(result.config.toolCards.collapsedLines, DEFAULT_CONFIG.toolCards.collapsedLines)
  assert.equal(result.config.mouse.enabled, true)
  assert.ok(result.warnings.length >= 4)
})

test('read errors other than ENOENT are reported', () => {
  const result = loadConfig({
    path: '/virtual/pi-ds-tui.json',
    readFile: () => {
      throw new Error('boom')
    },
  })
  assert.equal(result.found, false)
  assert.match(result.warnings[0] ?? '', /boom/)
  assert.deepEqual(result.config, DEFAULT_CONFIG)
})

test('the resolved config is deeply frozen', () => {
  const result = loadConfig({
    path: '/virtual/pi-ds-tui.json',
    readFile: () => JSON.stringify({ footer: { chips: ['model'] } }),
  })
  assert.ok(Object.isFrozen(result.config))
  assert.ok(Object.isFrozen(result.config.footer))
  assert.ok(Object.isFrozen(result.config.footer.chips))
})

test('configPath points at ~/.pi/agent/pi-ds-tui.json', () => {
  assert.equal(configPath(join('/home', 'x')), join('/home', 'x', '.pi', 'agent', 'pi-ds-tui.json'))
})
