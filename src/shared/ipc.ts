import type {
  AppInfo,
  BriefingPayload,
  BriefingReason,
  Category,
  EditScope,
  EventInput,
  Occurrence,
  SearchHit,
  Settings
} from './types'

export const CH = {
  eventsRange: 'events:range',
  eventsCreate: 'events:create',
  eventsUpdate: 'events:update',
  eventsRemove: 'events:remove',
  eventsSearch: 'events:search',
  eventsSetDone: 'events:setDone',

  metaCategories: 'meta:categories',
  metaSaveCategory: 'meta:saveCategory',
  metaDeleteCategory: 'meta:deleteCategory',
  metaSettings: 'meta:settings',
  metaPatchSettings: 'meta:patch-settings',
  metaAppInfo: 'meta:app-info',

  briefingSnooze: 'briefing:snooze',
  briefingDismiss: 'briefing:dismiss',
  briefingOpenEvent: 'briefing:open-event',
  briefingShow: 'briefing:show',

  winMinimize: 'win:minimize',
  winClose: 'win:close',
  winHide: 'win:hide',
  winToggleMaximize: 'win:toggle-maximize',
  briefingClosing: 'briefing:closing',
  winOpenMain: 'win:open-main',
  winFocusEvent: 'win:focus-event'
} as const

export interface Api {
  events: {
    range(q: { fromISO: string; toISO: string }): Promise<Occurrence[]>
    create(input: EventInput): Promise<Occurrence>
    update(id: string, patch: Partial<EventInput>, scope: EditScope, occurrenceStartISO?: string): Promise<void>
    remove(id: string, scope: EditScope, occurrenceStartISO?: string): Promise<void>
    search(q: { text: string }): Promise<SearchHit[]>
    setDone(id: string, occurrenceStartISO: string, done: boolean): Promise<void>
  }
  meta: {
    categories(): Promise<Category[]>
    saveCategory(c: Omit<Category, 'sort'> & { sort?: number }): Promise<Category[]>
    deleteCategory(id: string): Promise<Category[]>
    settings(): Promise<Settings>
    patchSettings(patch: Partial<Settings>): Promise<Settings>
    appInfo(): Promise<AppInfo>
  }
  briefing: {
    snooze(payload: BriefingPayload, minutes: number): Promise<void>
    dismiss(payload: BriefingPayload): Promise<void>
    openEvent(payload: BriefingPayload): Promise<void>
    onShow(cb: (payload: BriefingPayload) => void): () => void
  }
  win: {
    minimize(): Promise<void>
    close(): Promise<void>
    hide(): Promise<void>
    toggleMaximize(): Promise<void>
    showBriefingNow(): Promise<void>
    openMain(): Promise<void>
    onFocusEvent(cb: (payload: { id: string; occurrenceStartISO: string }) => void): () => void
  }
}

export const BRIEFING_REASONS: BriefingReason[] = ['boot', 'unlock', 'resume', 'lead', 'snooze', 'manual']
