import test from 'node:test'
import assert from 'node:assert/strict'
import { STATUS_KEY, clearWorkingStatus, setWorkingStatus } from '../extensions/ui/status.ts'

test('the status key is stable', () => {
  assert.equal(STATUS_KEY, 'pi-ds-tui')
})

test('setWorkingStatus writes and clearWorkingStatus clears', () => {
  const calls: Array<[string, string | undefined]> = []
  const ui = { setStatus: (key: string, text: string | undefined) => calls.push([key, text]) }
  setWorkingStatus(ui)
  clearWorkingStatus(ui)
  assert.deepEqual(calls, [
    [STATUS_KEY, 'working'],
    [STATUS_KEY, undefined],
  ])
})
