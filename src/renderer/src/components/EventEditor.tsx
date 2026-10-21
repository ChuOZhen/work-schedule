import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Trash2, X } from 'lucide-react'
import { REPEAT_LABEL, type RepeatKind } from '../lib/repeat'
import { useStore } from '../store'

const REPEATS: RepeatKind[] = ['none', 'daily', 'weekly', 'weekdays', 'monthly']
const LEADS: Array<{ v: number | null; l: string }> = [
  { v: null, l: '默认' },
  { v: 0, l: '准时' },
  { v: 5, l: '5 分钟前' },
  { v: 10, l: '10 分钟前' },
  { v: 15, l: '15 分钟前' },
  { v: 30, l: '30 分钟前' },
  { v: 60, l: '1 小时前' }
]

export default function EventEditor(): React.JSX.Element | null {
  const editor = useStore((s) => s.editor)
  const categories = useStore((s) => s.categories)
  const patchDraft = useStore((s) => s.patchDraft)
  const saveDraft = useStore((s) => s.saveDraft)
  const deleteDraft = useStore((s) => s.deleteDraft)
  const closeEditor = useStore((s) => s.closeEditor)
  const reload = useStore((s) => s.reload)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setConfirmDelete(false)
    const t = setTimeout(() => {
      titleRef.current?.focus()
      titleRef.current?.select()
    }, 40)
    return () => clearTimeout(t)
  }, [editor?.draft.id, editor?.mode])

  useEffect(() => {
    const onDown = (e: PointerEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeEditor()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [closeEditor])

  if (!editor) return null
  const d = editor.draft

  const style = useMemo(() => {
    const W = 344
    const H = Math.min(520, window.innerHeight - 80)
    const left = Math.min(Math.max(14, editor.anchor.x - W / 2), window.innerWidth - W - 14)
    const top = Math.min(Math.max(58, editor.anchor.y + 14), Math.max(58, window.innerHeight - H - 16))
    return { left, top, width: W }
  }, [editor.anchor])

  const toggleDone = async (): Promise<void> => {
    if (!d.id || !d.occurrenceStartISO) return
    await window.api.events.setDone(d.id, d.occurrenceStartISO, !d.done)
    patchDraft({ done: !d.done })
    await reload()
  }

  return (
    <div className="editor glass noise" ref={ref} style={style} onPointerDown={(e) => e.stopPropagation()}>
      <div className="editor-head">
        <h3>{editor.mode === 'create' ? '新建日程' : '编辑日程'}</h3>
        <button className="panel-close" onClick={() => closeEditor()} title="关闭 (Esc)">
          <X size={13} />
        </button>
      </div>

      <input
        ref={titleRef}
        className="title-input"
        placeholder="要做什么？"
        value={d.title}
        onChange={(e) => patchDraft({ title: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void saveDraft()
        }}
      />

      <div className="editor-row">
        <div className="field-label">日期</div>
        <input
          className="field"
          type="date"
          value={d.date}
          onChange={(e) => patchDraft({ date: e.target.value })}
        />
      </div>

      <div className="editor-row">
        <div className="field-label">时间</div>
        <input
          className="field"
          type="time"
          value={d.start}
          step={300}
          onChange={(e) => patchDraft({ start: e.target.value })}
        />
        <span style={{ color: 'var(--text-tertiary)' }}>–</span>
        <input
          className="field"
          type="time"
          value={d.end}
          step={300}
          onChange={(e) => patchDraft({ end: e.target.value })}
        />
      </div>

      <div className="editor-row">
        <div className="field-label">重复</div>
        <select
          className="field"
          value={d.repeat}
          onChange={(e) => patchDraft({ repeat: e.target.value as RepeatKind })}
        >
          {REPEATS.map((r) => (
            <option key={r} value={r}>
              {REPEAT_LABEL[r]}
            </option>
          ))}
        </select>
        <div className="field-label" style={{ width: 34, textAlign: 'right' }}>
          提醒
        </div>
        <select
          className="field"
          value={d.leadMin === null ? 'null' : String(d.leadMin)}
          onChange={(e) => patchDraft({ leadMin: e.target.value === 'null' ? null : Number(e.target.value) })}
        >
          {LEADS.map((l) => (
            <option key={String(l.v)} value={l.v === null ? 'null' : String(l.v)}>
              {l.l}
            </option>
          ))}
        </select>
      </div>

      <div className="chips">
        {categories.map((c) => (
          <button
            key={c.id}
            className={`chip ${d.categoryId === c.id ? 'active' : ''}`}
            style={{ ['--chip-color' as string]: c.color }}
            onClick={() => patchDraft({ categoryId: d.categoryId === c.id ? null : c.id })}
          >
            <span className="dot-c" />
            {c.name}
          </button>
        ))}
        <button
          className={`chip ${d.allDay ? 'active' : ''}`}
          style={{ ['--chip-color' as string]: '#8E8E93' }}
          onClick={() => patchDraft({ allDay: !d.allDay })}
        >
          全天
        </button>
      </div>

      <textarea
        className="notes"
        placeholder="备注（可选）"
        value={d.notes}
        onChange={(e) => patchDraft({ notes: e.target.value })}
      />

      <div className="editor-foot">
        {editor.mode === 'edit' && (
          <button className={`btn ${d.done ? 'btn-primary' : 'btn-ghost'}`} onClick={() => void toggleDone()}>
            <Check size={14} /> {d.done ? '已完成' : '标记完成'}
          </button>
        )}
        <div style={{ flex: 1 }} />
        {!confirmDelete ? (
          <button className="btn btn-danger" onClick={() => setConfirmDelete(true)} title="删除">
            <Trash2 size={14} />
          </button>
        ) : d.recurring ? (
          <>
            <button className="btn btn-ghost" onClick={() => void deleteDraft('this')}>
              仅此次
            </button>
            <button className="btn btn-danger" onClick={() => void deleteDraft('all')}>
              整个系列
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
              取消
            </button>
            <button className="btn btn-danger" onClick={() => void deleteDraft('all')}>
              确认删除
            </button>
          </>
        )}
        <button className="btn btn-primary" onClick={() => void saveDraft()}>
          保存
        </button>
      </div>
    </div>
  )
}
