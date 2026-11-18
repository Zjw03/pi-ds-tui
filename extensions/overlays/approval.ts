/**
 * Approval overlay: a small, keyboard-first panel used by the `/ds-approve`
 * demo and, later, by real permission prompts.
 */
import type { Component, TUI } from '@earendil-works/pi-tui'
import type { ExtensionContext, KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent'
import { wrapLines } from '../ui/text.ts'
import { renderPanel } from './base.ts'

export type ApprovalResult = 'allow' | 'deny' | 'always' | undefined

export interface ApprovalRequest {
  readonly title: string
  readonly tool: string
  readonly detail?: string
}

export interface ApprovalOption {
  readonly label: string
  readonly result: Exclude<ApprovalResult, undefined>
}

export const APPROVAL_OPTIONS: readonly ApprovalOption[] = [
  { label: 'Allow', result: 'allow' },
  { label: 'Deny', result: 'deny' },
  { label: 'Always allow', result: 'always' },
]

export interface ApprovalKeys {
  matches(
    data: string,
    binding: 'tui.select.up' | 'tui.select.down' | 'tui.select.confirm' | 'tui.select.cancel',
  ): boolean
}

export class ApprovalPanel implements Component {
  readonly #request: ApprovalRequest
  readonly #theme: Theme
  readonly #keys: ApprovalKeys
  readonly #tui: Pick<TUI, 'requestRender'>
  readonly #done: (result: ApprovalResult) => void
  #selected = 0
  #finished = false

  constructor(
    request: ApprovalRequest,
    theme: Theme,
    keys: ApprovalKeys,
    tui: Pick<TUI, 'requestRender'>,
    done: (result: ApprovalResult) => void,
  ) {
    this.#request = request
    this.#theme = theme
    this.#keys = keys
    this.#tui = tui
    this.#done = done
  }

  render(width: number): string[] {
    return renderApproval(this.#request, this.#selected, width, this.#theme)
  }

  handleInput(data: string): void {
    if (this.#finished) return

    if (this.#keys.matches(data, 'tui.select.up')) {
      this.#selected = (this.#selected + APPROVAL_OPTIONS.length - 1) % APPROVAL_OPTIONS.length
      this.#tui.requestRender()
      return
    }
    if (this.#keys.matches(data, 'tui.select.down')) {
      this.#selected = (this.#selected + 1) % APPROVAL_OPTIONS.length
      this.#tui.requestRender()
      return
    }
    if (this.#keys.matches(data, 'tui.select.confirm')) {
      this.#finish(APPROVAL_OPTIONS[this.#selected]?.result)
      return
    }
    if (this.#keys.matches(data, 'tui.select.cancel')) {
      this.#finish(undefined)
    }
  }

  invalidate(): void {}

  #finish(result: ApprovalResult): void {
    if (this.#finished) return
    this.#finished = true
    this.#done(result)
  }
}

export function renderApproval(
  request: ApprovalRequest,
  selected: number,
  width: number,
  theme: Theme,
): string[] {
  if (width <= 0) return []
  const body: string[] = [theme.fg('dim', `tool: ${request.tool}`)]
  if (request.detail !== undefined && request.detail.length > 0) {
    body.push(...wrapLines(request.detail, Math.max(1, width - 4)))
  }
  body.push('')

  for (const [index, option] of APPROVAL_OPTIONS.entries()) {
    const label = `${index === selected ? '\u276f' : ' '} ${option.label}`
    body.push(index === selected ? theme.fg('accent', label) : theme.fg('muted', label))
  }

  body.push('', theme.fg('dim', '\u2191/\u2193 select \u00b7 enter confirm \u00b7 esc cancel'))
  return renderPanel(request.title, body, width, theme)
}

export function showApproval(
  ctx: ExtensionContext,
  request: ApprovalRequest,
): Promise<ApprovalResult> {
  return ctx.ui.custom<ApprovalResult>(
    (tui, theme, keybindings: KeybindingsManager, done) =>
      new ApprovalPanel(request, theme, keybindings, tui, done),
    {
      overlay: true,
      overlayOptions: {
        width: '70%',
        minWidth: 20,
        maxHeight: '70%',
        anchor: 'center',
        margin: 1,
      },
      blocked: { kind: 'permission', message: request.title },
    },
  )
}
