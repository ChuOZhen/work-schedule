import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { isoWeekNumber, monthTitle, weekLabel } from '../lib/date'
import { useStore } from '../store'

export default function Toolbar(): React.JSX.Element {
  const weekStart = useStore((s) => s.weekStart)
  const shiftWeek = useStore((s) => s.shiftWeek)
  const goToday = useStore((s) => s.goToday)
  const newDraft = useStore((s) => s.newDraft)

  const start = new Date(weekStart)

  const onCreate = (): void => {
    const now = new Date()
    const inThisWeek = now.getTime() >= weekStart && now.getTime() < weekStart + 7 * 86400000
    const base = inThisWeek ? now : new Date(weekStart + 9 * 3600000)
    newDraft({ x: window.innerWidth / 2, y: window.innerHeight * 0.42 }, base)
  }

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <div className="month-title">{monthTitle(start)}</div>
        <div className="range-title">
          {weekLabel(start)} · 第 {isoWeekNumber(start)} 周
        </div>
      </div>
      <div className="toolbar-spacer" />
      <div className="segmented">
        <button className="seg-btn" title="上一周 (←)" onClick={() => shiftWeek(-1)}>
          <ChevronLeft size={15} />
        </button>
        <button className="seg-btn pill" title="回到今天 (T)" onClick={() => goToday()}>
          今天
        </button>
        <button className="seg-btn" title="下一周 (→)" onClick={() => shiftWeek(1)}>
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="toolbar-spacer" />
      <button className="primary-btn" title="新建事件 (N)" onClick={onCreate}>
        <Plus size={15} /> 新建
      </button>
    </div>
  )
}
