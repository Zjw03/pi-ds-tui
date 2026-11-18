import test from 'node:test'
import assert from 'node:assert/strict'
import type { MarkdownTransformContext } from '@earendil-works/pi-coding-agent'
import { createMarkdownTransformer, stripPromptTags } from '../extensions/transcript/markdown.ts'
import type { MarkdownConfig } from '../extensions/config.ts'

const BASE: MarkdownConfig = {
  enabled: true,
  mermaid: true,
  stripPromptTags: true,
}

function context(overrides: Partial<MarkdownTransformContext> = {}): MarkdownTransformContext {
  return {
    messageType: 'assistant',
    isStreaming: false,
    availableWidth: 80,
    ...overrides,
  }
}

function transform(markdown: string, config: Partial<MarkdownConfig> = {}): string {
  return createMarkdownTransformer({ ...BASE, ...config })(markdown, context())
}

const STATE_DIAGRAM = '```statediagram\n[*] --> Idle\nIdle --> Running\nRunning --> [*]\n```'
const CLASS_DIAGRAM = '```classdiagram\nclass Animal\nAnimal : +String name\n```'
const STANDARD_MERMAID = '```mermaid\ngraph TD\nA-->B\n```'

test('disabled transformer is byte-identical', () => {
  const input = `${STATE_DIAGRAM}\n\n<context>drop</context>\n`
  assert.equal(transform(input, { enabled: false }), input)
})

test('standard mermaid is left for Pi', () => {
  assert.equal(transform(STANDARD_MERMAID), STANDARD_MERMAID)
})

test('GFM tables and LaTeX are left to Pi', () => {
  const input = '| a | b |\n|---|---|\n| 1 | 2 |\n\n$x^2 + y^2$'
  assert.equal(transform(input), input)
})

test('dialect fences render as Unicode art', () => {
  for (const input of [STATE_DIAGRAM, CLASS_DIAGRAM]) {
    const output = transform(input)
    assert.doesNotMatch(output, /statediagram|classdiagram/i)
    assert.match(output, /[┌╭│─]/)
    assert.match(output, /`/)
  }
})

test('tilde dialect fences render too', () => {
  const input = '~~~statediagram\n[*] --> Idle\nIdle --> Running\n~~~'
  const output = transform(input)
  assert.doesNotMatch(output, /statediagram/i)
  assert.match(output, /[┌╭│─]/)
})

test('unknown fences are untouched', () => {
  const input = '```plantuml\n@startuml\nA -> B\n@enduml\n```'
  assert.equal(transform(input), input)
})

test('unclosed dialect fence is untouched', () => {
  const input = '```statediagram\n[*] --> Idle\n'
  assert.equal(transform(input), input)
})

test('streaming skips diagram rendering', () => {
  const output = createMarkdownTransformer(BASE)(STATE_DIAGRAM, context({ isStreaming: true }))
  assert.equal(output, STATE_DIAGRAM)
})

test('thinking is untouched', () => {
  const input = `<context>keep</context>\n${STATE_DIAGRAM}`
  const output = createMarkdownTransformer(BASE)(input, context({ messageType: 'assistant-thinking' }))
  assert.equal(output, input)
})

test('user input is not tag-stripped', () => {
  const input = '<context>what does this mean?</context>'
  const output = createMarkdownTransformer(BASE)(input, context({ messageType: 'user' }))
  assert.equal(output, input)
})

test('prompt tags are stripped outside code fences', () => {
  const input = [
    'before',
    '<context>',
    'internal notes',
    '</context>',
    'after',
    '',
    '```txt',
    '<context>keep me</context>',
    '```',
    '',
  ].join('\n')

  const output = transform(input)
  assert.match(output, /^before\nafter/)
  assert.doesNotMatch(output, /internal notes/)
  assert.match(output, /```txt\n<context>keep me<\/context>\n```/)
})

test('unknown tags are preserved', () => {
  const input = '<analysis>keep</analysis>\n<context>drop</context>'
  assert.equal(stripPromptTags(input), '<analysis>keep</analysis>\n')
})

test('stripPromptTags can be disabled', () => {
  const input = '<context>keep</context>'
  assert.equal(transform(input, { stripPromptTags: false }), input)
})

test('mermaid can be disabled without disabling tag stripping', () => {
  assert.equal(transform(STATE_DIAGRAM, { mermaid: false }), STATE_DIAGRAM)
  assert.equal(transform('<context>drop</context>'), '')
})

test('narrow width falls back to a framed source', () => {
  const output = createMarkdownTransformer(BASE)(STATE_DIAGRAM, context({ availableWidth: 8 }))
  assert.match(output, /mermaid:/)
})

test('10KB input stays fast', () => {
  const input = `${'line\n'.repeat(2000)}<context>${'x'.repeat(8000)}</context>\n`
  const started = performance.now()
  const output = createMarkdownTransformer(BASE)(input, context())
  const elapsed = performance.now() - started

  assert.doesNotMatch(output, /<context>/)
  assert.ok(elapsed < 1000, `took ${elapsed.toFixed(0)}ms`)
})
