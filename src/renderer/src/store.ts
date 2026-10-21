import { create } from 'zustand'
import type { AppInfo, Category, Occurrence, Settings } from '@shared/types'
import { addWeeks, combine, hhmm, startOfWeek, ymd } from './lib/date'
import { buildRRule, parseRepeat, type RepeatKind } from './lib/repeat'

export interface Draft {
  id?: string
  occurrenceStartISO?: string
  title: string
  date: string
  start: string
  end: string
  allDay: boolean
  categoryId: string | null
  color: string | null
  repeat: RepeatKind
  originRepeat: RepeatKind
  leadMin: number | null
  notes: string
  recurring: boolean
  done: boolean
}

export interface EditorState {
  mode: 'create' | 'edit'
  draft: Draft
  anchor: { x: number; y: number }
}

interface Store {
  weekStart: number
  events: Occurrence[]
  categories: Category[]
  settings: Settings | null
  appInfo: AppInfo | null
  editor: EditorState | null
  searchOpen: boolean
  settingsOpen: boolean
  toast: { text: string; key: number } | null
  focusKey: string | null
  loading: boolean

  init: () => Promise<void>
  setWeek: (ts: number) => void
  shiftWeek: (n: number) => void
  goToday: () => void
  reload: () => Promise<void>
  loadMeta: () => Promise<void>
  newDraft: (anchor: { x: number; y: number }, startAt?: Date) => void
  openDraft: (occ: Occurrence, anchor: { x: number; y: number }) => void
  patchDraft: (patch: Partial<Draft>) => void
  closeEditor: () => void
  saveDraft: () => Promise<void>
  deleteDraft: (scope: 'this' | 'all') => Promise<void>
  toggleDone: (occ: Occurrence) => Promise<void>
  notify: (text: string) => void
  setSearchOpen: (v: boolean) => void
  setSettingsOpen: (v: boolean) => void
  focusOccurrence: (id: string, occurrenceStartISO: string) => Promise<void>
  clearFocus: () => void
}

export function draftFromOccurrence(occ: Occurrence): Draft {
  const start = new Date(occ.startISO)
  const end = new Date(occ.endISO)
  const repeat = parseRepeat(occ.rrule)
  return {
    id: occ.id,
    occurrenceStartISO: occ.occurrenceStartISO,
    title: occ.title,
    date: ymd(start),
    start: hhmm(start),
    end: hhmm(end),
    allDay: occ.allDay,
    categoryId: occ.categoryId,
    color: occ.color,
    repeat,
    originRepeat: repeat,
    leadMin: occ.leadMin,
    notes: occ.notes ?? '',
    recurring: Boolean(occ.rrule),
    done: occ.done
  }
}

function emptyDraft(categories: Category[], startAt: Date): Draft {
  const start = new Date(startAt)
  start.setMinutes(Math.floor(start.getMinutes() / 15) * 15, 0, 0)
  const end = new Date(start.getTime() + 30 * 60000)
  return {
    title: '',
    date: ymd(start),
    start: hhmm(start),
    end: hhmm(end),
    allDay: false,
    categoryId: categories[0]?.id ?? null,
    color: null,
    repeat: 'none',
    originRepeat: 'none',
    leadMin: null,
    notes: '',
    recurring: false,
    done: false
  }
}

let toastSeq = 0

export const useStore = create<Store>((set, get) => ({
  weekStart: startOfWeek(new Date()).getTime(),
  events: [],
  categories: [],
  settings: null,
  appInfo: null,
  editor: null,
  searchOpen: false,
  settingsOpen: false,
  toast: null,
  focusKey: null,
  loading: false,

  init: async () => {
    await get().loadMeta()
    await get().reload()
  },

  loadMeta: async () => {
    const [categories, settings, appInfo] = await Promise.all([
      window.api.meta.categories(),
      window.api.meta.settings(),
      window.api.meta.appInfo()
    ])
    set({ categories, settings, appInfo })
    document.body.dataset.reduceTransparency = String(settings.reduceTransparency)
  },

  reload: async () => {
    const from = new Date(get().weekStart)
    const to = new Date(from.getTime() + 7 * 86400000)
    set({ loading: true })
    const events = await window.api.events.range({
      fromISO: from.toISOString(),
      toISO: to.toISOString()
    })
    set({ events, loading: false })
  },

  setWeek: (ts) => {
    set({ weekStart: startOfWeek(new Date(ts)).getTime() })
    void get().reload()
  },

  shiftWeek: (n) => {
    set({ weekStart: addWeeks(new Date(get().weekStart), n).getTime() })
    void get().reload()
  },

  goToday: () => get().setWeek(Date.now()),

  newDraft: (anchor, startAt) => {
    const start = startAt ?? new Date()
    set({
      editor: {
        mode: 'create',
        anchor,
        draft: emptyDraft(get().categories, start)
      }
    })
  },

  openDraft: (occ, anchor) => {
    set({ editor: { mode: 'edit', anchor, draft: draftFromOccurrence(occ) } })
  },

  patchDraft: (patch) => {
    const editor = get().editor
    if (!editor) return
    set({ editor: { ...editor, draft: { ...editor.draft, ...patch } } })
  },

  closeEditor: () => set({ editor: null }),

  saveDraft: async () => {
    const editor = get().editor
    if (!editor) return
    const d = editor.draft
    if (!d.title.trim()) {
      get().notify('先给这件事起个名字')
      return
    }
    let start = combine(d.date, d.start)
    let end = combine(d.date, d.end)
    if (d.allDay) {
      start = combine(d.date, '00:00')
      end = combine(d.date, '23:59')
    }
    if (end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + 30 * 60000)
    }
    const rrule = buildRRule(d.repeat, start)
    const payload = {
      title: d.title.trim(),
      notes: d.notes.trim() ? d.notes.trim() : null,
      categoryId: d.categoryId,
      color: null,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      allDay: d.allDay,
      rrule,
      leadMin: d.leadMin
    }
    try {
      if (editor.mode === 'create') {
        await window.api.events.create(payload)
      } else {
        const scope = d.recurring && d.repeat === d.originRepeat ? 'this' : 'all'
        await window.api.events.update(d.id!, payload, scope, d.occurrenceStartISO)
      }
      set({ editor: null })
      await get().reload()
      get().notify(editor.mode === 'create' ? '已加入日程' : '已保存')
    } catch (err) {
      get().notify(`保存失败：${String(err)}`)
    }
  },

  deleteDraft: async (scope) => {
    const editor = get().editor
    if (!editor?.draft.id) return
    const d = editor.draft
    try {
      await window.api.events.remove(d.id!, d.recurring ? scope : 'all', d.occurrenceStartISO)
      set({ editor: null })
      await get().reload()
      get().notify('已删除')
    } catch (err) {
      get().notify(`删除失败：${String(err)}`)
    }
  },

  toggleDone: async (occ) => {
    await window.api.events.setDone(occ.id, occ.occurrenceStartISO, !occ.done)
    await get().reload()
  },

  notify: (text) => {
    const key = ++toastSeq
    set({ toast: { text, key } })
    setTimeout(() => {
      if (get().toast?.key === key) set({ toast: null })
    }, 2600)
  },

  setSearchOpen: (v) => set({ searchOpen: v, settingsOpen: v ? false : get().settingsOpen }),
  setSettingsOpen: (v) => set({ settingsOpen: v, searchOpen: v ? false : get().searchOpen }),

  focusOccurrence: async (id, occurrenceStartISO) => {
    const date = new Date(occurrenceStartISO)
    set({ weekStart: startOfWeek(date).getTime() })
    await get().reload()
    set({ focusKey: `${id}|${occurrenceStartISO}` })
    setTimeout(() => get().clearFocus(), 2200)
  },

  clearFocus: () => set({ focusKey: null })
}))
