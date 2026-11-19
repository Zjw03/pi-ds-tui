import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('../themes/', import.meta.url))
const files = readdirSync(dir).filter((file) => file.endsWith('.json')).sort()

test('the ds theme ships', () => {
  assert.deepEqual(files, ['ds.json'])
})

for (const file of files) {
  test(`${file} matches the pi theme shape`, () => {
    const theme = JSON.parse(readFileSync(join(dir, file), 'utf8')) as {
      name?: unknown
      appearance?: unknown
      colors?: Record<string, unknown>
    }
    assert.equal(theme.name, file.replace(/\.json$/, ''))
    assert.ok(theme.appearance === 'dark' || theme.appearance === 'light')
    assert.equal(Object.keys(theme.colors ?? {}).length, 56)
    for (const key of ['accent', 'text', 'toolSuccessBg', 'thinkingMax', 'bashMode']) {
      assert.ok(key in (theme.colors ?? {}), `missing ${key}`)
    }
  })
}
