export type RepeatKind = 'none' | 'daily' | 'weekly' | 'weekdays' | 'monthly' | 'yearly'

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

export const REPEAT_LABEL: Record<RepeatKind, string> = {
  none: '不重复',
  daily: '每天',
  weekly: '每周',
  weekdays: '每个工作日',
  monthly: '每月',
  yearly: '每年'
}

export function buildRRule(kind: RepeatKind, start: Date): string | null {
  switch (kind) {
    case 'none':
      return null
    case 'daily':
      return 'FREQ=DAILY'
    case 'weekly':
      return `FREQ=WEEKLY;BYDAY=${BYDAY[start.getDay()]}`
    case 'weekdays':
      return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
    case 'monthly':
      return `FREQ=MONTHLY;BYMONTHDAY=${start.getDate()}`
    case 'yearly':
      return `FREQ=YEARLY;BYMONTH=${start.getMonth() + 1};BYMONTHDAY=${start.getDate()}`
    default:
      return null
  }
}

export function parseRepeat(rrule: string | null): RepeatKind {
  if (!rrule) return 'none'
  if (rrule.includes('FREQ=DAILY')) return 'daily'
  if (rrule.includes('FREQ=WEEKLY')) {
    if (rrule.includes('BYDAY=MO,TU,WE,TH,FR')) return 'weekdays'
    return 'weekly'
  }
  if (rrule.includes('FREQ=MONTHLY')) return 'monthly'
  if (rrule.includes('FREQ=YEARLY')) return 'yearly'
  return 'none'
}
