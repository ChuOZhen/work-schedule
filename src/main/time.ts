import {
  addDays,
  differenceInMinutes,
  endOfDay,
  format,
  isSameDay,
  startOfDay,
  startOfWeek
} from 'date-fns'

/** 本地墙上时间 → 以 UTC 字段承载的"浮动时间"（供 rrule 使用，避免时区把工作日算错） */
export function toFloating(d: Date): Date {
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds())
  )
}

/** "浮动时间" → 真实时刻（按本地墙上时间解释） */
export function fromFloating(f: Date): Date {
  return new Date(
    f.getUTCFullYear(),
    f.getUTCMonth(),
    f.getUTCDate(),
    f.getUTCHours(),
    f.getUTCMinutes(),
    f.getUTCSeconds()
  )
}

/** 周一为一周起点 */
export function startOfWeekMonday(d: Date | string): Date {
  return startOfWeek(typeof d === 'string' ? new Date(d) : d, { weekStartsOn: 1 })
}

export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

export const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
export const WEEKDAY_SHORT = ['一', '二', '三', '四', '五', '六', '日']

export function fmtTime(d: Date): string {
  return format(d, 'HH:mm')
}

export function fmtRange(start: Date, end: Date): string {
  return `${fmtTime(start)} – ${fmtTime(end)}`
}

export function dayLabelOf(target: Date, now = new Date()): string {
  const base = isSameDay(target, now)
    ? '今天'
    : isSameDay(target, addDays(now, 1))
      ? '明天'
      : isSameDay(target, addDays(now, -1))
        ? '昨天'
        : isSameDay(target, addDays(now, 7))
          ? '下周'
          : format(target, 'M月d日')
  return `${base} · ${WEEKDAY_CN[target.getDay()]}`
}

export function relativeLabelOf(start: Date, end: Date, allDay: boolean, now = new Date()): string {
  if (allDay) return '全天'
  const nowMs = now.getTime()
  if (start.getTime() <= nowMs && end.getTime() > nowMs) {
    const left = Math.max(1, differenceInMinutes(end, now))
    return `正在进行 · 还剩 ${left} 分钟`
  }
  if (start.getTime() <= nowMs) {
    return `已开始 ${Math.max(1, differenceInMinutes(now, start))} 分钟`
  }
  const mins = differenceInMinutes(start, now)
  if (mins < 60) return `还有 ${mins} 分钟`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  if (isSameDay(start, now)) return rest ? `还有 ${hours} 小时 ${rest} 分` : `还有 ${hours} 小时`
  const hrs = Math.round(mins / 60)
  if (hrs < 36) return `还有 ${hrs} 小时`
  return `${Math.round(hrs / 24)} 天后`
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

export function isoWeekNumber(d: Date): number {
  const target = startOfDay(d)
  const dayNum = (target.getDay() + 6) % 7
  const thursday = addDays(target, 3 - dayNum)
  const yearStart = new Date(thursday.getFullYear(), 0, 1)
  return Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function dayBounds(d: Date): { from: Date; to: Date } {
  return { from: startOfDay(d), to: endOfDay(d) }
}
