#!/usr/bin/env node
/**
 * Validate bundled themes against the pi theme contract.
 *
 * pi rejects unknown color keys, so this gate catches typos before a theme is
 * loaded by the TUI. It also keeps the two dsh themes in sync with each other.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REQUIRED = [
  'accent',
  'border',
  'borderAccent',
  'borderMuted',
  'success',
  'error',
  'warning',
  'muted',
  'dim',
  'text',
  'thinkingText',
  'scrollbarTrack',
  'scrollbarThumb',
  'selectedBg',
  'searchMatchBg',
  'searchMatchText',
  'userMessageBg',
  'userMessageText',
  'customMessageBg',
  'customMessageText',
  'customMessageLabel',
  'toolPendingBg',
  'toolSuccessBg',
  'toolErrorBg',
  'toolTitle',
  'toolOutput',
  'mdHeading',
  'mdLink',
  'mdLinkUrl',
  'mdCode',
  'mdCodeBlock',
  'mdCodeBlockBorder',
  'mdQuote',
  'mdQuoteBorder',
  'mdHr',
  'mdListBullet',
  'toolDiffAdded',
  'toolDiffRemoved',
  'toolDiffContext',
  'syntaxComment',
  'syntaxKeyword',
  'syntaxFunction',
  'syntaxVariable',
  'syntaxString',
  'syntaxNumber',
  'syntaxType',
  'syntaxOperator',
  'syntaxPunctuation',
  'thinkingOff',
  'thinkingMinimal',
  'thinkingLow',
  'thinkingMedium',
  'thinkingHigh',
  'thinkingXhigh',
  'thinkingMax',
  'bashMode',
]

const ALLOWED = new Set(REQUIRED)
const dir = fileURLToPath(new URL('../themes/', import.meta.url))
const files = readdirSync(dir).filter((file) => file.endsWith('.json')).sort()
const errors = []

if (files.length === 0) errors.push('no theme files found')

for (const file of files) {
  const path = join(dir, file)
  let theme
  try {
    theme = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    errors.push(`${file}: invalid JSON (${error instanceof Error ? error.message : String(error)})`)
    continue
  }

  const expectedName = file.replace(/\.json$/, '')
  if (theme.name !== expectedName) {
    errors.push(`${file}: name must be "${expectedName}", got ${JSON.stringify(theme.name)}`)
  }
  if (theme.appearance !== 'dark' && theme.appearance !== 'light') {
    errors.push(`${file}: appearance must be "dark" or "light"`)
  }

  const colors = theme.colors
  if (typeof colors !== 'object' || colors === null || Array.isArray(colors)) {
    errors.push(`${file}: colors must be an object`)
    continue
  }

  for (const key of REQUIRED) {
    if (!(key in colors)) errors.push(`${file}: missing color "${key}"`)
  }
  for (const key of Object.keys(colors)) {
    if (!ALLOWED.has(key)) errors.push(`${file}: unknown color "${key}"`)
  }
  for (const [key, value] of Object.entries(colors)) {
    if (typeof value !== 'string' && typeof value !== 'number') {
      errors.push(`${file}: color "${key}" must be a string or a 256-color index`)
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`theme error: ${error}`)
  process.exit(1)
}

console.log(`themes: ok (${files.length} files, ${REQUIRED.length} colors each)`)
