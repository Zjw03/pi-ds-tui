/**
 * Extension status line. The custom footer reads this through
 * `footerData.getExtensionStatuses()`; pi's built-in footer shows it too.
 */
export const STATUS_KEY = 'pi-ds-tui'

export interface StatusUi {
  setStatus(key: string, text: string | undefined): void
}

export function setWorkingStatus(ui: StatusUi): void {
  ui.setStatus(STATUS_KEY, 'working')
}

export function clearWorkingStatus(ui: StatusUi): void {
  ui.setStatus(STATUS_KEY, undefined)
}
