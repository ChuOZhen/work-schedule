import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BellRing, CalendarDays, Clock } from 'lucide-react'
import type { BriefingPayload } from '@shared/types'
import './styles/briefing.css'

const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export default function BriefingApp(): React.JSX.Element {
  const [payload, setPayload] = useState<BriefingPayload | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [paused, setPaused] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const dismissRef = useRef<() => void>(() => {})

  useEffect(() => {
    const off = window.api.briefing.onShow((p) => {
      setPayload(p)
      setLeaving(false)
      setPaused(false)
    })
    return off
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20000)
    return () => clearInterval(t)
  }, [])

  const dismiss = (): void => {
    if (!payload) return
    setLeaving(true)
    const p = payload
    window.setTimeout(() => {
      void window.api.briefing.dismiss(p)
      setPayload(null)
    }, 170)
  }
  dismissRef.current = dismiss

  useEffect(() => {
    if (!payload || paused) return
    const t = window.setTimeout(() => dismissRef.current(), 12000)
    return () => window.clearTimeout(t)
  }, [payload, paused])

  const clock = `${`${now.getHours()}`.padStart(2, '0')}:${`${now.getMinutes()}`.padStart(2, '0')}`
  const dow = WEEKDAY_CN[now.getDay()]

  const onSnooze = (): void => {
    if (!payload) return
    setLeaving(true)
    const p = payload
    window.setTimeout(() => {
      void window.api.briefing.snooze(p, 10)
      setPayload(null)
    }, 150)
  }

  const onOpen = (): void => {
    if (!payload) return
    void window.api.briefing.openEvent(payload)
    setPayload(null)
  }

  return (
    <div
      className={`briefing-root ${paused ? 'paused' : ''}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={`briefing-card ${leaving ? 'leaving' : ''} ${payload ? 'shown' : ''}`}>
        <div className="b-head">
          <div className="b-clock">
            <Clock size={12} />
            {clock} · {dow}
          </div>
          <div className="b-badge">
            <BellRing size={11} />
            {payload?.reason === 'lead'
              ? payload.leadMinutes === 0
                ? '就是现在'
                : `${payload.leadMinutes} 分钟后`
              : payload?.reason === 'snooze'
                ? '稍后提醒'
                : '接下来'}
          </div>
        </div>

        {payload ? (
          <>
            <div className="b-event">
              <span className="b-bar" style={{ background: payload.event.color }} />
              <div className="b-body">
                <div className="b-title">{payload.event.title}</div>
                <div className="b-meta">
                  {payload.dayLabel} · {payload.timeLabel}
                  {payload.event.categoryName ? ` · ${payload.event.categoryName}` : ''}
                </div>
                <div className="b-rel" style={{ color: payload.event.color }}>
                  {payload.relativeLabel}
                </div>
              </div>
            </div>

            <div className="b-actions">
              <button className="b-btn" onClick={onSnooze}>
                稍后 10 分钟
              </button>
              <button className="b-btn b-btn-primary" onClick={onOpen}>
                <CalendarDays size={13} />
                打开日历
              </button>
            </div>

            <div className="b-progress">
              <div className="b-progress-fill" />
            </div>
          </>
        ) : (
          <div className="b-idle">安静一会儿，没有需要提醒的事</div>
        )}
      </div>
    </div>
  )
}

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(<BriefingApp />)
}
