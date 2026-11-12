import type { Customer, Page, Reminder, ReminderDue, Visit } from '../api/types'
import { currentDb } from './sync'

/** Read-only queries on the local copy, used when the server cannot be reached. */

function page<T>(items: T[], pageNo: number, size: number): Page<T> & { offline: true } {
  const start = pageNo * size
  return {
    content: items.slice(start, start + size),
    page: pageNo,
    size,
    totalElements: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / size)),
    offline: true,
  }
}

function requireDb() {
  const db = currentDb()
  if (!db) throw new Error('offline-unavailable')
  return db
}

export async function localCustomers(q: string, pageNo: number, size: number) {
  const needle = q.trim().toLowerCase()
  const all = await requireDb().customers.orderBy('name').toArray()
  const hits = needle
    ? all.filter((c) =>
        [c.name, c.company, c.phone, c.email, c.city].some((v) => v?.toLowerCase().includes(needle)),
      )
    : all
  return page<Customer>(hits, pageNo, size)
}

export async function localCustomer(id: string): Promise<Customer> {
  const c = await requireDb().customers.get(id)
  if (!c) throw new Error('offline-not-found')
  return c
}

export async function localVisits(customerId: string | undefined, pageNo: number, size: number) {
  const db = requireDb()
  const list = customerId
    ? await db.visits.where('customerId').equals(customerId).toArray()
    : await db.visits.toArray()
  list.sort((a, b) => b.visitedAt.localeCompare(a.visitedAt))
  return page<Visit>(list, pageNo, size)
}

/** Visits saved on this device that the server has not confirmed yet. */
export async function pendingVisits(customerId?: string): Promise<Visit[]> {
  const db = currentDb()
  if (!db) return []
  const list = await db.visits.filter((v) => !!v.pending && (!customerId || v.customerId === customerId)).toArray()
  return list.sort((a, b) => b.visitedAt.localeCompare(a.visitedAt))
}

export async function localReminders(due: ReminderDue, done: boolean, pageNo: number, size: number) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTomorrow = new Date(startOfToday.getTime() + 86400_000)
  const inAWeek = new Date(startOfToday.getTime() + 7 * 86400_000)
  const all = await requireDb().reminders.orderBy('dueAt').toArray()
  const hits = all.filter((r) => {
    if (done ? r.status !== 'DONE' : r.status !== 'PENDING') return false
    const d = new Date(r.dueAt)
    switch (due) {
      case 'OVERDUE':
        return d < now
      case 'TODAY':
        return d >= startOfToday && d < startOfTomorrow
      case 'WEEK':
        return d >= startOfToday && d < inAWeek
      case 'UPCOMING':
        return d >= now
      default:
        return true
    }
  })
  return page<Reminder>(hits, pageNo, size)
}
