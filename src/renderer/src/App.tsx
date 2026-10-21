import { useEffect } from 'react'
import EventEditor from './components/EventEditor'
import SearchPanel from './components/SearchPanel'
import SettingsPanel from './components/SettingsPanel'
import TitleBar from './components/TitleBar'
import Toolbar from './components/Toolbar'
import WeekGrid from './components/WeekGrid'
import { useStore } from './store'

function nextSlot(): Date {
  const now = new Date()
  const add = 15 - (now.getMinutes() % 15)
  const slot = new Date(now.getTime() + add * 60000)
  slot.setSeconds(0, 0)
  return slot
}

function centerAnchor(): { x: number; y: number } {
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.42 }
}

export default function App(): React.JSX.Element {
  const init = useStore((s) => s.init)
  const editor = useStore((s) => s.editor)
  const searchOpen = useStore((s) => s.searchOpen)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const toast = useStore((s) => s.toast)

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      document.documentElement.dataset.theme = mq.matches ? 'dark' : 'light'
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const s = useStore.getState()
      const tag = (e.target as HTMLElement | null)?.tagName ?? ''
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (e.key === 'Escape') {
        s.closeEditor()
        s.setSearchOpen(false)
        s.setSettingsOpen(false)
        return
      }
      if (typing) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        s.setSearchOpen(true)
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        s.shiftWeek(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        s.shiftWeek(1)
      } else if (e.key.toLowerCase() === 't') {
        s.goToday()
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        s.newDraft(centerAnchor(), nextSlot())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const off = window.api.win.onFocusEvent(({ id, occurrenceStartISO }) => {
      void useStore.getState().focusOccurrence(id, occurrenceStartISO)
    })
    return off
  }, [])

  return (
    <div className="app noise">
      <TitleBar />
      <Toolbar />
      <WeekGrid />
      {editor && <EventEditor />}
      {searchOpen && <SearchPanel />}
      {settingsOpen && <SettingsPanel />}
      {toast && <div className="toast glass-2">{toast.text}</div>}
    </div>
  )
}
