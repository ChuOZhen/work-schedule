import { app, Menu, Tray, nativeImage } from 'electron'
import { join } from 'node:path'
import { requestBriefing } from './briefing'
import { getSettings, patchSettings } from './repo'
import { showMainWindow } from './windows/main'
import { setQuitting } from './windows/main'

let tray: Tray | null = null

function trayIconPath(): string {
  return join(__dirname, '../../resources/tray.png')
}

export function createTray(): void {
  if (tray) return
  let image = nativeImage.createFromPath(trayIconPath())
  if (image.isEmpty()) {
    console.warn('[tray] icon not found at ' + trayIconPath())
    image = nativeImage.createEmpty()
  } else {
    image = image.resize({ width: 16, height: 16 })
  }
  tray = new Tray(image)
  tray.setToolTip('work schedule')
  tray.on('click', () => showMainWindow())
  rebuildMenu()
}

function rebuildMenu(): void {
  if (!tray) return
  const settings = getSettings()
  const muted = Boolean(settings.mutedUntil && new Date(settings.mutedUntil).getTime() > Date.now())
  const menu = Menu.buildFromTemplate([
    { label: '打开日历', click: () => showMainWindow() },
    { label: '现在提示一次', click: () => requestBriefing('manual', { force: true }) },
    { type: 'separator' },
    {
      label: muted ? '取消静音' : '静音 1 小时',
      click: () => {
        patchSettings({
          mutedUntil: muted ? null : new Date(Date.now() + 3600_000).toISOString()
        })
        rebuildMenu()
      }
    },
    {
      label: '开机自动启动',
      type: 'checkbox',
      checked: settings.autoLaunch,
      click: (item) => {
        const next = patchSettings({ autoLaunch: item.checked })
        if (app.isPackaged) {
          app.setLoginItemSettings({ openAtLogin: next.autoLaunch, args: ['--hidden'] })
        }
        rebuildMenu()
      }
    },
    { type: 'separator' },
    {
      label: '退出 work schedule',
      click: () => {
        setQuitting(true)
        app.quit()
      }
    }
  ])
  tray.setContextMenu(menu)
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
