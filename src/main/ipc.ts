import { app, ipcMain } from 'electron'
import { z } from 'zod'
import { CH } from '../shared/ipc'
import * as repo from './repo'
import { dismissBriefing, requestBriefing, snoozeBriefing } from './briefing'
import { getBriefingWindow, hideBriefingWindow } from './windows/briefing'
import { getMainWindow, hideMainWindow, showMainWindow } from './windows/main'

const eventInputSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200),
  notes: z.string().max(4000).nullable().optional(),
  categoryId: z.string().max(64).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  startISO: z.string().min(10),
  endISO: z.string().min(10),
  allDay: z.boolean().optional(),
  rrule: z.string().max(400).nullable().optional(),
  rruleUntil: z.string().nullable().optional(),
  leadMin: z.number().int().min(0).max(1440).nullable().optional()
})

const rangeSchema = z.object({ fromISO: z.string().min(10), toISO: z.string().min(10) })
const scopeSchema = z.enum(['this', 'future', 'all'])
const settingsSchema = z.object({
  defaultLeadMinutes: z.number().int().min(0).max(240).optional(),
  autoLaunch: z.boolean().optional(),
  reduceTransparency: z.boolean().optional(),
  mutedUntil: z.string().nullable().optional(),
  closeHintShown: z.boolean().optional()
})

export function registerIpc(): void {
  ipcMain.handle(CH.eventsRange, (_e, raw) => {
    const q = rangeSchema.parse(raw)
    return repo.listRange(q.fromISO, q.toISO)
  })

  ipcMain.handle(CH.eventsCreate, (_e, raw) => repo.createEvent(eventInputSchema.parse(raw)))

  ipcMain.handle(CH.eventsUpdate, (_e, raw: { id: string; patch: unknown; scope: unknown; occurrenceStartISO?: string }) => {
    repo.updateEvent(raw.id, eventInputSchema.partial().parse(raw.patch), scopeSchema.parse(raw.scope), raw.occurrenceStartISO)
    return true
  })

  ipcMain.handle(CH.eventsRemove, (_e, raw: { id: string; scope: unknown; occurrenceStartISO?: string }) => {
    repo.removeEvent(raw.id, scopeSchema.parse(raw.scope), raw.occurrenceStartISO)
    return true
  })

  ipcMain.handle(CH.eventsSearch, (_e, raw: { text: string }) => repo.searchEvents(String(raw?.text ?? '')))

  ipcMain.handle(CH.eventsSetDone, (_e, raw: { id: string; occurrenceStartISO: string; done: boolean }) => {
    repo.setDone(raw.id, raw.occurrenceStartISO, Boolean(raw.done))
    return true
  })

  ipcMain.handle(CH.metaCategories, () => repo.listCategories())
  ipcMain.handle(CH.metaSaveCategory, (_e, raw: { id: string; name: string; color: string; sort?: number }) =>
    repo.saveCategory(raw)
  )
  ipcMain.handle(CH.metaDeleteCategory, (_e, id: string) => repo.deleteCategory(id))

  ipcMain.handle(CH.metaSettings, () => repo.getSettings())
  ipcMain.handle(CH.metaPatchSettings, (_e, raw) => {
    const next = repo.patchSettings(settingsSchema.parse(raw))
    if (app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: next.autoLaunch, args: ['--hidden'] })
    }
    return next
  })

  ipcMain.handle(CH.metaAppInfo, () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    dataPath: app.getPath('userData'),
    platform: process.platform,
    supportsAcrylic: process.platform === 'win32'
  }))

  ipcMain.handle(CH.briefingSnooze, (_e, raw: { payload: never; minutes: number }) => {
    snoozeBriefing(raw.payload, Number(raw.minutes) || 10)
    return true
  })
  ipcMain.handle(CH.briefingDismiss, (_e, payload) => {
    dismissBriefing(payload)
    return true
  })
  ipcMain.handle(CH.briefingOpenEvent, (_e, payload) => {
    const win = getBriefingWindow()
    if (win) win.hide()
    const main = showMainWindow()
    const focus = { id: payload?.event?.id, occurrenceStartISO: payload?.event?.occurrenceStartISO }
    const send = (): void => {
      if (!main.isDestroyed()) main.webContents.send(CH.winFocusEvent, focus)
    }
    if (main.webContents.isLoading()) {
      main.webContents.once('did-finish-load', () => setTimeout(send, 600))
    } else {
      send()
    }
    return true
  })

  ipcMain.handle(CH.winMinimize, () => {
    getMainWindow()?.minimize()
    return true
  })
  ipcMain.handle(CH.winClose, () => {
    hideMainWindow()
    return true
  })
  ipcMain.handle(CH.winHide, () => {
    hideMainWindow()
    return true
  })
  ipcMain.handle(CH.winToggleMaximize, () => {
    const win = getMainWindow()
    if (!win) return false
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
    return win.isMaximized()
  })
  ipcMain.handle(CH.winOpenMain, () => {
    showMainWindow()
    return true
  })

  ipcMain.handle('system:show-briefing-now', () => {
    requestBriefing('manual', { force: true })
    return true
  })
  ipcMain.handle('system:hide-briefing', () => {
    hideBriefingWindow()
    return true
  })
}
