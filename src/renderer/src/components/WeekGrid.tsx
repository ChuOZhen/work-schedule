import { useEffect, useMemo, useRef, useState } from 'react'
import type { Occurrence } from '@shared/types'
import { addDays, hhmm, isSameDay, minutesFromDayStart, ymd } from '../lib/date'
import { layoutDay } from '../lib/layout'
import { useStore } from '../store'

const HOUR_H = 56
const MIN_H = 22

interface Segment {
  occ: Occurrence
  dayIndex: number
  startMin: number
  endMin: number
  col: number
  cols: number
  isStart: boolean
  isEnd: boolean
}

function buildSegments(events: Occurrence[], days: Date[]): { timed: Segment[][]; allDay: Occurrence[][] } {
  const timed: Segment[][] = days.map(() => [])
  const allDay: Occurrence[][] = days.map(() => [])

  for (const occ of events) {
    const s = new Date(occ.startISO)
    const e = new Date(occ.endISO)
    if (occ.allDay) {
      days.forEach((d, di) => {
        const dayStart = d.getTime()
        if (s.getTime() < dayStart + 86400000 && e.getTime() > dayStart) allDay[di].push(occ)
      })
      continue
    }
    days.forEach((d, di) => {
      const dayStart = d.getTime()
      const dayEnd = dayStart + 86400000
      const from = Math.max(s.getTime(), dayStart)
      const to = Math.min(e.getTime(), dayEnd)
      if (to <= from) return
      timed[di].push({
        occ,
        dayIndex: di,
        startMin: (from - dayStart) / 60000,
        endMin: (to - dayStart) / 60000,
        col: 0,
        cols: 1,
        isStart: s.getTime() >= dayStart,
        isEnd: e.getTime() <= dayEnd
      })
    })
  }

  timed.forEach((list) => {
    const placements = layoutDay(list.map((l) => ({ startMin: l.startMin, endMin: l.endMin })))
    list.forEach((l, i) => {
      l.col = placements[i].col
      l.cols = placements[i].cols
    })
  })

  return { timed, allDay }
}

export default function WeekGrid(): React.JSX.Element {
  const weekStart = useStore((s) => s.weekStart)
  const events = useStore((s) => s.events)
  const focusKey = useStore((s) => s.focusKey)
  const openDraft = useStore((s) => s.openDraft)
  const newDraft = useStore((s) => s.newDraft)
  const reload = useStore((s) => s.reload)

  const scrollRef = useRef<HTMLDivElement>(null)
  const colsRef = useRef<HTMLDivElement>(null)
  const [nowTs, setNowTs] = useState(() => Date.now())
  const dragRef = useRef<{
    seg: Segment
    startX: number
    startY: number
    moved: boolean
    dx: number
    dy: number
    el: HTMLElement
  } | null>(null)

  const days = useMemo(() => {
    const start = new Date(weekStart)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [weekStart])

  const { timed, allDay } = useMemo(() => buildSegments(events, days), [events, days])
  const hasAllDay = allDay.some((l) => l.length > 0)
  const today = new Date(nowTs)
  const todayIndex = days.findIndex((d) => isSameDay(d, today))
  const nowMin = today.getHours() * 60 + today.getMinutes() + today.getSeconds() / 60

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const start = new Date(weekStart)
    const inThisWeek = Date.now() >= start.getTime() && Date.now() < start.getTime() + 7 * 86400000
    const targetMin = inThisWeek ? nowMin : 7 * 60
    el.scrollTop = Math.max(0, (targetMin / 60) * HOUR_H - 150)
    // 仅在切换周时重置滚动位置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  useEffect(() => {
    if (!focusKey) return
    const el = scrollRef.current?.querySelector('[data-focus="1"]')
    if (el && 'scrollIntoView' in el) {
      ;(el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [focusKey])

  const onColPointerDown = (di: number, e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const minutes = Math.max(0, Math.min(24 * 60 - 30, Math.floor((y / HOUR_H) * 60 / 15) * 15))
    const dayStart = new Date(days[di])
    newDraft({ x: e.clientX, y: e.clientY }, new Date(dayStart.getTime() + minutes * 60000))
  }

  const onEvtPointerDown = (e: React.PointerEvent<HTMLDivElement>, seg: Segment): void => {
    e.stopPropagation()
    if (e.button !== 0) return
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    dragRef.current = {
      seg,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      dx: 0,
      dy: 0,
      el
    }
  }

  const onEvtPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true
    if (!d.moved) return
    d.dx = dx
    d.dy = dy
    d.el.style.transform = `translate(${dx}px, ${dy}px)`
    d.el.classList.add('dragging')
  }

  const onEvtPointerUp = async (e: React.PointerEvent<HTMLDivElement>): Promise<void> => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    d.el.classList.remove('dragging')
    d.el.style.transform = ''

    if (!d.moved) {
      openDraft(d.seg.occ, { x: e.clientX, y: e.clientY })
      return
    }

    const colW = colsRef.current ? colsRef.current.clientWidth / 7 : 120
    const dayDelta = Math.round(d.dx / colW)
    const minDelta = Math.round(((d.dy / HOUR_H) * 60) / 15) * 15
    if (dayDelta === 0 && minDelta === 0) return

    const shift = minDelta * 60000 + dayDelta * 86400000
    const start = new Date(new Date(d.seg.occ.startISO).getTime() + shift)
    const end = new Date(new Date(d.seg.occ.endISO).getTime() + shift)
    try {
      await window.api.events.update(
        d.seg.occ.id,
        { startISO: start.toISOString(), endISO: end.toISOString() },
        d.seg.occ.isRecurring ? 'this' : 'all',
        d.seg.occ.occurrenceStartISO
      )
      await reload()
    } catch (err) {
      useStore.getState().notify(`移动失败：${String(err)}`)
    }
  }

  const isFocus = (occ: Occurrence): boolean => focusKey === `${occ.id}|${occ.occurrenceStartISO}`

  return (
    <div className="week">
      <div className="dayheads">
        <div />
        {days.map((d, i) => {
          const isToday = todayIndex === i
          const weekend = d.getDay() === 0 || d.getDay() === 6
          return (
            <div key={ymd(d)} className={`dayhead ${isToday ? 'today' : ''} ${weekend ? 'weekend' : ''}`}>
              <div className="dow">{['一', '二', '三', '四', '五', '六', '日'][i]}</div>
              <div className="dnum">{d.getDate()}</div>
            </div>
          )
        })}
      </div>

      {hasAllDay && (
        <div className="allday">
          <div className="allday-label">全天</div>
          {days.map((d, i) => (
            <div key={ymd(d)} className="allday-cell">
              {allDay[i].map((occ) => (
                <button
                  key={`${occ.id}|${occ.occurrenceStartISO}`}
                  className="allday-chip"
                  style={{ ['--evt-color' as string]: occ.color }}
                  onClick={(e) => openDraft(occ, { x: e.clientX, y: e.clientY })}
                >
                  {occ.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="grid-scroll" ref={scrollRef}>
        <div className="grid" style={{ ['--hour-height' as string]: `${HOUR_H}px` }}>
          <div className="axis">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="axis-hour" style={{ top: h * HOUR_H }}>
                {h === 0 ? '' : `${`${h}`.padStart(2, '0')}:00`}
              </div>
            ))}
          </div>
          <div className="cols" ref={colsRef}>
            {days.map((d, di) => {
              const weekend = d.getDay() === 0 || d.getDay() === 6
              return (
                <div
                  key={ymd(d)}
                  className={`col ${weekend ? 'weekend' : ''} ${todayIndex === di ? 'today' : ''}`}
                  onPointerDown={(e) => onColPointerDown(di, e)}
                >
                  {timed[di].map((seg) => {
                    const height = Math.max(MIN_H, ((seg.endMin - seg.startMin) / 60) * HOUR_H - 2)
                    const compact = height < 38
                    const widthPct = 100 / seg.cols
                    return (
                      <div
                        key={`${seg.occ.id}|${seg.occ.occurrenceStartISO}|${di}`}
                        className={`evt ${seg.occ.done ? 'done' : ''} ${compact ? 'evt-compact' : ''} ${
                          isFocus(seg.occ) ? 'focused' : ''
                        }`}
                        style={{
                          top: (seg.startMin / 60) * HOUR_H,
                          height,
                          left: `calc(${seg.col * widthPct}% + 2px)`,
                          width: `calc(${widthPct}% - 5px)`,
                          ['--evt-color' as string]: seg.occ.color
                        }}
                        onPointerDown={(e) => onEvtPointerDown(e, seg)}
                        onPointerMove={onEvtPointerMove}
                        onPointerUp={(e) => void onEvtPointerUp(e)}
                        data-focus={isFocus(seg.occ) ? '1' : undefined}
                        title={`${seg.occ.title} · ${hhmm(new Date(seg.occ.startISO))} – ${hhmm(
                          new Date(seg.occ.endISO)
                        )}`}
                      >
                        <div className="evt-title">
                          {seg.occ.done ? '✓ ' : ''}
                          {seg.occ.title}
                        </div>
                        {!compact && (
                          <div className="evt-meta">
                            {hhmm(new Date(seg.occ.startISO))} – {hhmm(new Date(seg.occ.endISO))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {todayIndex >= 0 && (
              <div className="nowline" style={{ top: (nowMin / 60) * HOUR_H }} />
            )}
          </div>
        </div>

        {events.length === 0 && (
          <div className="empty-hint">
            <strong>本周还是空的</strong>
            在任意时间段点一下，就能新建一件事
          </div>
        )}
      </div>
    </div>
  )
}
