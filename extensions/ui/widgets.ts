/**
 * Editor widgets: a goal/todo panel above the editor and a hint line below it.
 *
 * Both are pure components over a small shared state. The state is config
 * driven for M3; later milestones can feed it from real session data without
 * changing the components.
 */
import type { Component, TUI } from '@earendil-works/pi-tui'
import type { ExtensionUIContext, Theme } from '@earendil-works/pi-coding-agent'
import type { WidgetsConfig } from '../config.ts'
import { fitLine } from './text.ts'

export const ABOVE_KEY = 'pi-ds-tui:above'
export const BELOW_KEY = 'pi-ds-tui:below'

const OPEN_BOX = '\u25a1'
const DONE_MARK = '\u2713'

export interface WidgetState {
  goal: string | null
  todos: readonly string[]
  expanded: boolean
}

export interface WidgetTheme {
  fg(color: string, text: string): string
}

export type WidgetUi = Pick<ExtensionUIContext, 'setWidget'>

let activeTui: Pick<TUI, 'requestRender'> | undefined

export function createWidgetState(config: WidgetsConfig): WidgetState {
  return {
    goal: config.goal,
    todos: [...config.todos],
    expanded: true,
  }
}

/** Flip the goal panel between collapsed and expanded; returns the new state. */
export function toggleWidgets(state: WidgetState): boolean {
  state.expanded = !state.expanded
  activeTui?.requestRender()
  return state.expanded
}

export class GoalTodoWidget implements Component {
  readonly #state: WidgetState
  readonly #config: WidgetsConfig
  readonly #theme: WidgetTheme

  constructor(state: WidgetState, config: WidgetsConfig, theme: WidgetTheme) {
    this.#state = state
    this.#config = config
    this.#theme = theme
  }

  render(width: number): string[] {
    if (width <= 0) return []
    const lines: string[] = []
    const goal = this.#state.goal ?? 'No goal set'
    lines.push(`${this.#theme.fg('accent', 'Goal')} ${this.#theme.fg('text', goal)}`)

    const todos = this.#state.todos.map(parseTodo)
    if (todos.length === 0) {
      lines.push(this.#theme.fg('dim', 'No todos'))
      return lines.map((line) => fitLine(line, width))
    }

    const done = todos.filter((todo) => todo.done).length
    if (!this.#state.expanded) {
      lines.push(this.#theme.fg('dim', `${done}/${todos.length} done \u00b7 /ds-widgets to expand`))
      return lines.map((line) => fitLine(line, width))
    }

    const max = Math.max(1, this.#config.maxHeight)
    const room = Math.max(0, max - 2)
    const shown = todos.slice(0, room)
    for (const todo of shown) {
      const marker = todo.done
        ? this.#theme.fg('success', DONE_MARK)
        : this.#theme.fg('muted', OPEN_BOX)
      const text = todo.done
        ? this.#theme.fg('dim', todo.text)
        : this.#theme.fg('text', todo.text)
      lines.push(`  ${marker} ${text}`)
    }
    if (shown.length < todos.length && lines.length < max) {
      lines.push(this.#theme.fg('dim', `  \u2026 +${todos.length - shown.length} more`))
    }

    return lines.slice(0, max).map((line) => fitLine(line, width))
  }

  invalidate(): void {}
}

export class HintWidget implements Component {
  readonly #theme: WidgetTheme

  constructor(theme: WidgetTheme) {
    this.#theme = theme
  }

  render(width: number): string[] {
    if (width <= 0) return []
    return [
      fitLine(
        this.#theme.fg('dim', 'Enter send \u00b7 Shift+Enter newline \u00b7 / commands \u00b7 Esc cancel'),
        width,
      ),
    ]
  }

  invalidate(): void {}
}

/** Install the configured widgets. Disabled or empty slots are cleared. */
export function installWidgets(ui: WidgetUi, config: WidgetsConfig, state: WidgetState): void {
  if (config.above && (state.goal !== null || state.todos.length > 0)) {
    ui.setWidget(ABOVE_KEY, (tui: TUI, theme: Theme) => {
      activeTui = tui
      return new GoalTodoWidget(state, config, theme)
    })
  } else {
    ui.setWidget(ABOVE_KEY, undefined)
  }

  if (config.below) {
    ui.setWidget(
      BELOW_KEY,
      (tui: TUI, theme: Theme) => {
        activeTui = tui
        return new HintWidget(theme)
      },
      { placement: 'belowEditor' },
    )
  } else {
    ui.setWidget(BELOW_KEY, undefined)
  }
}

/** Remove both widgets and drop the render handle. */
export function clearWidgets(ui: WidgetUi): void {
  ui.setWidget(ABOVE_KEY, undefined)
  ui.setWidget(BELOW_KEY, undefined)
  activeTui = undefined
}

interface ParsedTodo {
  readonly done: boolean
  readonly text: string
}

function parseTodo(todo: string): ParsedTodo {
  const match = /^\[([xX ])\]\s*(.*)$/.exec(todo)
  if (match === null) return { done: false, text: todo }
  return { done: match[1]?.toLowerCase() === 'x', text: match[2] ?? '' }
}
