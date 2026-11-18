/**
 * Working row: spinner frames plus a live progress suffix.
 *
 * `Working... (↓ 742 tokens · 11s)` — output tokens for the current run and the
 * elapsed time, refreshed once a second while the agent works. The text is set
 * through pi's public `setWorkingMessage`, so the indicator keeps pi's spinner
 * and placement (embedded in the editor border when the editor opts in).
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import type { WorkingConfig } from '../config.ts'

export const WORKING_FRAMES = [
  '\u280b',
  '\u2819',
  '\u2839',
  '\u2838',
  '\u283c',
  '\u2834',
  '\u2826',
  '\u2827',
  '\u2807',
  '\u280f',
] as const

export const WORKING_INTERVAL_MS = 90
export const WORKING_REFRESH_MS = 1_000

/** Elapsed time only earns its cells after this long, unless tokens arrived. */
const SHOW_TIMER_AFTER_MS = 3_000

/** Base label when the config does not set one. */
export const DEFAULT_WORKING_LABEL = 'Working...'

export interface WorkingUi {
  setWorkingMessage(message?: string): void
  setWorkingIndicator(options?: { frames?: string[]; intervalMs?: number }): void
  setWorkingVisible(visible: boolean): void
  readonly theme: { fg(color: string, text: string): string }
}

export function applyWorking(ui: WorkingUi, config: WorkingConfig): void {
  if (!config.enabled) return
  ui.setWorkingMessage(config.message ?? undefined)
  ui.setWorkingIndicator({
    frames: WORKING_FRAMES.map((frame) => ui.theme.fg('accent', frame)),
    intervalMs: WORKING_INTERVAL_MS,
  })
  ui.setWorkingVisible(true)
}

export function clearWorking(ui: WorkingUi): void {
  ui.setWorkingMessage()
  ui.setWorkingIndicator()
  ui.setWorkingVisible(true)
}

/** Output tokens of one assistant message; 0 for anything else. */
export function outputTokens(message: unknown): number {
  if (typeof message !== 'object' || message === null) return 0
  const usage = (message as { usage?: { output?: unknown } }).usage
  const value = Number(usage?.output)
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

/** Thousands separators, matching the token readout in pi-cc-extensions. */
export function formatTokenCount(count: number): string {
  const value = Math.max(0, Math.round(count))
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`
}

/**
 * `Working...` with no data yet, otherwise `Working... (↓ 1,234 tokens · 12s)`.
 * The duration appears on its own once the run passes the threshold.
 */
export function formatWorkingMessage(base: string, tokens: number, elapsedMs: number): string {
  const parts: string[] = []
  if (tokens > 0) parts.push(`\u2193 ${formatTokenCount(tokens)} tokens`)
  if (tokens > 0 || elapsedMs >= SHOW_TIMER_AFTER_MS) parts.push(formatElapsed(elapsedMs))
  return parts.length > 0 ? `${base} (${parts.join(' \u00b7 ')})` : base
}

interface UiLike {
  readonly ui?: WorkingUi | undefined
}

function workingUi(ctx: unknown): WorkingUi | undefined {
  const ui = (ctx as UiLike | undefined)?.ui
  return ui === undefined ? undefined : ui
}

/**
 * Drive the working message during a run. Registers no listener when the
 * working row is disabled.
 */
export function installWorkingTracker(pi: ExtensionAPI, config: WorkingConfig): void {
  if (!config.enabled) return

  const base = config.message ?? DEFAULT_WORKING_LABEL
  let ui: WorkingUi | undefined
  let startedAt = 0
  let settledTokens = 0
  let currentTokens = 0
  let last = ''
  let timer: ReturnType<typeof setInterval> | undefined

  const elapsed = (): number => (startedAt === 0 ? 0 : Date.now() - startedAt)

  const stopTimer = (): void => {
    if (timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }

  const sync = (force = false): void => {
    if (ui === undefined) return
    const next = formatWorkingMessage(base, settledTokens + currentTokens, elapsed())
    if (!force && next === last) return
    last = next
    try {
      ui.setWorkingMessage(next)
    } catch {
      // A replaced session invalidates the captured context; stop decorating.
      stopTimer()
      ui = undefined
    }
  }

  const startTimer = (): void => {
    if (timer !== undefined) return
    timer = setInterval(() => sync(), WORKING_REFRESH_MS)
    timer.unref?.()
  }

  const reset = (nextUi: WorkingUi | undefined): void => {
    ui = nextUi
    startedAt = Date.now()
    settledTokens = 0
    currentTokens = 0
    last = ''
    sync(true)
    startTimer()
  }

  const finish = (): void => {
    stopTimer()
    const previous = ui
    ui = undefined
    startedAt = 0
    settledTokens = 0
    currentTokens = 0
    last = ''
    try {
      previous?.setWorkingMessage(config.message ?? undefined)
    } catch {
      // Session already gone.
    }
  }

  pi.on('agent_start', (_event, ctx) => {
    reset(workingUi(ctx))
  })

  pi.on('turn_start', (_event, ctx) => {
    const next = workingUi(ctx)
    if (next !== undefined) ui = next
    if (startedAt === 0) startedAt = Date.now()
    startTimer()
    sync()
  })

  pi.on('message_update', (event, ctx) => {
    const next = workingUi(ctx)
    if (next !== undefined) ui = next
    currentTokens = outputTokens(event.message)
    startTimer()
    sync()
  })

  pi.on('message_end', (event, ctx) => {
    if (event.message.role !== 'assistant') return
    const next = workingUi(ctx)
    if (next !== undefined) ui = next
    settledTokens += outputTokens(event.message)
    currentTokens = 0
    sync()
  })

  pi.on('agent_end', () => finish())
  pi.on('session_shutdown', () => finish())
}
