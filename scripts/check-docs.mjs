#!/usr/bin/env node
/**
 * Doc consistency gate (X5).
 *
 * README, the manual checklist and the code drift apart after refactors. This
 * gate compares the parts of the docs that describe code against the code:
 *
 * - `/ds-*` commands in the README table vs the commands the extension registers
 * - files named in the README layout tree vs files on disk (both directions for
 *   `extensions/`, one direction for tests/scripts/themes; `docs/` is local-only
 *   and optional, so a fresh clone without it still passes)
 * - the README config sample vs `DEFAULT_CONFIG`
 * - relative Markdown links
 * - a blocklist of features that were removed, in the docs that describe the
 *   current state (the TODO is history and is exempt)
 *
 * Run: node scripts/check-docs.mjs (part of `npm run verify`).
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
/** Normalize line endings: the checkout may be CRLF on Windows. */
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n')

const errors = []
const fail = (message) => errors.push(message)

function walk(dir) {
  const files = []
  for (const entry of readdirSync(join(root, dir))) {
    const path = join(dir, entry)
    if (statSync(join(root, path)).isDirectory()) files.push(...walk(path))
    else files.push(path)
  }
  return files
}

// 1. Commands the extension actually registers (defaults, no user config).
const home = mkdtempSync(join(tmpdir(), 'pi-ds-tui-docs-'))
process.env.HOME = home
process.env.USERPROFILE = home

const { default: piDsTui } = await import(new URL('../extensions/index.ts', import.meta.url).href)
const { DEFAULT_CONFIG } = await import(new URL('../extensions/config.ts', import.meta.url).href)

const registered = []
piDsTui({
  registerCommand: (name) => registered.push(name),
  on: () => {},
  registerToolRenderer: () => {},
  registerMarkdownTransformer: () => {},
})

const readme = read('README.md')
const manual = read('tests/manual.md')

const documentedCommands = new Set(
  [...readme.matchAll(/^\| `\/([\w-]+)` \|/gm)].map((match) => match[1]),
)
const registeredCommands = new Set(registered)

for (const name of registeredCommands) {
  if (!documentedCommands.has(name)) fail(`README commands table is missing /${name}`)
}
for (const name of documentedCommands) {
  if (!registeredCommands.has(name)) fail(`README documents /${name}, which is not registered`)
}

// 2. README layout tree vs disk.
const layoutBlock = readme.match(/## Layout\s*\n```text\n([\s\S]*?)```/)
if (!layoutBlock) {
  fail('README has no layout block')
} else {
  const listed = new Set(
    [...(layoutBlock[1] ?? '').matchAll(/[\w.-]+\.(?:ts|tsx|mjs|json|md)/g)].map((match) => match[0]),
  )
  const onDisk = new Set([
    ...walk('extensions').map((path) => basename(path)),
    ...readdirSync(join(root, 'tests')).map((name) => name),
    ...readdirSync(join(root, 'scripts')),
    ...readdirSync(join(root, 'themes')),
    ...(existsSync(join(root, 'docs')) ? readdirSync(join(root, 'docs')) : []),
    'README.md',
    'package.json',
    'LICENSE',
  ])

  for (const name of listed) {
    if (!onDisk.has(name)) fail(`README layout lists ${name}, which does not exist`)
  }

  for (const file of walk('extensions')) {
    const name = basename(file)
    if (!listed.has(name)) fail(`README layout is missing extensions/.../${name}`)
  }
}

// 3. Config sample vs DEFAULT_CONFIG.
const sampleBlock = readme.match(/## Config\s*[\s\S]*?```jsonc\n([\s\S]*?)```/)
if (!sampleBlock) {
  fail('README has no config sample')
} else {
  let sample
  try {
    sample = JSON.parse(sampleBlock[1] ?? '')
  } catch (error) {
    fail(`README config sample is not valid JSON: ${error.message}`)
  }
  if (sample !== undefined) {
    const sampleKeys = Object.keys(sample).sort()
    const realKeys = Object.keys(DEFAULT_CONFIG).sort()
    if (sampleKeys.join(',') !== realKeys.join(',')) {
      fail(`README config keys ${sampleKeys.join(',')} != actual ${realKeys.join(',')}`)
    }
    for (const [key, value] of Object.entries(sample)) {
      const real = DEFAULT_CONFIG[key]
      if (typeof value !== 'object' || value === null || Array.isArray(value)) continue
      if (typeof real !== 'object' || real === null) continue
      const sampleSection = Object.keys(value).sort()
      const realSection = Object.keys(real).sort()
      if (sampleSection.join(',') !== realSection.join(',')) {
        fail(`README ${key} keys ${sampleSection.join(',')} != actual ${realSection.join(',')}`)
      }
    }
  }
}

// 4. Relative Markdown links.
for (const [label, body] of [
  ['README.md', readme],
  ['tests/manual.md', manual],
]) {
  for (const match of body.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1] ?? ''
    if (/^[a-z]+:/i.test(target) || target.startsWith('#')) continue
    const path = target.split('#')[0] ?? ''
    try {
      statSync(join(root, path))
    } catch {
      fail(`${label} links to ${target}, which does not exist`)
    }
  }
}

// 5. Features that no longer exist must not be described as current.
const STALE = [
  '/ds-approve',
  '/ds-widgets',
  '/ds-tools',
  'status.enabled',
  'stripPromptTags',
  'overlays.enabled',
  'widgets.above',
  'grouping.ts',
  'narrowWidth',
  'autocomplete.enabled',
  'messages.enabled',
  'entries.enabled',
  'mouse.enabled',
]
for (const [label, body] of [
  ['README.md', readme],
  ['tests/manual.md', manual],
]) {
  for (const token of STALE) {
    if (body.includes(token)) fail(`${label} still mentions removed feature "${token}"`)
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`docs error: ${error}`)
  process.exit(1)
}

console.log('docs: ok')
