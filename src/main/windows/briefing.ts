import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'

let briefingWindow: BrowserWindow | null = null

export const BRIEFING_WIDTH = 384
export const BRIEFING_HEIGHT = 172

export function createBriefingWindow(): BrowserWindow {
  if (briefingWindow && !briefingWindow.isDestroyed()) return briefingWindow

  briefingWindow = new BrowserWindow({
    width: BRIEFING_WIDTH,
    height: BRIEFING_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: true,
    roundedCorners: true,
    backgroundMaterial: process.platform === 'win32' ? 'acrylic' : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })

  briefingWindow.setAlwaysOnTop(true, 'screen-saver')
  briefingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (process.env['ELECTRON_RENDERER_URL']) {
    briefingWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/briefing.html`)
  } else {
    briefingWindow.loadFile(join(__dirname, '../renderer/briefing.html'))
  }

  briefingWindow.on('closed', () => {
    briefingWindow = null
  })

  return briefingWindow
}

export function ensureBriefingWindow(): BrowserWindow {
  const win = createBriefingWindow()
  positionBottomRight(win)
  return win
}

export function getBriefingWindow(): BrowserWindow | null {
  return briefingWindow && !briefingWindow.isDestroyed() ? briefingWindow : null
}

export function positionBottomRight(win: BrowserWindow): void {
  try {
    const cursor = screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(cursor)
    const area = display.workArea
    const [w, h] = win.getSize()
    const margin = 16
    const x = Math.round(area.x + area.width - w - margin)
    const y = Math.round(area.y + area.height - h - margin)
    win.setPosition(x, y, false)
  } catch {
    /* 多显示器/DPI 异常时静默失败 */
  }
}

export function hideBriefingWindow(): void {
  const win = getBriefingWindow()
  if (!win) return
  win.webContents.send('briefing:closing')
  setTimeout(() => {
    if (win && !win.isDestroyed()) win.hide()
  }, 180)
}
