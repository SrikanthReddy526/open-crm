import i18n from '../i18n'

/** Indian number formatting (lakh/crore grouping) in English or Telugu. */
export function locale(): string {
  return i18n.resolvedLanguage === 'te' ? 'te-IN' : 'en-IN'
}

/**
 * ₹ amounts. {@code compact} uses Indian units: ₹4.5 L (lakh), ₹1.2 Cr (crore) — in Telugu ₹4.5 లక్షలు / కోట్లు.
 * (Intl's own "compact" gives Western K/M units, which Indian users don't expect.)
 */
export function formatMoney(amount: number | null | undefined, currency = 'INR', compact = false): string {
  if (amount == null) return '—'
  const full = (n: number, digits: number) =>
    new Intl.NumberFormat(locale(), { style: 'currency', currency, maximumFractionDigits: digits }).format(n)
  if (compact && currency === 'INR' && Math.abs(amount) >= 100_000) {
    const te = i18n.resolvedLanguage === 'te'
    const [value, unit] =
      Math.abs(amount) >= 10_000_000 ? [amount / 10_000_000, te ? ' కోట్లు' : ' Cr'] : [amount / 100_000, te ? ' లక్షలు' : ' L']
    return full(Math.round(value * 10) / 10, 1) + unit
  }
  return full(amount, compact || Number.isInteger(amount) ? 0 : 2)
}

/** "Saturday, 7 November" in the app language. */
export function formatToday(): string {
  return new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(locale()).format(n)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  // Plain dates (2026-11-07) are calendar dates: don't shift them by time zone.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso)
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(locale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** "5 min ago", "in 2 days" */
export function formatRelative(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' })
  const abs = Math.abs(diff)
  if (abs < 60) return rtf.format(Math.round(diff), 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  return rtf.format(Math.round(diff / 86400), 'day')
}

/** ISO time → value for <input type="datetime-local"> (local time, no seconds). */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** <input type="datetime-local"> value → ISO time. */
export function fromLocalInput(value: string): string {
  return new Date(value).toISOString()
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[\s()-]/g, '')}`
}

/** WhatsApp link for an Indian number (adds +91 when no country code was given). */
export function whatsappHref(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.length === 10) digits = `91${digits}`
  return `https://wa.me/${digits}`
}
