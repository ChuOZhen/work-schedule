export type EditScope = 'this' | 'future' | 'all'

export type BriefingReason = 'boot' | 'unlock' | 'resume' | 'lead' | 'snooze' | 'manual'

export interface Category {
  id: string
  name: string
  color: string
  sort: number
}

export interface EventRecord {
  id: string
  title: string
  notes: string | null
  categoryId: string | null
  color: string | null
  startISO: string
  endISO: string
  allDay: boolean
  rrule: string | null
  rruleUntil: string | null
  leadMin: number | null
  createdAt: string
  updatedAt: string
}

/** 展开后的单次事件实例（重复事件会产生多条） */
export interface Occurrence {
  /** 母事件 id（重复事件多次出现共享） */
  id: string
  /** 该实例的开始时间，同时作为实例唯一键 */
  occurrenceStartISO: string
  title: string
  notes: string | null
  categoryId: string | null
  color: string
  categoryName: string | null
  startISO: string
  endISO: string
  allDay: boolean
  rrule: string | null
  leadMin: number | null
  done: boolean
  isRecurring: boolean
}

export interface EventInput {
  title: string
  notes?: string | null
  categoryId?: string | null
  color?: string | null
  startISO: string
  endISO: string
  allDay?: boolean
  rrule?: string | null
  rruleUntil?: string | null
  leadMin?: number | null
  repeat?: RepeatPreset
}

export type RepeatPreset =
  | { kind: 'none' }
  | { kind: 'daily'; interval?: number; untilISO?: string | null }
  | { kind: 'weekly'; byWeekday: number[]; interval?: number; untilISO?: string | null }
  | { kind: 'monthly'; interval?: number; untilISO?: string | null }
  | { kind: 'yearly'; interval?: number; untilISO?: string | null }

export interface Settings {
  /** 事件默认提前提醒分钟数 */
  defaultLeadMinutes: number
  autoLaunch: boolean
  reduceTransparency: boolean
  /** ISO 时间；此时间前不弹任何提醒 */
  mutedUntil: string | null
  /** 首次关闭窗口提示是否已展示 */
  closeHintShown: boolean
}

export interface BriefingEvent {
  id: string
  occurrenceStartISO: string
  title: string
  notes: string | null
  startISO: string
  endISO: string
  color: string
  categoryName: string | null
  allDay: boolean
}

export interface BriefingPayload {
  reason: BriefingReason
  event: BriefingEvent
  /** "还有 12 分钟" / "正在进行 · 剩 30 分钟" / "已开始 5 分钟" */
  relativeLabel: string
  /** "16:00 – 17:30" 或 "全天" */
  timeLabel: string
  /** "今天 · 周三" / "明天 · 周四" */
  dayLabel: string
  leadMinutes: number
}

export interface SearchHit extends Occurrence {
  /** 匹配的年月日，用于跳转 */
  jumpWeekISO: string
}

export interface AppInfo {
  version: string
  electron: string
  dataPath: string
  platform: string
  supportsAcrylic: boolean
}
