import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Theme } from '@earendil-works/pi-coding-agent'
import {
  CONFIG_FIELDS,
  ConfigPanel,
  applyFieldValue,
  createConfigItems,
  fieldById,
} from '../extensions/configPanel.ts'
import { readConfigObject, writeConfigObject } from '../extensions/config.ts'
import { assertWidth } from './helpers/render.ts'

const theme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
} as unknown as Theme

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'pi-ds-tui-panel-'))
}

test('items fall back to defaults', () => {
  const items = createConfigItems({})
  const byId = new Map(items.map((item) => [item.id, item]))

  assert.equal(byId.get('enabled')?.currentValue, 'on')
  assert.equal(byId.get('header.logo')?.currentValue, 'on')
  assert.equal(byId.get('mouse.enabled')?.currentValue, 'off')
  assert.equal(byId.get('toolCards.diffMode')?.currentValue, 'auto')
  assert.equal(byId.get('toolCards.collapsedLines')?.currentValue, '24')
  assert.equal(items.length, CONFIG_FIELDS.length)
})

test('items prefer values already in the file', () => {
  const items = createConfigItems({
    enabled: false,
    toolCards: { diffMode: 'split', collapsedLines: 48 },
  })
  const byId = new Map(items.map((item) => [item.id, item]))

  assert.equal(byId.get('enabled')?.currentValue, 'off')
  assert.equal(byId.get('toolCards.diffMode')?.currentValue, 'split')
  assert.equal(byId.get('toolCards.collapsedLines')?.currentValue, '48')
})

test('booleans, enums and numbers write their natural JSON types', () => {
  const draft: Record<string, unknown> = {}

  assert.equal(applyFieldValue(draft, 'enabled', 'off'), true)
  assert.equal(applyFieldValue(draft, 'toolCards.diffMode', 'unified'), true)
  assert.equal(applyFieldValue(draft, 'toolCards.collapsedLines', '32'), true)

  assert.deepEqual(draft, {
    enabled: false,
    toolCards: { diffMode: 'unified', collapsedLines: 32 },
  })
})

test('unknown ids are ignored', () => {
  const draft: Record<string, unknown> = {}
  assert.equal(applyFieldValue(draft, 'nope', 'on'), false)
  assert.deepEqual(draft, {})
  assert.equal(fieldById('nope'), undefined)
})

test('every field id is unique and points at a real config key', () => {
  const ids = new Set(CONFIG_FIELDS.map((field) => field.id))
  assert.equal(ids.size, CONFIG_FIELDS.length)
  for (const field of CONFIG_FIELDS) {
    assert.ok(field.values.length >= 2, `${field.id} needs values`)
    assert.ok(field.description.length > 0, `${field.id} needs a description`)
  }
})

test('writing preserves unknown keys and leaves no temp file', () => {
  const dir = tempDir()
  const path = join(dir, 'pi-ds-tui.json')
  writeFileSync(path, JSON.stringify({ enabled: true, future: { keep: 1 } }), 'utf8')

  const draft = readConfigObject(path)
  applyFieldValue(draft, 'footer.enabled', 'off')
  writeConfigObject(path, draft)

  const written = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  assert.equal(written.enabled, true)
  assert.deepEqual(written.future, { keep: 1 })
  assert.deepEqual(written.footer, { enabled: false })
  assert.deepEqual(readdirSync(dir), ['pi-ds-tui.json'])
})

test('missing or malformed files read as an empty draft', () => {
  const dir = tempDir()
  assert.deepEqual(readConfigObject(join(dir, 'absent.json')), {})

  const broken = join(dir, 'broken.json')
  writeFileSync(broken, '{ nope', 'utf8')
  assert.deepEqual(readConfigObject(broken), {})

  writeConfigObject(join(dir, 'nested', 'deep', 'pi-ds-tui.json'), { enabled: true })
  assert.deepEqual(readConfigObject(join(dir, 'nested', 'deep', 'pi-ds-tui.json')), { enabled: true })
})

test('the panel renders as a bordered list, like /settings', () => {
  const dir = tempDir()
  const panel = new ConfigPanel({
    theme,
    path: join(dir, 'pi-ds-tui.json'),
    draft: {},
    requestRender: () => {},
    done: () => {},
  })

  for (const width of [40, 60, 80, 120]) {
    const lines = panel.render(width)
    assertWidth(lines, width, `panel@${width}`)
    assert.equal(lines[0], '\u2500'.repeat(width))
    assert.equal(lines.at(-1), '\u2500'.repeat(width))
    const text = lines.join('\n')
    assert.match(text, /Tool cards/)
    assert.match(text, /Diff mode/)
  }
})

test('a failed write shows an error line instead of closing', () => {
  const dir = tempDir()
  let closed = false
  const panel = new ConfigPanel({
    theme,
    // A directory cannot be replaced by a file write.
    path: dir,
    draft: {},
    requestRender: () => {},
    done: () => {
      closed = true
    },
  })

  panel.handleInput('\r')
  assert.equal(closed, false)
  assert.match(panel.render(80).join('\n'), /save failed/)
})

test('toggling the first item writes the file and marks the panel dirty', () => {
  const dir = tempDir()
  const path = join(dir, 'pi-ds-tui.json')
  let result: { dirty: boolean } | undefined

  const panel = new ConfigPanel({
    theme,
    path,
    draft: readConfigObject(path),
    requestRender: () => {},
    done: (value) => {
      result = value
    },
  })

  // Enter cycles the selected item (enabled: on -> off).
  panel.handleInput('\r')
  const written = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  assert.equal(written.enabled, false)

  // Escape closes and reports that the file changed.
  panel.handleInput('\u001b')
  assert.deepEqual(result, { dirty: true })
})

test('closing without changes reports a clean panel', () => {
  const dir = tempDir()
  let result: { dirty: boolean } | undefined

  const panel = new ConfigPanel({
    theme,
    path: join(dir, 'pi-ds-tui.json'),
    draft: {},
    requestRender: () => {},
    done: (value) => {
      result = value
    },
  })

  panel.handleInput('\u001b')
  assert.deepEqual(result, { dirty: false })
})
