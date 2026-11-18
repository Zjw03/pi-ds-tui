/**
 * Working row. Uses pi's public working message/indicator controls; the editor
 * does not embed the status, so this remains a separate row.
 */
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
    intervalMs: 90,
  })
  ui.setWorkingVisible(true)
}

export function clearWorking(ui: WorkingUi): void {
  ui.setWorkingMessage()
  ui.setWorkingIndicator()
  ui.setWorkingVisible(true)
}
