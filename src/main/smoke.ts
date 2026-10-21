import * as repo from './repo'

function ok(name: string, cond: boolean, extra = ''): string {
  return `${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`
}

function range(fromDays: number, toDays: number): { fromISO: string; toISO: string } {
  const from = new Date()
  from.setDate(from.getDate() + fromDays)
  from.setHours(0, 0, 0, 0)
  const to = new Date()
  to.setDate(to.getDate() + toDays)
  to.setHours(0, 0, 0, 0)
  return { fromISO: from.toISOString(), toISO: to.toISOString() }
}

export function runSmoke(): number {
  const out: string[] = []
  try {
    const start = new Date()
    start.setHours(9, 30, 0, 0)
    const end = new Date(start.getTime() + 60 * 60000)

    const created = repo.createEvent({
      title: '周会 smoke',
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      rrule: 'FREQ=WEEKLY'
    })
    out.push(ok('create event', Boolean(created.id)))

    const w0 = range(-1, 8)
    const list0 = repo.listRange(w0.fromISO, w0.toISO)
    out.push(ok('list range returns event', list0.length >= 1, `count=${list0.length}`))

    const w4 = range(-1, 42)
    const list4 = repo.listRange(w4.fromISO, w4.toISO)
    const weekly = list4.filter((o) => o.title === '周会 smoke')
    out.push(ok('weekly expands to 6+ occurrences', weekly.length >= 6, `count=${weekly.length}`))

    const hits = repo.searchEvents('smoke')
    out.push(ok('search finds event', hits.length >= 1, `hits=${hits.length}`))

    repo.setDone(created.id, created.occurrenceStartISO, true)
    const afterDone = repo
      .listRange(w0.fromISO, w0.toISO)
      .find((o) => o.occurrenceStartISO === created.occurrenceStartISO)
    out.push(ok('mark done persists', afterDone?.done === true))

    const target = repo.listRange(w4.fromISO, w4.toISO).find((o) => o.title === '周会 smoke' && !o.done)
    if (target) {
      const movedStart = new Date(new Date(target.startISO).getTime() + 2 * 3600000)
      const movedEnd = new Date(new Date(target.endISO).getTime() + 2 * 3600000)
      repo.updateEvent(
        created.id,
        { startISO: movedStart.toISOString(), endISO: movedEnd.toISOString() },
        'this',
        target.occurrenceStartISO
      )
      const after = repo.listRange(w4.fromISO, w4.toISO).filter((o) => o.title === '周会 smoke')
      const moved = after.find((o) => o.occurrenceStartISO === target.occurrenceStartISO)
      out.push(
        ok(
          'single occurrence moved (scope=this)',
          Boolean(moved) && Math.abs(new Date(moved!.startISO).getTime() - movedStart.getTime()) < 1000,
          moved ? new Date(moved.startISO).toISOString() : 'missing'
        )
      )
      out.push(ok('other occurrences untouched', after.length === weekly.length, `count=${after.length}`))

      repo.removeEvent(created.id, 'this', target.occurrenceStartISO)
      const afterDel = repo.listRange(w4.fromISO, w4.toISO).filter((o) => o.title === '周会 smoke')
      out.push(ok('delete single occurrence', afterDel.length === after.length - 1, `count=${afterDel.length}`))
    }

    repo.removeEvent(created.id, 'all')
    const afterAll = repo.listRange(w4.fromISO, w4.toISO).filter((o) => o.title === '周会 smoke')
    out.push(ok('delete whole series', afterAll.length === 0, `count=${afterAll.length}`))

    const cats = repo.listCategories()
    out.push(ok('categories seeded', cats.length >= 5, `count=${cats.length}`))

    const settings = repo.getSettings()
    out.push(ok('default lead = 10', settings.defaultLeadMinutes === 10))
  } catch (err) {
    out.push('FAIL  exception: ' + String(err))
  }

  const failed = out.filter((l) => l.startsWith('FAIL')).length
  console.log('--- SMOKE ---')
  for (const line of out) console.log(line)
  console.log(`--- SMOKE ${failed === 0 ? 'ALL PASS' : failed + ' FAILED'} ---`)
  return failed === 0 ? 0 : 1
}
