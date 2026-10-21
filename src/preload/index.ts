import { contextBridge, ipcRenderer } from 'electron'
import { CH, type Api } from '../shared/ipc'
import type { BriefingPayload } from '../shared/types'

const api: Api = {
  events: {
    range: (q) => ipcRenderer.invoke(CH.eventsRange, q),
    create: (input) => ipcRenderer.invoke(CH.eventsCreate, input),
    update: (id, patch, scope, occurrenceStartISO) =>
      ipcRenderer.invoke(CH.eventsUpdate, { id, patch, scope, occurrenceStartISO }),
    remove: (id, scope, occurrenceStartISO) =>
      ipcRenderer.invoke(CH.eventsRemove, { id, scope, occurrenceStartISO }),
    search: (q) => ipcRenderer.invoke(CH.eventsSearch, q),
    setDone: (id, occurrenceStartISO, done) =>
      ipcRenderer.invoke(CH.eventsSetDone, { id, occurrenceStartISO, done })
  },
  meta: {
    categories: () => ipcRenderer.invoke(CH.metaCategories),
    saveCategory: (c) => ipcRenderer.invoke(CH.metaSaveCategory, c),
    deleteCategory: (id) => ipcRenderer.invoke(CH.metaDeleteCategory, id),
    settings: () => ipcRenderer.invoke(CH.metaSettings),
    patchSettings: (patch) => ipcRenderer.invoke(CH.metaPatchSettings, patch),
    appInfo: () => ipcRenderer.invoke(CH.metaAppInfo)
  },
  briefing: {
    snooze: (payload: BriefingPayload, minutes: number) =>
      ipcRenderer.invoke(CH.briefingSnooze, { payload, minutes }),
    dismiss: (payload: BriefingPayload) => ipcRenderer.invoke(CH.briefingDismiss, payload),
    openEvent: (payload: BriefingPayload) => ipcRenderer.invoke(CH.briefingOpenEvent, payload),
    onShow: (cb) => {
      const handler = (_e: unknown, payload: BriefingPayload): void => cb(payload)
      ipcRenderer.on(CH.briefingShow, handler)
      return () => ipcRenderer.off(CH.briefingShow, handler)
    }
  },
  win: {
    minimize: () => ipcRenderer.invoke(CH.winMinimize),
    close: () => ipcRenderer.invoke(CH.winClose),
    hide: () => ipcRenderer.invoke(CH.winHide),
    toggleMaximize: () => ipcRenderer.invoke(CH.winToggleMaximize),
    showBriefingNow: () => ipcRenderer.invoke('system:show-briefing-now'),
    openMain: () => ipcRenderer.invoke(CH.winOpenMain),
    onFocusEvent: (cb) => {
      const handler = (_e: unknown, payload: { id: string; occurrenceStartISO: string }): void => cb(payload)
      ipcRenderer.on(CH.winFocusEvent, handler)
      return () => ipcRenderer.off(CH.winFocusEvent, handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
