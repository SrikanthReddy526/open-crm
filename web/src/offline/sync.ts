import type { QueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { syncApi } from '../api/crm'
import { tokenStore } from '../api/tokenStore'
import type { Customer, Reminder, SyncEntity, SyncMutation, SyncOp, Visit } from '../api/types'
import { uuid } from '../platform'
import { dbFor, offlineSupported, type CrmDb, type OutboxEntry } from './db'

/**
 * Offline sync engine.
 *
 *  - Changes made without a connection go to the local "outbox" and are applied to the local copy at once.
 *  - When online (app start, connection back, every few minutes, right after a change) the outbox is pushed to
 *    /api/sync/push and fresh data is pulled from /api/sync/pull.
 *  - The server is the source of truth: on a conflict its copy replaces the local one and the user is told.
 */

const PERIOD_MS = 5 * 60_000
const FULL_RESYNC_MS = 24 * 3600_000
const PUSH_BATCH = 100

// ------------------------------------------------------------------ status store (for the UI badge)

export interface SyncStatus {
  online: boolean
  syncing: boolean
  pending: number
  notices: number
  lastSyncAt: string | null
  lastError: string | null
}

let status: SyncStatus = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  pending: 0,
  notices: 0,
  lastSyncAt: null,
  lastError: null,
}
const listeners = new Set<() => void>()

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch }
  listeners.forEach((l) => l())
}

export const syncStatusStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  get: () => status,
}

// ------------------------------------------------------------------ helpers

/** No answer from the API (offline, server down, or a proxy saying the API is down). */
export function isNetworkError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false
  if (!err.response) return true
  return [502, 503, 504].includes(err.response.status)
}

export function currentDb(): CrmDb | null {
  const user = tokenStore.getUser()
  if (!offlineSupported || !user || !tokenStore.getRefresh()) return null
  return dbFor(user.id)
}

let queryClient: QueryClient | null = null

/** Lets the engine refresh screens after a sync. */
export function attachQueryClient(qc: QueryClient) {
  queryClient = qc
}

async function refreshCounts(db: CrmDb) {
  setStatus({ pending: await db.outbox.count(), notices: await db.notices.count() })
}

// ------------------------------------------------------------------ local writes (offline changes)

type Row = Customer | Visit | Reminder

function table(db: CrmDb, entity: SyncEntity) {
  if (entity === 'customer') return db.customers
  if (entity === 'visit') return db.visits
  return db.reminders
}

/**
 * Saves a change locally and queues it for the server.
 * Several offline edits of the same record are merged into one queued change.
 */
export async function queueChange(entity: SyncEntity, op: SyncOp, record: Row): Promise<void> {
  const db = currentDb()
  if (!db) throw new Error('Offline storage unavailable')
  const { pending: _p, ...data } = record as Row & { pending?: boolean }
  await db.transaction('rw', [db.outbox, table(db, entity)], async () => {
    const existing = await db.outbox.where('[entity+id]').equals([entity, record.id]).first()
    if (existing && op !== 'DELETE') {
      // CREATE + edit = CREATE with new data; UPDATE + edit = UPDATE (keeping the first baseVersion)
      await db.outbox.update(existing.seq!, { data })
    } else if (existing?.op === 'CREATE' && op === 'DELETE') {
      await db.outbox.delete(existing.seq!) // never reached the server: just forget it
    } else {
      const entry: OutboxEntry = {
        mutationId: uuid(),
        entity,
        op,
        id: record.id,
        baseVersion: op === 'CREATE' ? null : record.version,
        data,
        createdAt: new Date().toISOString(),
      }
      await db.outbox.add(entry)
    }
    const t = table(db, entity) as unknown as { put(r: unknown): Promise<unknown>; delete(id: string): Promise<void> }
    if (op === 'DELETE') await t.delete(record.id)
    else await t.put({ ...data, pending: true })
  })
  await refreshCounts(db)
  void syncNow() // try straight away; harmless when offline
}

// ------------------------------------------------------------------ sync

let running: Promise<void> | null = null

/** Push queued changes, then pull fresh data. Concurrent calls share one run. */
export function syncNow(): Promise<void> {
  running ??= run().finally(() => {
    running = null
  })
  return running
}

async function run() {
  const db = currentDb()
  if (!db) return
  if (!navigator.onLine) {
    setStatus({ online: false })
    await refreshCounts(db)
    return
  }
  setStatus({ syncing: true, online: true })
  try {
    await push(db)
    await pull(db)
    const now = new Date().toISOString()
    await db.setMeta('lastSyncAt', now)
    setStatus({ lastSyncAt: now, lastError: null })
    void queryClient?.invalidateQueries()
  } catch (err) {
    if (isNetworkError(err)) setStatus({ online: false })
    else setStatus({ lastError: err instanceof Error ? err.message : String(err) })
  } finally {
    await refreshCounts(db)
    setStatus({ syncing: false })
  }
}

async function push(db: CrmDb) {
  for (;;) {
    const batch = await db.outbox.orderBy('seq').limit(PUSH_BATCH).toArray()
    if (batch.length === 0) return
    const results = await syncApi.push(
      batch.map(({ mutationId, entity, op, id, baseVersion, data }) => ({ mutationId, entity, op, id, baseVersion, data })),
    )
    const byMutation = new Map(results.map((r) => [r.mutationId, r]))
    await db.transaction('rw', [db.outbox, db.customers, db.visits, db.reminders, db.notices], async () => {
      for (const entry of batch) {
        const result = byMutation.get(entry.mutationId)
        if (!result) continue
        await db.outbox.delete(entry.seq!)
        const t = table(db, entry.entity) as unknown as {
          put(r: unknown): Promise<unknown>
          delete(id: string): Promise<void>
        }
        // The server copy replaces ours; no copy = deleted, or never created (rejected offline create).
        const server = result.data as Row | null
        if (server) await t.put(server)
        else await t.delete(entry.id)

        if (result.status === 'CONFLICT' || result.status === 'REJECTED') {
          const d = entry.data ?? {}
          await db.notices.add({
            entity: entry.entity,
            recordId: entry.id,
            label: String(d.name ?? d.title ?? d.customerName ?? entry.id),
            status: result.status,
            message: result.message,
            at: new Date().toISOString(),
          })
        }
      }
    })
    if (results.length < batch.length) return // server answered only part: try the rest next time
  }
}

async function pull(db: CrmDb) {
  const lastPull = await db.getMeta('lastPull')
  const lastFull = await db.getMeta('lastFullPull')
  const needFull = !lastPull || !lastFull || Date.now() - Date.parse(lastFull) > FULL_RESYNC_MS
  const res = await syncApi.pull(needFull ? null : lastPull)

  await db.transaction('rw', [db.customers, db.visits, db.reminders, db.outbox, db.meta], async () => {
    // Never overwrite a record that still has a change waiting to be sent.
    const waiting = new Set((await db.outbox.toArray()).map((e) => `${e.entity}:${e.id}`))
    const keep = (entity: SyncEntity) => (r: { id: string }) => !waiting.has(`${entity}:${r.id}`)

    if (res.full) {
      // A full pull also removes records that were reassigned away from this user.
      for (const entity of ['customer', 'visit', 'reminder'] as SyncEntity[]) {
        const t = table(db, entity)
        const ids = (await t.toCollection().primaryKeys()) as string[]
        await t.bulkDelete(ids.filter((id) => !waiting.has(`${entity}:${id}`)))
      }
    }
    await db.customers.bulkPut(res.customers.filter(keep('customer')))
    await db.visits.bulkPut(res.visits.filter(keep('visit')))
    await db.reminders.bulkPut(res.reminders.filter(keep('reminder')))
    await db.customers.bulkDelete(res.deleted.customers.filter((id) => !waiting.has(`customer:${id}`)))
    await db.visits.bulkDelete(res.deleted.visits.filter((id) => !waiting.has(`visit:${id}`)))
    await db.reminders.bulkDelete(res.deleted.reminders.filter((id) => !waiting.has(`reminder:${id}`)))

    await db.setMeta('lastPull', res.serverTime)
    if (res.full) await db.setMeta('lastFullPull', res.serverTime)
  })
}

// ------------------------------------------------------------------ lifecycle

let timer: ReturnType<typeof setInterval> | null = null

/** Starts background sync for the logged-in user (idempotent). */
export function startSync() {
  const db = currentDb()
  if (!db) return
  void db.getMeta('lastSyncAt').then((v) => setStatus({ lastSyncAt: v }))
  void refreshCounts(db)
  if (!timer) {
    timer = setInterval(() => void syncNow(), PERIOD_MS)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
  }
  void syncNow()
}

export function stopSync() {
  if (timer) clearInterval(timer)
  timer = null
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
  document.removeEventListener('visibilitychange', onVisible)
  setStatus({ pending: 0, notices: 0, lastSyncAt: null, lastError: null })
}

function onOnline() {
  setStatus({ online: true })
  void syncNow()
}
function onOffline() {
  setStatus({ online: false })
}
function onVisible() {
  if (document.visibilityState === 'visible') void syncNow()
}

/** How many changes are still waiting (used to warn before logging out). */
export async function pendingCount(): Promise<number> {
  return (await currentDb()?.outbox.count()) ?? 0
}

export type { SyncMutation }
