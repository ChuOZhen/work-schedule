import { getSettings, isReminded, listRange, markReminded } from './repo'
import { buildPayload, showBriefing } from './briefing'

let timer: NodeJS.Timeout | null = null
let lastTickAt = Date.now()

const TICK_MS = 20_000

function tick(): void {
  const now = Date.now()
  try {
    const settings = getSettings()
    const muted = Boolean(settings.mutedUntil && new Date(settings.mutedUntil).getTime() > now)
    if (muted) {
      lastTickAt = now
      return
    }
    const list = listRange(new Date(now).toISOString(), new Date(now + 26 * 3600 * 1000).toISOString())
    for (const occ of list) {
      if (occ.done) continue
      const lead = occ.leadMin ?? settings.defaultLeadMinutes
      const startMs = new Date(occ.startISO).getTime()
      const endMs = new Date(occ.endISO).getTime()
      if (endMs <= now) continue
      const remindAt = startMs - lead * 60_000
      if (remindAt > now) continue
      // 已经过去太久的（例如电脑休眠期间）不补弹，避免开机被历史提醒轰炸
      if (now - remindAt > 5 * 60_000) continue
      if (isReminded(occ.id, occ.occurrenceStartISO)) continue
      markReminded(occ.id, occ.occurrenceStartISO)
      showBriefing(buildPayload(occ, 'lead', lead))
      return
    }
  } catch (err) {
    console.error('[scheduler] tick failed', err)
  } finally {
    lastTickAt = now
  }
}

export function startScheduler(): void {
  if (timer) return
  lastTickAt = Date.now()
  timer = setInterval(tick, TICK_MS)
  // 启动后先跑一次，补上应用启动瞬间该提醒的事件
  setTimeout(tick, 4_000)
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer)
  timer = null
}
