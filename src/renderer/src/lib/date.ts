export const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
export const DOW_SHORT = ['一', '二', '三', '四', '五', '六', '日']

export function startOfWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - diff)
  return date
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}

export function addWeeks(d: Date, n: number): Date {
  return addDays(d, n * 7)
}

export function ymd(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function hhmm(d: Date): string {
  return `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`
}

export function combine(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0)
}

export function minutesFromDayStart(dayStart: Date, target: Date): number {
  return (target.getTime() - dayStart.getTime()) / 60000
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  )
}

export function weekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  const sameMonth = weekStart.getMonth() === end.getMonth()
  const left = `${weekStart.getFullYear()}年${weekStart.getMonth() + 1}月${weekStart.getDate()}日`
  const right = sameMonth ? `${end.getDate()}日` : `${end.getMonth() + 1}月${end.getDate()}日`
  return `${left} – ${right}`
}

export function monthTitle(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  const now = new Date()
  const y = now.getFullYear() === weekStart.getFullYear() ? '' : `${weekStart.getFullYear()}年`
  if (weekStart.getMonth() === end.getMonth()) {
    return `${y}${weekStart.getMonth() + 1}月`
  }
  return `${y}${weekStart.getMonth() + 1}月 · ${end.getMonth() + 1}月`
}

export function isoWeekNumber(d: Date): number {
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dayNum = (target.getDay() + 6) % 7
  const thursday = addDays(target, 3 - dayNum)
  const yearStart = new Date(thursday.getFullYear(), 0, 1)
  return Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function relativeDayLabel(d: Date): string {
  const now = new Date()
  const dayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const targetMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diff = Math.round((targetMs - dayMs) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === 2) return '后天'
  if (diff === -1) return '昨天'
  if (diff > 0 && diff < 7) return `${diff} 天后`
  return `${d.getMonth() + 1}月${d.getDate()}日`
}
