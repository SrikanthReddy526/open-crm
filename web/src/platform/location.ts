import { isAndroid, isIOS } from '.'

export interface LatLng {
  lat: number
  lng: number
}

/**
 * Current GPS position. Browsers only allow this on HTTPS or localhost;
 * the Capacitor app is always allowed (after the user grants permission).
 */
export function getCurrentPosition(timeoutMs = 15_000): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    )
  })
}

export function mapUrl({ lat, lng }: LatLng): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`
}

/** OpenStreetMap directions; the start point is left empty for the user (or browser) to fill. */
export function directionsUrl({ lat, lng }: LatLng): string {
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(`;${lat},${lng}`)}`
}

/**
 * "Navigate" button.
 * - Android: geo: link → lets the user pick any installed maps app (OsmAnd, Organic Maps, Google Maps…)
 * - iOS: Apple Maps directions
 * - Desktop: OpenStreetMap directions in a new tab
 */
export function openDirections(target: LatLng): void {
  const { lat, lng } = target
  if (isAndroid) {
    window.location.href = `geo:${lat},${lng}?q=${lat},${lng}`
  } else if (isIOS) {
    window.location.href = `https://maps.apple.com/?daddr=${lat},${lng}`
  } else {
    window.open(directionsUrl(target), '_blank', 'noopener')
  }
}
