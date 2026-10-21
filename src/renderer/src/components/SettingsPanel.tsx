import { Bell, FolderOpen, Sparkles } from 'lucide-react'
import { useStore } from '../store'

export default function SettingsPanel(): React.JSX.Element | null {
  const settings = useStore((s) => s.settings)
  const appInfo = useStore((s) => s.appInfo)
  const loadMeta = useStore((s) => s.loadMeta)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)

  if (!settings) return null

  const patch = async (p: Parameters<typeof window.api.meta.patchSettings>[0]): Promise<void> => {
    await window.api.meta.patchSettings(p)
    await loadMeta()
  }

  const muted = Boolean(settings.mutedUntil && new Date(settings.mutedUntil).getTime() > Date.now())

  return (
    <div className="settings-panel glass noise">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="settings-title">设置</h3>
        <button className="panel-close" onClick={() => setSettingsOpen(false)}>
          ✕
        </button>
      </div>

      <div className="setting-row">
        <div>
          <div className="setting-name">开机自动启动</div>
          <div className="setting-desc">登录后静默进托盘，并弹出最近要做的事</div>
        </div>
        <button
          className={`switch ${settings.autoLaunch ? 'on' : ''}`}
          onClick={() => void patch({ autoLaunch: !settings.autoLaunch })}
        />
      </div>

      <div className="setting-row">
        <div>
          <div className="setting-name">默认提前提醒</div>
          <div className="setting-desc">每个事件可以单独覆盖</div>
        </div>
        <select
          className="mini-select"
          value={settings.defaultLeadMinutes}
          onChange={(e) => void patch({ defaultLeadMinutes: Number(e.target.value) })}
        >
          {[0, 5, 10, 15, 30, 60].map((m) => (
            <option key={m} value={m}>
              {m === 0 ? '准时' : `${m} 分钟`}
            </option>
          ))}
        </select>
      </div>

      <div className="setting-row">
        <div>
          <div className="setting-name">降低透明度</div>
          <div className="setting-desc">显卡吃力或看不清时打开</div>
        </div>
        <button
          className={`switch ${settings.reduceTransparency ? 'on' : ''}`}
          onClick={() => void patch({ reduceTransparency: !settings.reduceTransparency })}
        />
      </div>

      <div className="setting-row">
        <div>
          <div className="setting-name">静音提醒</div>
          <div className="setting-desc">{muted ? '1 小时内不会再打扰你' : '暂停所有自动提醒 1 小时'}</div>
        </div>
        <button
          className={`switch ${muted ? 'on' : ''}`}
          onClick={() =>
            void patch({ mutedUntil: muted ? null : new Date(Date.now() + 3600000).toISOString() })
          }
        />
      </div>

      <div className="setting-row">
        <div>
          <div className="setting-name">立即提示一次</div>
          <div className="setting-desc">马上看看最近该做什么</div>
        </div>
        <button className="btn btn-ghost" onClick={() => void window.api.win.showBriefingNow()}>
          <Bell size={13} /> 试试
        </button>
      </div>

      <div className="setting-row">
        <div style={{ minWidth: 0 }}>
          <div className="setting-name">数据位置</div>
          <div className="setting-desc" style={{ wordBreak: 'break-all' }}>
            {appInfo?.dataPath ?? '—'}
          </div>
        </div>
        <Sparkles size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', gap: 8 }}>
        <span>v{appInfo?.version ?? '0.1.0'}</span>
        <span>·</span>
        <span>Electron {appInfo?.electron ?? ''}</span>
        <span>·</span>
        <span>快捷键 ← → T N Ctrl+F</span>
      </div>
    </div>
  )
}
