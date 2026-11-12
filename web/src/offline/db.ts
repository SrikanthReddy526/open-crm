import Dexie, { type Table } from 'dexie'
import type { Customer, Reminder, SyncEntity, SyncMutation, Visit } from '../api/types'

/** A change made on this device that has not reached the server yet. */
export interface OutboxEntry extends SyncMutation {
  seq?: number
  createdAt: string
}

/** Shown to the user when the server did not accept an offline change. */
export interface SyncNotice {
  seq?: number
  entity: SyncEntity
  recordId: string
  label: string
  status: 'CONFLICT' | 'REJECTED'
  message: string | null
  at: string
}

interface Meta {
  key: string
  value: string
}

/**
 * Local copy of the data a user needs in the field (IndexedDB via Dexie).
 * One database per user, so a shared phone never shows the previous user's data.
 */
export class CrmDb extends Dexie {
  customers!: Table<Customer & { pending?: boolean }, string>
  visits!: Table<Visit, string>
  reminders!: Table<Reminder, string>
  outbox!: Table<OutboxEntry, number>
  notices!: Table<SyncNotice, number>
  meta!: Table<Meta, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      customers: 'id, name, updatedAt',
      visits: 'id, customerId, visitedAt',
      reminders: 'id, dueAt, status',
      outbox: '++seq, mutationId, [entity+id]',
      notices: '++seq',
      meta: 'key',
    })
  }

  async getMeta(key: string): Promise<string | null> {
    return (await this.meta.get(key))?.value ?? null
  }

  async setMeta(key: string, value: string | null): Promise<void> {
    if (value === null) await this.meta.delete(key)
    else await this.meta.put({ key, value })
  }
}

let current: { userId: string; db: CrmDb } | null = null

/** The local database of the given user (opened on first use). */
export function dbFor(userId: string): CrmDb {
  if (current?.userId !== userId) {
    current?.db.close()
    current = { userId, db: new CrmDb(`opencrm-${userId}`) }
  }
  return current.db
}

/** Deletes a user's local data (on logout). */
export async function deleteLocalData(userId: string): Promise<void> {
  if (current?.userId === userId) {
    current.db.close()
    current = null
  }
  await Dexie.delete(`opencrm-${userId}`)
}

/** IndexedDB can be missing (very old browsers, some private modes). The app then just works online. */
export const offlineSupported = typeof indexedDB !== 'undefined'
