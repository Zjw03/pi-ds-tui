#!/usr/bin/env node
/**
 * Offline preview of the M4 Markdown transformer.
 *
 * Runs the real transformer (`extensions/transcript/markdown.ts`) and pi-tui's
 * Markdown renderer at several widths, so dialect diagrams, prompt-tag
 * stripping and width safety can be checked without starting pi or asking a
 * model for a diagram.
 *
 * Usage:
 *   node scripts/preview-markdown.mjs                 # tests/fixtures/markdown-demo.md
 *   node scripts/preview-markdown.mjs path/to/file.md
 *   node scripts/preview-markdown.mjs --widths 40,120 --raw
 *
 * Flags:
 *   --widths <list>   comma-separated widths (default: 40,60,80,120)
 *   --raw             print the transformed Markdown instead of rendering it
 *   --no-tags         disable prompt-tag stripping
 *   --no-mermaid      disable dialect rendering
 *
 * This is a debugging aid, not part of `npm run verify`.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Markdown, visibleWidth } from '@earendil-works/pi-tui'
import { createMarkdownTransformer } from '../extensions/transcript/markdown.ts'

const fixture = fileURLToPath(new URL('../tests/fixtures/markdown-demo.md', import.meta.url))

const argv = process.argv.slice(2)
const flags = new Set(argv.filter((arg) => arg.startsWith('--')))
const valueOf = (name) => {
  const index = argv.indexOf(name)
  return index === -1 ? undefined : argv[index + 1]
}

const file = argv.find((arg, index) => !arg.startsWith('--') && argv[index - 1] !== '--widths') ?? fixture
const widths = (valueOf('--widths') ?? '40,60,80,120')
  .split(',')
  .map((value) => Number.parseInt(value.trim(), 10))
  .filter((value) => Number.isFinite(value) && value > 0)

const config = {
  enabled: true,
  mermaid: !flags.has('--no-mermaid'),
  stripPromptTags: !flags.has('--no-tags'),
}

const identity = (text) => text
const theme = {
  heading: identity,
  link: identity,
  linkUrl: identity,
  code: identity,
  codeBlock: identity,
  codeBlockBorder: identity,
  quote: identity,
  quoteBorder: identity,
  hr: identity,
  listBullet: identity,
  bold: identity,
  italic: identity,
  strikethrough: identity,
  underline: identity,
}

const source = readFileSync(file, 'utf8')
const transformer = createMarkdownTransformer(config)

console.log(`file: ${file}`)
console.log(`config: mermaid=${config.mermaid} stripPromptTags=${config.stripPromptTags}`)

if (flags.has('--raw')) {
  const transformed = transformer(source, {
    messageType: 'assistant',
    isStreaming: false,
    availableWidth: widths[0] ?? 80,
  })
  console.log('--- transformed ---')
  console.log(transformed)
  process.exit(0)
}

for (const width of widths) {
  const transformed = transformer(source, {
    messageType: 'assistant',
    isStreaming: false,
    availableWidth: width,
  })
  const rawMax = Math.max(0, ...transformed.split('\n').map(visibleWidth))
  const lines = new Markdown(transformed, 0, 0, theme).render(width)
  const renderedMax = Math.max(0, ...lines.map(visibleWidth))

  console.log(`\n=== width ${width} | raw max ${rawMax} | rendered max ${renderedMax} | lines ${lines.length} ===`)
  for (const line of lines) console.log(line.replace(/\s+$/, ''))
}

const overflow = widths.filter((width) => {
  const transformed = transformer(source, {
    messageType: 'assistant',
    isStreaming: false,
    availableWidth: width,
  })
  return new Markdown(transformed, 0, 0, theme)
    .render(width)
    .some((line) => visibleWidth(line) > width)
})
console.log(
  overflow.length === 0
    ? `\nwidth check: ok (${widths.join(', ')})`
    : `\nwidth check: FAIL at ${overflow.join(', ')}`,
)
process.exit(overflow.length === 0 ? 0 : 1)
