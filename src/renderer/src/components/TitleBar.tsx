import { Bell, Search, Settings2 } from 'lucide-react'
import { useStore } from '../store'

export default function TitleBar(): React.JSX.Element {
  const searchOpen = useStore((s) => s.searchOpen)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const setSearchOpen = useStore((s) => s.setSearchOpen)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)

  return (
    <div className="titlebar">
      <div className="traffic">
        <button
          className="dot dot-close"
          title="隐藏到托盘"
          onClick={() => window.api.win.close()}
        />
        <button className="dot dot-min" title="最小化" onClick={() => window.api.win.minimize()} />
        <button
          className="dot dot-max"
          title="最大化"
          onClick={() => window.api.win.toggleMaximize()}
        />
      </div>
      <div className="titlebar-title">WORK SCHEDULE</div>
      <div className="titlebar-spacer" />
      <button
        className="icon-btn"
        title="现在提示一次"
        onClick={() => void window.api.win.showBriefingNow()}
      >
        <Bell size={15} />
      </button>
      <button
        className={`icon-btn ${searchOpen ? 'active' : ''}`}
        title="搜索 (Ctrl+F)"
        onClick={() => setSearchOpen(!searchOpen)}
      >
        <Search size={15} />
      </button>
      <button
        className={`icon-btn ${settingsOpen ? 'active' : ''}`}
        title="设置"
        onClick={() => setSettingsOpen(!settingsOpen)}
      >
        <Settings2 size={15} />
      </button>
    </div>
  )
}
