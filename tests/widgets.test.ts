import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_CONFIG } from '../extensions/config.ts'
import {
  ABOVE_KEY,
  BELOW_KEY,
  GoalTodoWidget,
  HintWidget,
  clearWidgets,
  createWidgetState,
  installWidgets,
  toggleWidgets,
  type WidgetState,
  type WidgetUi,
} from '../extensions/ui/widgets.ts'
import { assertWidth } from './helpers/render.ts'

const theme = {
  fg: (_color: string, text: string) => text,
}

function state(overrides: Partial<WidgetState> = {}): WidgetState {
  return {
    goal: 'Ship the dsh-tui style interface',
    todos: ['[x] Header and footer', '[ ] Widgets', '[ ] Tool cards'],
    expanded: true,
    ...overrides,
  }
}

function config(overrides: Partial<typeof DEFAULT_CONFIG.widgets> = {}) {
  return { ...DEFAULT_CONFIG.widgets, ...overrides }
}

test('expanded goal widget lists done and pending todos', () => {
  const lines = new GoalTodoWidget(state(), config(), theme).render(40)
  assertWidth(lines, 40)
  const text = lines.join('\n')
  assert.ok(text.includes('Goal'))
  assert.ok(text.includes('Ship the dsh-tui style interface'))
  assert.ok(text.includes('\u2713'))
  assert.ok(text.includes('Header and footer'))
  assert.ok(text.includes('Widgets'))
  assert.ok(text.includes('Tool cards'))
})

test('collapsed goal widget shows progress only', () => {
  const lines = new GoalTodoWidget(state({ expanded: false }), config(), theme).render(40)
  assertWidth(lines, 40)
  const text = lines.join('\n')
  assert.ok(text.includes('1/3 done'))
  assert.ok(text.includes('/ds-widgets'))
  assert.ok(!text.includes('Widgets'))
})

test('maxHeight caps the panel and reserves an overflow line', () => {
  const lines = new GoalTodoWidget(state(), config({ maxHeight: 2 }), theme).render(40)
  assertWidth(lines, 40)
  assert.equal(lines.length, 2)
  assert.ok(lines[1]?.includes('+3 more'))
})

test('maxHeight 1 keeps only the goal line', () => {
  const lines = new GoalTodoWidget(state(), config({ maxHeight: 1 }), theme).render(40)
  assert.equal(lines.length, 1)
  assert.ok(lines[0]?.includes('Goal'))
})

test('an empty todo list still renders the goal', () => {
  const lines = new GoalTodoWidget(state({ todos: [] }), config(), theme).render(40)
  assert.ok(lines.join('\n').includes('No todos'))
})

test('the widget respects narrow widths', () => {
  for (const width of [10, 20, 40]) {
    assertWidth(new GoalTodoWidget(state(), config(), theme).render(width), width)
  }
})

test('the hint widget respects the width', () => {
  for (const width of [10, 40, 80]) {
    const lines = new HintWidget(theme).render(width)
    assertWidth(lines, width)
    assert.equal(lines.length, 1)
  }
})

test('installWidgets sets both keys and clearWidgets removes them', () => {
  const calls: Array<{ key: string; content: unknown; options?: { placement?: string } | undefined }> = []
  // SAFETY: the fake only implements the setWidget overloads used here.
  const ui = {
    setWidget: (key: string, content: unknown, options?: { placement?: string }) => {
      calls.push({ key, content, options })
    },
  } as unknown as WidgetUi

  installWidgets(ui, config({ above: true, below: true }), state())
  assert.equal(calls[0]?.key, ABOVE_KEY)
  assert.equal(typeof calls[0]?.content, 'function')
  assert.equal(calls[1]?.key, BELOW_KEY)
  assert.equal(typeof calls[1]?.content, 'function')
  assert.equal(calls[1]?.options?.placement, 'belowEditor')

  clearWidgets(ui)
  assert.equal(calls.at(-2)?.key, ABOVE_KEY)
  assert.equal(calls.at(-2)?.content, undefined)
  assert.equal(calls.at(-1)?.key, BELOW_KEY)
  assert.equal(calls.at(-1)?.content, undefined)
})

test('installWidgets clears disabled slots', () => {
  const calls: Array<{ key: string; content: unknown }> = []
  // SAFETY: the fake only implements the setWidget overloads used here.
  const ui = {
    setWidget: (key: string, content: unknown) => calls.push({ key, content }),
  } as unknown as WidgetUi

  installWidgets(ui, config({ above: false, below: false }), state())
  assert.deepEqual(calls, [
    { key: ABOVE_KEY, content: undefined },
    { key: BELOW_KEY, content: undefined },
  ])
})

test('toggleWidgets flips the expanded flag', () => {
  const value = state()
  assert.equal(value.expanded, true)
  assert.equal(toggleWidgets(value), false)
  assert.equal(toggleWidgets(value), true)
})

test('createWidgetState copies config arrays', () => {
  const value = createWidgetState(config())
  assert.equal(value.expanded, true)
  assert.deepEqual(value.todos, config().todos)
})
