import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { SearchHit } from '@shared/types'
import { hhmm, relativeDayLabel } from '../lib/date'
import { useStore } from '../store'

export default function SearchPanel(): React.JSX.Element {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [busy, setBusy] = useState(false)
  const setSearchOpen = useStore((s) => s.setSearchOpen)
  const focusOccurrence = useStore((s) => s.focusOccurrence)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onDown = (e: PointerEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [setSearchOpen])

  useEffect(() => {
    const text = q.trim()
    if (!text) {
      setHits([])
      return
    }
    setBusy(true)
    const t = setTimeout(async () => {
      try {
        const res = await window.api.events.search({ text })
        setHits(res)
      } finally {
        setBusy(false)
      }
    }, 170)
    return () => clearTimeout(t)
  }, [q])

  const { upcoming, past } = useMemo(() => {
    const now = Date.now()
    return {
      upcoming: hits.filter((h) => new Date(h.startISO).getTime() >= now).slice(0, 30),
      past: hits.filter((h) => new Date(h.startISO).getTime() < now).slice(0, 30)
    }
  }, [hits])

  const jump = async (hit: SearchHit): Promise<void> => {
    setSearchOpen(false)
    await focusOccurrence(hit.id, hit.occurrenceStartISO)
  }

  return (
    <div className="search-panel glass noise" ref={ref}>
      <div className="search-input-wrap">
        <Search size={14} style={{ color: 'var(--text-tertiary)' }} />
        <input
          ref={inputRef}
          className="search-input"
          placeholder="搜索事件标题或备注…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="panel-close" onClick={() => setSearchOpen(false)} title="关闭">
          <X size={12} />
        </button>
      </div>

      <div className="search-results">
        {!q.trim() && <div className="search-empty">输入关键词，搜遍全部历史与未来日程</div>}
        {q.trim() && !busy && hits.length === 0 && <div className="search-empty">没有找到相关事件</div>}

        {upcoming.length > 0 && <div className="search-group">即将到来</div>}
        {upcoming.map((h) => (
          <button key={`${h.id}|${h.occurrenceStartISO}`} className="search-item" onClick={() => void jump(h)}>
            <span className="s-dot" style={{ background: h.color }} />
            <span className="s-title">{h.title}</span>
            <span className="s-time">
              {relativeDayLabel(new Date(h.startISO))} {hhmm(new Date(h.startISO))}
            </span>
          </button>
        ))}

        {past.length > 0 && <div className="search-group">过去</div>}
        {past.map((h) => (
          <button key={`${h.id}|${h.occurrenceStartISO}`} className="search-item" onClick={() => void jump(h)}>
            <span className="s-dot" style={{ background: h.color }} />
            <span className="s-title">{h.title}</span>
            <span className="s-time">
              {relativeDayLabel(new Date(h.startISO))} {hhmm(new Date(h.startISO))}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
