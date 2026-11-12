import { isNativeApp } from '../platform'
import { currentDb } from './sync'

/**
 * Pop-up alerts when a reminder falls due, while the app is open (website, installed PWA, desktop app).
 * Uses the reminders already saved on the device, so it also works offline.
 * The Android/iOS app would need the Capacitor local-notifications plugin for alerts while closed.
 */

const SEEN_KEY = 'crm.notifiedReminders'
const WINDOW_MS = 15 * 60_000 // don't alert for reminders that were due long ago

export const alertsSupported = !isNativeApp && typeof window !== 'undefined' && 'Notification' in window

function seen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function remember(ids: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-200)))
  } catch {
    /* storage unavailable */
  }
}

async function check(title: string) {
  if (Notification.permission !== 'granted') return
  const db = currentDb()
  if (!db) return
  const now = Date.now()
  const done = seen()
  const due = await db.reminders
    .where('dueAt')
    .between(new Date(now - WINDOW_MS).toISOString(), new Date(now).toISOString(), true, true)
    .filter((r) => r.status === 'PENDING' && !done.includes(r.id))
    .toArray()
  for (const r of due) {
    const n = new Notification(`${title}: ${r.title}`, { body: r.customerName ?? r.description ?? '', tag: r.id, icon: '/pwa-192x192.png' })
    n.onclick = () => {
      window.focus()
      window.location.assign('/reminders?due=OVERDUE')
    }
    done.push(r.id)
  }
  if (due.length) remember(done)
}

/** Starts checking every minute; returns a stop function. */
export function startReminderAlerts(title: string): () => void {
  if (!alertsSupported) return () => {}
  void check(title)
  const timer = setInterval(() => void check(title), 60_000)
  return () => clearInterval(timer)
}
