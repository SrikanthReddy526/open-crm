// Base URL of the API. Empty = same origin (website: Vite proxy in dev, nginx in production).
// Mobile/desktop builds set VITE_API_URL to the full server URL, e.g. https://crm.example.com
const raw = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export const API_URL = raw.trim().replace(/\/+$/, '')
