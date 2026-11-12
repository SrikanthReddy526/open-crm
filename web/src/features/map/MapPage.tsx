import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { customersApi } from '../../api/customers'
import { errorMessage } from '../../api/errors'
import type { Customer, NearbyCustomer } from '../../api/types'
import { currentDb, isNetworkError } from '../../offline/sync'
import { getCurrentPosition, openDirections, type LatLng } from '../../platform/location'

// OpenStreetMap tiles by default. For heavy use, point VITE_TILE_URL at your own or a commercial tile server
// (OSM's public servers have a fair-use policy).
const TILE_URL = (import.meta.env.VITE_TILE_URL as string | undefined) || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const DEFAULT_CENTER: L.LatLngTuple = [16.5062, 80.648] // Vijayawada
const VIEW_KEY = 'crm.mapView'

function savedView(): { center: L.LatLngTuple; zoom: number } {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '')
    if (Array.isArray(v.center) && typeof v.zoom === 'number') return v
  } catch {
    /* first visit */
  }
  return { center: DEFAULT_CENTER, zoom: 12 }
}

async function customersIn(b: L.LatLngBounds): Promise<{ list: Customer[]; offline: boolean }> {
  const box = { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() }
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  const south = clamp(box.south, -90, 90), north = clamp(box.north, -90, 90)
  const west = clamp(box.west, -180, 180), east = clamp(box.east, -180, 180)
  try {
    return { list: await customersApi.inArea(south, west, north, east), offline: false }
  } catch (err) {
    const db = currentDb()
    if (!isNetworkError(err) || !db) throw err
    const all = await db.customers.toArray()
    const list = all.filter(
      (c) => c.latitude != null && c.longitude != null && c.latitude >= south && c.latitude <= north && c.longitude >= west && c.longitude <= east,
    )
    return { list, offline: true }
  }
}

export function MapPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const me = useRef<L.CircleMarker | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nearby, setNearby] = useState<NearbyCustomer[] | null>(null)
  const [locating, setLocating] = useState(false)
  const [position, setPosition] = useState<LatLng | null>(null)

  const load = useCallback(async () => {
    if (!map.current || !layer.current) return
    try {
      const { list, offline: off } = await customersIn(map.current.getBounds())
      setError(null)
      setOffline(off)
      setCount(list.length)
      layer.current.clearLayers()
      for (const c of list) {
        const marker = L.circleMarker([c.latitude!, c.longitude!], {
          radius: 8,
          weight: 2,
          color: '#ffffff',
          fillColor: '#1d4ed8',
          fillOpacity: 0.9,
        })
        const popup = document.createElement('div')
        popup.className = 'map-popup'
        const title = document.createElement('strong')
        title.textContent = c.name
        const sub = document.createElement('div')
        sub.textContent = [c.company, c.city].filter(Boolean).join(' · ')
        const open = document.createElement('button')
        open.type = 'button'
        open.className = 'btn'
        open.textContent = t('map.open')
        open.onclick = () => navigate(`/customers/${c.id}`)
        const go = document.createElement('button')
        go.type = 'button'
        go.className = 'btn btn-primary'
        go.textContent = `🧭 ${t('customers.navigate')}`
        go.onclick = () => openDirections({ lat: c.latitude!, lng: c.longitude! })
        const buttons = document.createElement('div')
        buttons.className = 'actions'
        buttons.append(open, go)
        popup.append(title, sub, buttons)
        marker.bindPopup(popup).bindTooltip(c.name)
        marker.addTo(layer.current)
      }
    } catch (err) {
      setError(errorMessage(err, t))
    }
  }, [navigate, t])

  useEffect(() => {
    if (!el.current || map.current) return
    const view = savedView()
    const m = L.map(el.current, { zoomControl: true }).setView(view.center, view.zoom)
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    let timer: ReturnType<typeof setTimeout> | undefined
    m.on('moveend', () => {
      try {
        const c = m.getCenter()
        localStorage.setItem(VIEW_KEY, JSON.stringify({ center: [c.lat, c.lng], zoom: m.getZoom() }))
      } catch {
        /* storage unavailable */
      }
      clearTimeout(timer)
      timer = setTimeout(() => void load(), 250)
    })
    void load()
    return () => {
      clearTimeout(timer)
      m.remove()
      map.current = null
    }
  }, [load])

  async function locateMe() {
    setLocating(true)
    setError(null)
    try {
      const pos = await getCurrentPosition()
      setPosition(pos)
      map.current?.setView([pos.lat, pos.lng], 15)
      me.current?.remove()
      if (map.current) {
        me.current = L.circleMarker([pos.lat, pos.lng], { radius: 9, color: '#ffffff', weight: 3, fillColor: '#16a34a', fillOpacity: 1 })
          .bindTooltip(t('map.you'))
          .addTo(map.current)
      }
      setNearby(await customersApi.nearby(pos.lat, pos.lng, 5).catch(() => null))
    } catch {
      setError(t('customers.locationError'))
    } finally {
      setLocating(false)
    }
  }

  return (
    <section className="map-page">
      <div className="page-header">
        <div>
          <h1>{t('map.title')}</h1>
          <p className="muted">
            {count === null ? t('common.loading') : t('map.inView', { count })}
            {offline && ` · ${t('sync.showingSaved')}`}
          </p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={() => void locateMe()} disabled={locating}>
            📍 {locating ? t('customers.locating') : t('map.nearMe')}
          </button>
        </div>
      </div>
      {error && <p className="alert">{error}</p>}
      <div ref={el} className="map" role="application" aria-label={t('map.title')} />
      {nearby && position && (
        <div className="card">
          <h2>{t('map.nearbyTitle')}</h2>
          {nearby.length === 0 ? (
            <p className="muted">{t('map.noneNearby')}</p>
          ) : (
            <ul className="list">
              {nearby.map(({ customer: c, distanceMeters }) => (
                <li key={c.id}>
                  <div className="grow">
                    <Link to={`/customers/${c.id}`}>
                      <strong>{c.name}</strong>
                    </Link>
                    <div className="muted small">{[c.company, c.addressLine, c.city].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span className="muted">{distanceMeters < 1000 ? `${Math.round(distanceMeters)} m` : `${(distanceMeters / 1000).toFixed(1)} km`}</span>
                  <button type="button" className="btn" onClick={() => openDirections({ lat: c.latitude!, lng: c.longitude! })}>
                    🧭
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
