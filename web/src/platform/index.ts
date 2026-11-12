// Detects where the shared React code is running: browser, Capacitor (Android/iOS) or Electron.
import { Capacitor } from '@capacitor/core'

export const isNativeApp = Capacitor.isNativePlatform()
export const isElectron = navigator.userAgent.includes('Electron')
export const isAndroid = /Android/i.test(navigator.userAgent)
export const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)

/** Shown in the list of logged-in devices. */
export function deviceName(): string {
  if (isNativeApp) return Capacitor.getPlatform() === 'ios' ? 'iOS app' : 'Android app'
  if (isElectron) return 'Desktop app'
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = isAndroid ? 'Android' : isIOS ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS'
  return `${browser} on ${os}`
}

/**
 * Random UUID v4. crypto.randomUUID() only exists on HTTPS/localhost, but phones testing
 * over plain http://192.168.x.x are not a "secure context", so fall back to getRandomValues.
 */
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
