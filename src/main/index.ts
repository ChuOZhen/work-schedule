import { app, dialog } from 'electron'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { requestBriefing } from './briefing'
import { closeDb, initDb } from './db'
import { runCaptureFlow, runSchedulerSmoke, runUiSmoke, seedDemoData } from './debug'
import { runSmoke } from './smoke'
import { registerIpc } from './ipc'
import { getSettings } from './repo'
import { startScheduler, stopScheduler } from './scheduler'
import { createTray, destroyTray } from './tray'
import { createBriefingWindow } from './windows/briefing'
import { createMainWindow, showMainWindow, setQuitting } from './windows/main'
import { powerMonitor } from 'electron'

const isHiddenBoot = process.argv.includes('--hidden')
const isSmoke = process.env.WS_SMOKE === '1'

// 冒烟测试使用独立的临时数据目录，避免污染真实数据
if (isSmoke) {
  app.setPath('userData', join(tmpdir(), `work-schedule-smoke-${Date.now()}`))
}

app.setAppUserModelId('com.workschedule.app')

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })

  app.whenReady().then(bootstrap).catch((err) => {
    dialog.showErrorBox('work schedule 启动失败', String(err?.stack ?? err))
    app.quit()
  })
}

function applyAutoLaunch(enabled: boolean): void {
  try {
    if (!app.isPackaged) return
    // 便于自动化验证时避免真的写入启动项
    if (process.env.WS_NO_AUTOLAUNCH === '1') return
    app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] })
  } catch (err) {
    console.error('[autolaunch] failed', err)
  }
}

function bootstrap(): void {
  initDb()
  if (isSmoke) {
    const code = runSmoke()
    closeDb()
    app.exit(code)
    return
  }
  if (process.env.WS_SEED === '1') seedDemoData()
  const settings = getSettings()
  applyAutoLaunch(settings.autoLaunch)

  registerIpc()
  createTray()
  startScheduler()
  createBriefingWindow()

  if (isHiddenBoot) {
    setTimeout(() => requestBriefing('boot'), 3500)
  } else {
    createMainWindow()
    runCaptureFlow()
    if (process.env.WS_UI_SMOKE === '1') {
      void runUiSmoke()
    }
    if (process.env.WS_SCHED_SMOKE === '1') {
      startScheduler()
      void runSchedulerSmoke().then(() => {
        setTimeout(() => app.quit(), 500)
      })
    }
    const briefAfter = Number(process.env.WS_BRIEFING_AFTER ?? 0)
    if (briefAfter > 0) {
      setTimeout(() => requestBriefing('manual', { force: true }), briefAfter)
    }
  }

  powerMonitor.on('unlock-screen', () => {
    setTimeout(() => requestBriefing('unlock'), 900)
  })

  powerMonitor.on('resume', () => {
    setTimeout(() => requestBriefing('resume'), 1500)
  })
}

app.on('window-all-closed', () => {
  // 常驻托盘：不退出
})

app.on('before-quit', () => {
  setQuitting(true)
  stopScheduler()
  destroyTray()
  closeDb()
})

process.on('uncaughtException', (err) => {
  console.error('[main] uncaught', err)
})
