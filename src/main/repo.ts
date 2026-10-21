import { randomUUID } from 'node:crypto'
import { RRule } from 'rrule'
import { conn } from './db'
import { fromFloating, toFloating } from './time'
import type {
  Category,
  EditScope,
  EventInput,
  Occurrence,
  SearchHit,
  Settings
} from '../shared/types'

interface EventRowDB {
  id: string
  title: string
  notes: string | null
  category_id: string | null
  color: string | null
  start_utc: string
  end_utc: string
  all_day: number
  rrule: string | null
  rrule_until: string | null
  lead_min: number | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface ExceptionDB {
  event_id: string
  occurrence_start_utc: string
  kind: 'cancelled' | 'override'
  override_start_utc: string | null
  override_end_utc: string | null
  override_title: string | null
  override_notes: string | null
  override_category_id: string | null
  override_color: string | null
}

interface StateDB {
  event_id: string
  occurrence_start_utc: string
  status: string
  reminded_at: string | null
}

const FALLBACK_COLOR = '#0A84FF'
const MAX_OCCURRENCES = 500

function mapCategory(r: Record<string, unknown>): Category {
  return {
    id: String(r.id),
    name: String(r.name),
    color: String(r.color),
    sort: Number(r.sort ?? 0)
  }
}

export function listCategories(): Category[] {
  const rows = conn().prepare('SELECT * FROM categories ORDER BY sort ASC, name ASC').all()
  return rows.map(mapCategory)
}

export function saveCategory(input: { id: string; name: string; color: string; sort?: number }): Category[] {
  const exists = conn().prepare('SELECT id FROM categories WHERE id = ?').get(input.id)
  if (exists) {
    conn()
      .prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?')
      .run(input.name, input.color, input.id)
  } else {
    const maxSort = conn().prepare('SELECT COALESCE(MAX(sort), 0) AS s FROM categories').get() as {
      s: number
    }
    conn()
      .prepare('INSERT INTO categories (id, name, color, sort, is_builtin) VALUES (?, ?, ?, ?, 0)')
      .run(input.id, input.name, input.color, input.sort ?? Number(maxSort.s) + 1)
  }
  return listCategories()
}

export function deleteCategory(id: string): Category[] {
  const row = conn().prepare('SELECT is_builtin FROM categories WHERE id = ?').get(id) as
    | { is_builtin: number }
    | undefined
  if (row && Number(row.is_builtin) === 1) return listCategories()
  conn().prepare('UPDATE events SET category_id = NULL WHERE category_id = ?').run(id)
  conn().prepare('DELETE FROM categories WHERE id = ?').run(id)
  return listCategories()
}

export function getSettings(): Settings {
  const rows = conn().prepare('SELECT key, value FROM settings').all() as Array<{
    key: string
    value: string
  }>
  const raw: Record<string, unknown> = {}
  for (const r of rows) {
    try {
      raw[r.key] = JSON.parse(r.value)
    } catch {
      raw[r.key] = null
    }
  }
  return {
    defaultLeadMinutes: Number(raw.defaultLeadMinutes ?? 10),
    autoLaunch: Boolean(raw.autoLaunch ?? true),
    reduceTransparency: Boolean(raw.reduceTransparency ?? false),
    mutedUntil: (raw.mutedUntil as string | null) ?? null,
    closeHintShown: Boolean(raw.closeHintShown ?? false)
  }
}

export function patchSettings(patch: Partial<Settings>): Settings {
  const current = getSettings()
  const next = { ...current, ...patch }
  const stmt = conn().prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )
  for (const [k, v] of Object.entries(next)) stmt.run(k, JSON.stringify(v))
  return next
}

function nowISO(): string {
  return new Date().toISOString()
}

function categoryNameMap(): Map<string, Category> {
  const map = new Map<string, Category>()
  for (const c of listCategories()) map.set(c.id, c)
  return map
}

function buildOccurrence(args: {
  ev: EventRowDB
  occurrenceStartISO: string
  startISO: string
  endISO: string
  override?: ExceptionDB | null
  done: boolean
  categories: Map<string, Category>
}): Occurrence {
  const { ev, occurrenceStartISO, startISO, endISO, override, done, categories } = args
  const categoryId = override?.override_category_id ?? ev.category_id
  const cat = categoryId ? categories.get(categoryId) : undefined
  const color = override?.override_color ?? ev.color ?? cat?.color ?? FALLBACK_COLOR
  return {
    id: ev.id,
    occurrenceStartISO,
    title: override?.override_title ?? ev.title,
    notes: override?.override_notes ?? ev.notes,
    categoryId: categoryId ?? null,
    color,
    categoryName: cat?.name ?? null,
    startISO,
    endISO,
    allDay: Number(ev.all_day) === 1,
    rrule: ev.rrule,
    leadMin: ev.lead_min,
    done,
    isRecurring: Boolean(ev.rrule)
  }
}

function loadAux(eventIds: string[]): {
  exceptions: Map<string, ExceptionDB>
  states: Map<string, StateDB>
} {
  const exceptions = new Map<string, ExceptionDB>()
  const states = new Map<string, StateDB>()
  if (eventIds.length === 0) return { exceptions, states }
  const placeholders = eventIds.map(() => '?').join(',')
  const excRows = conn()
    .prepare(`SELECT * FROM event_exceptions WHERE event_id IN (${placeholders})`)
    .all(...eventIds) as unknown as ExceptionDB[]
  for (const e of excRows) exceptions.set(`${e.event_id}|${e.occurrence_start_utc}`, e)
  const stRows = conn()
    .prepare(`SELECT * FROM occurrence_state WHERE event_id IN (${placeholders})`)
    .all(...eventIds) as unknown as StateDB[]
  for (const s of stRows) states.set(`${s.event_id}|${s.occurrence_start_utc}`, s)
  return { exceptions, states }
}

function expandEvent(
  ev: EventRowDB,
  from: Date,
  to: Date,
  categories: Map<string, Category>,
  exceptions: Map<string, ExceptionDB>,
  states: Map<string, StateDB>
): Occurrence[] {
  const out: Occurrence[] = []
  const start = new Date(ev.start_utc)
  const end = new Date(ev.end_utc)
  const duration = Math.max(1, end.getTime() - start.getTime())

  if (!ev.rrule) {
    if (end.getTime() <= from.getTime() || start.getTime() >= to.getTime()) return out
    const key = `${ev.id}|${start.toISOString()}`
    out.push(
      buildOccurrence({
        ev,
        occurrenceStartISO: start.toISOString(),
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        override: exceptions.get(key) ?? null,
        done: states.get(key)?.status === 'done',
        categories
      })
    )
    return out
  }

  const options = RRule.parseString(ev.rrule)
  options.dtstart = toFloating(start)
  if (ev.rrule_until) options.until = toFloating(new Date(ev.rrule_until))

  let rule: RRule
  try {
    rule = new RRule(options)
  } catch {
    return out
  }

  const fromF = toFloating(from)
  const toF = toFloating(to)
  let occurrences: Date[] = []
  try {
    occurrences = rule.between(fromF, toF, true)
  } catch {
    return out
  }
  if (occurrences.length > MAX_OCCURRENCES) occurrences = occurrences.slice(0, MAX_OCCURRENCES)

  for (const occ of occurrences) {
    const realStart = fromFloating(occ)
    const realEnd = new Date(realStart.getTime() + duration)
    const occISO = realStart.toISOString()
    const key = `${ev.id}|${occISO}`
    const exc = exceptions.get(key)
    if (exc?.kind === 'cancelled') continue

    let startISO = realStart.toISOString()
    let endISO = realEnd.toISOString()
    if (exc?.kind === 'override') {
      if (exc.override_start_utc) startISO = exc.override_start_utc
      if (exc.override_end_utc) endISO = exc.override_end_utc
      const os = new Date(startISO)
      const oe = new Date(endISO)
      if (oe.getTime() <= from.getTime() || os.getTime() >= to.getTime()) continue
    }

    out.push(
      buildOccurrence({
        ev,
        occurrenceStartISO: occISO,
        startISO,
        endISO,
        override: exc?.kind === 'override' ? exc : null,
        done: states.get(key)?.status === 'done',
        categories
      })
    )
  }
  return out
}

export function listRange(fromISO: string, toISO: string): Occurrence[] {
  const from = new Date(fromISO)
  const to = new Date(toISO)
  const rows = conn()
    .prepare(
      `SELECT * FROM events
       WHERE deleted_at IS NULL
         AND start_utc < ?
         AND (rrule IS NOT NULL OR end_utc > ?)`
    )
    .all(to.toISOString(), from.toISOString()) as unknown as EventRowDB[]

  const { exceptions, states } = loadAux(rows.map((r) => r.id))
  const categories = categoryNameMap()
  const all: Occurrence[] = []
  for (const ev of rows) all.push(...expandEvent(ev, from, to, categories, exceptions, states))
  all.sort((a, b) => a.startISO.localeCompare(b.startISO))
  return all
}

export function getEvent(id: string): EventRowDB | undefined {
  return conn().prepare('SELECT * FROM events WHERE id = ?').get(id) as EventRowDB | undefined
}

function resolveColor(input: EventInput): string | null {
  return input.color ?? null
}

export function createEvent(input: EventInput): Occurrence {
  const id = randomUUID()
  const stamp = nowISO()
  conn()
    .prepare(
      `INSERT INTO events
        (id, title, notes, category_id, color, start_utc, end_utc, all_day, rrule, rrule_until, lead_min, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.title,
      input.notes ?? null,
      input.categoryId ?? null,
      resolveColor(input),
      new Date(input.startISO).toISOString(),
      new Date(input.endISO).toISOString(),
      input.allDay ? 1 : 0,
      input.rrule ?? null,
      input.rruleUntil ? new Date(input.rruleUntil).toISOString() : null,
      input.leadMin ?? null,
      stamp,
      stamp
    )
  const ev = getEvent(id)!
  const categories = categoryNameMap()
  return buildOccurrence({
    ev,
    occurrenceStartISO: new Date(ev.start_utc).toISOString(),
    startISO: ev.start_utc,
    endISO: ev.end_utc,
    done: false,
    categories
  })
}

function upsertException(row: {
  eventId: string
  occurrenceStartISO: string
  kind: 'cancelled' | 'override'
  startISO?: string | null
  endISO?: string | null
  title?: string | null
  notes?: string | null
  categoryId?: string | null
  color?: string | null
}): void {
  conn()
    .prepare(
      `INSERT INTO event_exceptions
        (id, event_id, occurrence_start_utc, kind, override_start_utc, override_end_utc,
         override_title, override_notes, override_category_id, override_color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(event_id, occurrence_start_utc) DO UPDATE SET
         kind = excluded.kind,
         override_start_utc = excluded.override_start_utc,
         override_end_utc = excluded.override_end_utc,
         override_title = excluded.override_title,
         override_notes = excluded.override_notes,
         override_category_id = excluded.override_category_id,
         override_color = excluded.override_color`
    )
    .run(
      randomUUID(),
      row.eventId,
      row.occurrenceStartISO,
      row.kind,
      row.startISO ?? null,
      row.endISO ?? null,
      row.title ?? null,
      row.notes ?? null,
      row.categoryId ?? null,
      row.color ?? null
    )
}

export function updateEvent(
  id: string,
  patch: Partial<EventInput>,
  scope: EditScope,
  occurrenceStartISO?: string
): void {
  const ev = getEvent(id)
  if (!ev) return
  const stamp = nowISO()

  if (ev.rrule && scope === 'this' && occurrenceStartISO) {
    const occISO = new Date(occurrenceStartISO).toISOString()
    const baseStart = new Date(ev.start_utc)
    const duration = new Date(ev.end_utc).getTime() - baseStart.getTime()
    const nextStart = patch.startISO ? new Date(patch.startISO) : new Date(occISO)
    const nextEnd = patch.endISO
      ? new Date(patch.endISO)
      : new Date(nextStart.getTime() + duration)
    upsertException({
      eventId: id,
      occurrenceStartISO: occISO,
      kind: 'override',
      startISO: nextStart.toISOString(),
      endISO: nextEnd.toISOString(),
      title: patch.title ?? null,
      notes: patch.notes ?? null,
      categoryId: patch.categoryId ?? null,
      color: patch.color ?? null
    })
    conn().prepare('UPDATE events SET updated_at = ? WHERE id = ?').run(stamp, id)
    return
  }

  if (ev.rrule && scope === 'future' && occurrenceStartISO) {
    const occISO = new Date(occurrenceStartISO).toISOString()
    const cut = new Date(new Date(occISO).getTime() - 1000).toISOString()
    conn().prepare('UPDATE events SET rrule_until = ?, updated_at = ? WHERE id = ?').run(cut, stamp, id)
    const inherited: EventInput = {
      title: patch.title ?? ev.title,
      notes: patch.notes ?? ev.notes,
      categoryId: patch.categoryId ?? ev.category_id,
      color: patch.color ?? ev.color,
      startISO: patch.startISO ?? occISO,
      endISO:
        patch.endISO ??
        new Date(new Date(occISO).getTime() + (new Date(ev.end_utc).getTime() - new Date(ev.start_utc).getTime())).toISOString(),
      allDay: patch.allDay ?? Number(ev.all_day) === 1,
      rrule: ev.rrule,
      rruleUntil: patch.rruleUntil ?? ev.rrule_until,
      leadMin: patch.leadMin ?? ev.lead_min
    }
    createEvent(inherited)
    return
  }

  conn()
    .prepare(
      `UPDATE events SET
         title = ?, notes = ?, category_id = ?, color = ?,
         start_utc = ?, end_utc = ?, all_day = ?, rrule = ?, rrule_until = ?, lead_min = ?,
         updated_at = ?
       WHERE id = ?`
    )
    .run(
      patch.title ?? ev.title,
      patch.notes ?? ev.notes,
      patch.categoryId ?? ev.category_id,
      patch.color ?? ev.color,
      patch.startISO ? new Date(patch.startISO).toISOString() : ev.start_utc,
      patch.endISO ? new Date(patch.endISO).toISOString() : ev.end_utc,
      patch.allDay === undefined ? ev.all_day : patch.allDay ? 1 : 0,
      patch.rrule === undefined ? ev.rrule : patch.rrule,
      patch.rruleUntil === undefined
        ? ev.rrule_until
        : patch.rruleUntil
          ? new Date(patch.rruleUntil).toISOString()
          : null,
      patch.leadMin === undefined ? ev.lead_min : patch.leadMin,
      stamp,
      id
    )
}

export function removeEvent(id: string, scope: EditScope, occurrenceStartISO?: string): void {
  const ev = getEvent(id)
  if (!ev) return
  if (!ev.rrule || scope === 'all') {
    conn().prepare('UPDATE events SET deleted_at = ?, updated_at = ? WHERE id = ?').run(nowISO(), nowISO(), id)
    return
  }
  const occISO = new Date(occurrenceStartISO ?? ev.start_utc).toISOString()
  if (scope === 'this') {
    upsertException({ eventId: id, occurrenceStartISO: occISO, kind: 'cancelled' })
    return
  }
  conn()
    .prepare('UPDATE events SET rrule_until = ?, updated_at = ? WHERE id = ?')
    .run(new Date(new Date(occISO).getTime() - 1000).toISOString(), nowISO(), id)
}

export function setDone(id: string, occurrenceStartISO: string, done: boolean): void {
  const occISO = new Date(occurrenceStartISO).toISOString()
  conn()
    .prepare(
      `INSERT INTO occurrence_state (event_id, occurrence_start_utc, status)
       VALUES (?, ?, ?)
       ON CONFLICT(event_id, occurrence_start_utc) DO UPDATE SET status = excluded.status`
    )
    .run(id, occISO, done ? 'done' : 'pending')
}

export function markReminded(id: string, occurrenceStartISO: string): void {
  conn()
    .prepare(
      `INSERT INTO occurrence_state (event_id, occurrence_start_utc, status, reminded_at)
       VALUES (?, ?, 'pending', ?)
       ON CONFLICT(event_id, occurrence_start_utc) DO UPDATE SET reminded_at = excluded.reminded_at`
    )
    .run(id, new Date(occurrenceStartISO).toISOString(), nowISO())
}

export function isReminded(id: string, occurrenceStartISO: string): boolean {
  const row = conn()
    .prepare('SELECT reminded_at FROM occurrence_state WHERE event_id = ? AND occurrence_start_utc = ?')
    .get(id, new Date(occurrenceStartISO).toISOString()) as { reminded_at: string | null } | undefined
  return Boolean(row?.reminded_at)
}

export function searchEvents(text: string): SearchHit[] {
  const q = text.trim()
  if (!q) return []
  const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`
  const now = Date.now()
  const from = new Date(now - 1000 * 60 * 60 * 24 * 200).toISOString()
  const to = new Date(now + 1000 * 60 * 60 * 24 * 200).toISOString()
  const rows = conn()
    .prepare(
      `SELECT * FROM events
       WHERE deleted_at IS NULL
         AND (title LIKE ? ESCAPE '\\' OR COALESCE(notes, '') LIKE ? ESCAPE '\\')
         AND start_utc < ?`
    )
    .all(like, like, to) as unknown as EventRowDB[]
  const { exceptions, states } = loadAux(rows.map((r) => r.id))
  const categories = categoryNameMap()
  const hits: SearchHit[] = []
  for (const ev of rows) {
    const occs = expandEvent(ev, new Date(from), new Date(to), categories, exceptions, states)
    for (const o of occs) {
      hits.push({ ...o, jumpWeekISO: o.startISO })
      if (hits.length >= 80) break
    }
    if (hits.length >= 80) break
  }
  hits.sort((a, b) => Math.abs(new Date(a.startISO).getTime() - now) - Math.abs(new Date(b.startISO).getTime() - now))
  return hits
}

export function nextOccurrenceAfter(afterISO: string, withinDays = 30): Occurrence | null {
  const after = new Date(afterISO)
  const to = new Date(after.getTime() + withinDays * 86400000)
  const list = listRange(after.toISOString(), to.toISOString())
  return list.find((o) => new Date(o.endISO).getTime() > after.getTime()) ?? null
}

export function upcomingOccurrences(fromISO: string, toISO: string): Occurrence[] {
  return listRange(fromISO, toISO)
}
