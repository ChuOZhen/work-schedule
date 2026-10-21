import { app, type BrowserWindow } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { requestBriefing } from './briefing'
import { createEvent, listRange, removeEvent } from './repo'
import { getBriefingWindow } from './windows/briefing'
import { getMainWindow } from './windows/main'

export const captureDir = process.env.WS_CAPTURE_DIR ?? ''

export async function capture(win: BrowserWindow | null, name: string): Promise<void> {
  if (!win || win.isDestroyed() || !captureDir) return
  try {
    const image = await win.webContents.capturePage()
    mkdirSync(captureDir, { recursive: true })
    writeFileSync(join(captureDir, name), image.toPNG())
    console.log('[capture] ' + name)
  } catch (err) {
    console.error('[capture] failed', err)
  }
}

function at(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d
}

export function seedDemoData(): void {
  const now = new Date()
  const existing = listRange(
    new Date(now.getTime() - 20 * 86400000).toISOString(),
    new Date(now.getTime() + 20 * 86400000).toISOString()
  )
  if (existing.length > 0) return

  const make = (title: string, from: Date, to: Date, opts: Record<string, unknown> = {}): void => {
    createEvent({
      title,
      startISO: from.toISOString(),
      endISO: to.toISOString(),
      notes: (opts.notes as string) ?? null,
      categoryId: (opts.categoryId as string) ?? null,
      allDay: Boolean(opts.allDay),
      rrule: (opts.rrule as string) ?? null
    })
  }

  make('产品评审会', at(0, 9, 30), at(0, 11, 0), {
    categoryId: 'cat-meeting',
    notes: '带上上周的数据看板，确认 2.0 排期'
  })
  make('深度专注 · 排期表', at(0, 14, 0), at(0, 16, 0), { categoryId: 'cat-focus' })
  make('1:1 沟通', at(1, 10, 0), at(1, 10, 30), { categoryId: 'cat-meeting' })
  make('写周报', at(1, 17, 0), at(1, 18, 0), { categoryId: 'cat-chore' })
  make('健身', at(2, 19, 0), at(2, 20, 30), { categoryId: 'cat-personal' })
  make('每日站会', at(0, 10, 15), at(0, 10, 30), {
    categoryId: 'cat-meeting',
    rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
  })
  make('季度复盘', at(3, 15, 0), at(3, 17, 0), { categoryId: 'cat-focus' })
  make('整理资料', at(4, 0, 0), at(4, 23, 59), { categoryId: 'cat-chore', allDay: true })
}

export function runCaptureFlow(): void {  if (!captureDir) return
  const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
  setTimeout(async () => {
    const main = getMainWindow()
    if (main) {
      await wait(700)
      await capture(main, 'main.png')
      try {
        await main.webContents.executeJavaScript(`
          (() => {
            const s = window.__wsStore.getState()
            const occ = s.events.find((e) => !e.allDay) || s.events[0]
            if (!occ) return false
            s.openDraft(occ, { x: window.innerWidth * 0.6, y: window.innerHeight * 0.3 })
            return true
          })()
        `)
        await wait(650)
        await capture(main, 'editor.png')
        await main.webContents.executeJavaScript('window.__wsStore.getState().closeEditor()')
        await wait(200)

        await main.webContents.executeJavaScript('window.__wsStore.getState().setSearchOpen(true)')
        await wait(600)
        await capture(main, 'search.png')
        await main.webContents.executeJavaScript('window.__wsStore.getState().setSearchOpen(false)')

        await main.webContents.executeJavaScript('window.__wsStore.getState().setSettingsOpen(true)')
        await wait(500)
        await capture(main, 'settings.png')
        await main.webContents.executeJavaScript('window.__wsStore.getState().setSettingsOpen(false)')

        await main.webContents.executeJavaScript("document.documentElement.dataset.theme='light'")
        await wait(450)
        await capture(main, 'light.png')
        await main.webContents.executeJavaScript("document.documentElement.dataset.theme='dark'")
        await wait(200)
      } catch (err) {
        console.error('[capture] editor step failed', err)
      }
    }

    requestBriefing('manual', { force: true })
    await wait(1200)
    const bw = getBriefingWindow()
    if (bw) {
      try {
        await wait(500)
      } catch {
        /* ignore */
      }
      await capture(bw, 'briefing.png')
    } else {
      console.error('[capture] briefing window missing')
    }
    setTimeout(() => app.quit(), 300)
  }, 2400)
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** 走完整 UI 链路验证：新建弹层 → 保存 → 列表刷新 */
export async function runUiSmoke(): Promise<void> {
  const main = getMainWindow()
  if (!main) {
    console.log('[ui-smoke] no main window')
    return
  }
  await wait(1600)
  const res = await main.webContents.executeJavaScript(`
    (async () => {
      const useStore = window.__wsStore
      const st = useStore.getState()
      const d = new Date()
      d.setDate(d.getDate() + 1)
      d.setHours(15, 0, 0, 0)
      st.newDraft({ x: 500, y: 400 }, d)
      useStore.getState().patchDraft({ title: 'UI 冒烟事件' })
      await useStore.getState().saveDraft()
      const list = useStore.getState().events
      const hit = list.find((e) => e.title === 'UI 冒烟事件')
      useStore.getState().closeEditor()
      return JSON.stringify({ saved: Boolean(hit), count: list.length, id: hit ? hit.id : null })
    })()
  `)
  console.log('[ui-smoke] ' + res)
  try {
    const parsed = JSON.parse(res) as { id: string | null }
    if (parsed.id) removeEvent(parsed.id, 'all')
  } catch {
    /* ignore */
  }
}

/** 验证"到点前提醒"整条链路：调度器 → 提醒窗 */
export async function runSchedulerSmoke(): Promise<void> {
  const start = new Date(Date.now() + 15_000)
  const ev = createEvent({
    title: '提醒冒烟',
    startISO: start.toISOString(),
    endISO: new Date(start.getTime() + 15 * 60000).toISOString(),
    leadMin: 0
  })
  let visible = false
  let text = ''
  for (let i = 0; i < 30; i++) {
    await wait(2000)
    const win = getBriefingWindow()
    visible = win?.isVisible() ?? false
    if (visible && win) {
      try {
        text = await win.webContents.executeJavaScript('document.body.innerText')
      } catch {
        /* ignore */
      }
      if (text.includes('提醒冒烟')) break
    }
  }
  console.log(
    '[sched-smoke] visible=' + visible + ' text=' + JSON.stringify(text.replace(/\n/g, ' | ').slice(0, 160))
  )
  removeEvent(ev.id, 'all')
}
