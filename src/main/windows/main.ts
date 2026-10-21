import { BrowserWindow, Notification, shell } from 'electron'
import { join } from 'node:path'
import { getSettings, patchSettings } from '../repo'

let mainWindow: BrowserWindow | null = null
let isQuitting = false

export function setQuitting(v: boolean): void {
  isQuitting = v
}

export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 18, y: 20 },
    backgroundMaterial: process.platform === 'win32' ? 'acrylic' : undefined,
    roundedCorners: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    if (process.env.WS_DEBUG === '1') {
      console.log('[win] main material=' + String((mainWindow as unknown as { getBackgroundMaterial?: () => string }).getBackgroundMaterial?.()))
    }
    mainWindow?.show()
    mainWindow?.focus()
  })

  mainWindow.on('close', (e) => {
    if (isQuitting) return
    e.preventDefault()
    mainWindow?.hide()
    if (!getSettings().closeHintShown) {
      patchSettings({ closeHintShown: true })
      try {
        new Notification({
          title: 'work schedule 还在后台待命',
          body: '它会继续在托盘里提醒你。右键托盘图标可以退出。'
        }).show()
      } catch {
        /* 通知不可用时静默 */
      }
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

export function showMainWindow(): BrowserWindow {
  const win = createMainWindow()
  if (win.isMinimized()) win.restore()
  if (!win.isVisible()) win.show()
  win.focus()
  return win
}

export function hideMainWindow(): void {
  mainWindow?.hide()
}
