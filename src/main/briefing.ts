import { CH } from '../shared/ipc'
import type { BriefingPayload, BriefingReason, Occurrence } from '../shared/types'
import { getSettings, listRange, markReminded } from './repo'
import { dayLabelOf, fmtRange, relativeLabelOf } from './time'
import { ensureBriefingWindow, getBriefingWindow, hideBriefingWindow } from './windows/briefing'

let lastAutoShowAt = 0
const AUTO_THROTTLE_MS = 45_000
const snoozeTimers = new Map<string, NodeJS.Timeout>()

export function buildPayload(occ: Occurrence, reason: BriefingReason, leadMinutes: number): BriefingPayload {
  const start = new Date(occ.startISO)
  const end = new Date(occ.endISO)
  return {
    reason,
    event: {
      id: occ.id,
      occurrenceStartISO: occ.occurrenceStartISO,
      title: occ.title,
      notes: occ.notes,
      startISO: occ.startISO,
      endISO: occ.endISO,
      color: occ.color,
      categoryName: occ.categoryName,
      allDay: occ.allDay
    },
    relativeLabel: relativeLabelOf(start, end, occ.allDay),
    timeLabel: occ.allDay ? '全天' : fmtRange(start, end),
    dayLabel: dayLabelOf(start),
    leadMinutes
  }
}

/** 选出"现在最该关注的那一条"：进行中优先，其次是最近一条未来事件 */
export function pickFocusEvent(now = new Date()): { occ: Occurrence; lead: number } | null {
  const settings = getSettings()
  const from = new Date(now.getTime() - 6 * 3600 * 1000)
  const to = new Date(now.getTime() + 3 * 86400 * 1000)
  const list = listRange(from.toISOString(), to.toISOString()).filter((o) => !o.done)
  const ongoing = list.find((o) => new Date(o.startISO) <= now && new Date(o.endISO) > now)
  const upcoming = list.find((o) => new Date(o.startISO) > now)
  const candidate = ongoing ?? upcoming
  if (!candidate) return null
  return { occ: candidate, lead: candidate.leadMin ?? settings.defaultLeadMinutes }
}

function isMuted(): boolean {
  const { mutedUntil } = getSettings()
  return Boolean(mutedUntil && new Date(mutedUntil).getTime() > Date.now())
}

export function showBriefing(payload: BriefingPayload): void {
  const win = ensureBriefingWindow()
  const send = (): void => {
    if (win.isDestroyed()) return
    win.webContents.send(CH.briefingShow, payload)
    win.showInactive()
    win.setAlwaysOnTop(true, 'screen-saver')
  }
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () => send())
  } else {
    send()
  }
  lastAutoShowAt = Date.now()
}

/**
 * 触发一次简报。force=true 用于用户手动触发（不受静音与节流影响）
 */
export function requestBriefing(reason: BriefingReason, opts: { force?: boolean } = {}): boolean {
  if (!opts.force) {
    if (isMuted()) return false
    if (Date.now() - lastAutoShowAt < AUTO_THROTTLE_MS) return false
  }
  const picked = pickFocusEvent()
  if (!picked) return false
  if (reason === 'lead') markReminded(picked.occ.id, picked.occ.occurrenceStartISO)
  showBriefing(buildPayload(picked.occ, reason, picked.lead))
  return true
}

export function snoozeBriefing(payload: BriefingPayload, minutes: number): void {
  hideBriefingWindow()
  const key = `${payload.event.id}|${payload.event.occurrenceStartISO}`
  const existed = snoozeTimers.get(key)
  if (existed) clearTimeout(existed)
  const delay = Math.max(1, minutes) * 60_000
  snoozeTimers.set(
    key,
    setTimeout(() => {
      snoozeTimers.delete(key)
      const start = new Date(payload.event.startISO)
      const end = new Date(payload.event.endISO)
      showBriefing({
        ...payload,
        reason: 'snooze',
        relativeLabel: relativeLabelOf(start, end, payload.event.allDay),
        leadMinutes: minutes
      })
    }, delay)
  )
}

export function dismissBriefing(payload: BriefingPayload): void {
  const key = `${payload.event.id}|${payload.event.occurrenceStartISO}`
  const timer = snoozeTimers.get(key)
  if (timer) {
    clearTimeout(timer)
    snoozeTimers.delete(key)
  }
  hideBriefingWindow()
}

export function closeBriefingNow(): void {
  const win = getBriefingWindow()
  if (win) win.hide()
}
