import type {
  MarkdownMessageType,
  MarkdownTransformContext,
  MarkdownTransformer,
} from '@earendil-works/pi-coding-agent'
import { diagramKind, render, sourceBox } from 'lovely-mermaid'
import type { MarkdownConfig } from '../config.ts'

/**
 * Surfaces the transformer runs on. Thinking is included so the registration
 * matches Pi's default set, but the transformer returns thinking unchanged:
 * model-internal reasoning should stay byte-for-byte what the model wrote.
 */
export const MARKDOWN_MESSAGE_TYPES: readonly MarkdownMessageType[] = [
  'user',
  'assistant',
  'assistant-thinking',
  'custom',
  'summary',
]

/**
 * Dialect fences the engine understands but Pi's built-in mermaid transformer
 * does not recognize (it only matches the literal info string `mermaid`).
 */
const DIALECT_HEADERS: Readonly<Record<string, string>> = {
  statediagram: 'stateDiagram-v2',
  'statediagram-v2': 'stateDiagram-v2',
  classdiagram: 'classDiagram',
  'classdiagram-v2': 'classDiagram',
  erdiagram: 'erDiagram',
  sequencediagram: 'sequenceDiagram',
}

const MAX_SOURCE_LENGTH = 20_000
const ART_CACHE_MAX = 50
const DEFAULT_WIDTH = 80

const DIALECTS = new Set(Object.keys(DIALECT_HEADERS))

type Fence = {
  readonly marker: string
  readonly length: number
  readonly info: string
  readonly indent: string
}

type CollectedFence = {
  readonly body: string
  readonly next: number
}

const OPEN_FENCE = /^( {0,3})(`{3,}|~{3,})(.*)$/
const CLOSE_FENCE = /^ {0,3}(`{3,}|~{3,})\s*$/

const artCache = new Map<string, ReturnType<typeof render>>()

function openFence(line: string): Fence | undefined {
  const match = OPEN_FENCE.exec(line)
  if (!match) return undefined
  const marker = match[2]?.charAt(0)
  if (!marker) return undefined
  const info = match[3] ?? ''
  // A backtick fence's info string cannot contain a backtick.
  if (marker === '`' && info.includes('`')) return undefined
  return {
    marker,
    length: match[2]?.length ?? 0,
    info: info.trim(),
    indent: match[1] ?? '',
  }
}

function closesFence(line: string, fence: Fence): boolean {
  const match = CLOSE_FENCE.exec(line)
  if (!match) return false
  const marker = match[1]?.charAt(0)
  return marker === fence.marker && (match[1]?.length ?? 0) >= fence.length
}

function collectFence(lines: readonly string[], start: number, fence: Fence): CollectedFence | null {
  for (let index = start + 1; index < lines.length; index++) {
    if (!closesFence(lines[index] ?? '', fence)) continue
    return {
      body: lines.slice(start + 1, index).join('\n'),
      next: index + 1,
    }
  }
  return null
}

function firstInfoWord(info: string): string {
  return info.split(/\s+/, 1)[0]?.toLowerCase() ?? ''
}

function isDialect(info: string): boolean {
  return DIALECTS.has(firstInfoWord(info))
}

/** Encode a diagram row as inline code so Markdown preserves its spacing. */
function codeSpan(line: string): string {
  const content = line || '\u00a0'
  const longestRun = Math.max(
    0,
    ...Array.from(content.matchAll(/`+/g), (match) => match[0].length),
  )
  const fence = '`'.repeat(longestRun + 1)
  const padding = content.startsWith('`') || content.endsWith('`') ? ' ' : ''
  return `${fence}${padding}${content}${padding}${fence}`
}

function renderArt(source: string): ReturnType<typeof render> {
  if (source.length > MAX_SOURCE_LENGTH) return null
  const cached = artCache.get(source)
  if (cached !== undefined) return cached

  let art: ReturnType<typeof render> = null
  try {
    art = render(source)
  } catch {
    art = null
  }

  if (artCache.size >= ART_CACHE_MAX) artCache.clear()
  artCache.set(source, art)
  return art
}

function dialectSource(info: string, body: string): string {
  if (diagramKind(body)) return body
  const header = DIALECT_HEADERS[firstInfoWord(info)]
  return header ? `${header}\n${body}` : body
}

function renderBlock(body: string, info: string, width: number): string[] {
  const source = dialectSource(info, body)
  const art = renderArt(source)
  if (art && art.width <= width) return art.plain
  // No art, or too wide for the terminal: frame the source at the available
  // width. sourceBox wraps the body; the title is deliberately not truncated.
  return sourceBox(source, Math.max(8, width - 2)).plain
}

/**
 * Replace dialect fences with Unicode art.
 *
 * Pi's built-in mermaid transformer runs before extension transformers, so a
 * dialect fence rewritten to ```mermaid here would never reach it. Render the
 * dialect ourselves with the same engine Pi uses; standard ```mermaid fences
 * stay untouched for Pi's transformer.
 */
function renderDialectFences(markdown: string, context: MarkdownTransformContext): string {
  if (context.isStreaming) return markdown
  if (
    context.messageType !== 'user' &&
    context.messageType !== 'assistant' &&
    context.messageType !== 'custom' &&
    context.messageType !== 'summary'
  ) {
    return markdown
  }

  const lines = markdown.split('\n')
  const out: string[] = []
  const width = context.availableWidth > 0 ? context.availableWidth : DEFAULT_WIDTH
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''
    const open = openFence(line)
    if (!open) {
      out.push(line)
      index++
      continue
    }

    const collected = collectFence(lines, index, open)
    if (!collected) {
      // Unclosed fence: preserve the rest exactly as written.
      out.push(...lines.slice(index))
      break
    }

    if (isDialect(open.info)) {
      const rows = renderBlock(collected.body, open.info, Math.max(8, width - open.indent.length))
      const prefix = open.indent
      out.push(rows.map((row) => `${prefix}${codeSpan(row)}`).join('  \n'))
    } else {
      // Standard mermaid and unknown fences are Pi's or the author's business.
      out.push(...lines.slice(index, collected.next))
    }
    index = collected.next
  }

  return out.join('\n')
}

export function createMarkdownTransformer(config: MarkdownConfig): MarkdownTransformer {
  return (markdown, context) => {
    if (!config.enabled) return markdown
    if (!config.mermaid) return markdown
    // Thinking stays byte-for-byte what the model wrote.
    if (context.messageType === 'assistant-thinking') return markdown
    return renderDialectFences(markdown, context)
  }
}
