/** Small geodesy helpers: no projection library needed for what the explorer reads. */
import type { LngLat } from './format'

/**
 * WGS84 -> UTM (EPSG:326zz north / 327zz south), the CRS of click-query rasters.
 * Transverse Mercator series (Snyder 1987), as in the explorer's toUTM36S; accurate to centimetres
 * inside the zone.
 */
export function toUtm(epsg: number, { lat, lng }: LngLat): [number, number] {
  const north = Math.floor(epsg / 100) === 326
  const zone = epsg % 100
  if (!(north || Math.floor(epsg / 100) === 327) || zone < 1 || zone > 60) throw new Error(`not a UTM EPSG code: ${epsg}`)
  const a = 6378137
  const f = 1 / 298.257223563
  const k0 = 0.9996
  const e2 = f * (2 - f)
  const ep2 = e2 / (1 - e2)
  const phi = (lat * Math.PI) / 180
  const lam = (lng * Math.PI) / 180
  const lam0 = ((zone * 6 - 183) * Math.PI) / 180
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2)
  const T = Math.tan(phi) ** 2
  const C = ep2 * Math.cos(phi) ** 2
  const A = Math.cos(phi) * (lam - lam0)
  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * phi -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi))
  const x = 500000 + k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5) / 120)
  const y =
    (north ? 0 : 10000000) +
    k0 *
      (M +
        N *
          Math.tan(phi) *
          (A ** 2 / 2 + ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 + ((61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6) / 720))
  return [x, y]
}

/** EPSG code from 'EPSG:32736'; 4326 when absent. */
export const epsgOf = (crs: string | undefined): number => (crs ? Number(crs.split(':')[1]) : 4326)

type Ring = number[][]
type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] }

/** Even-odd test on the outer rings (as the explorer's land.js). */
export function pointInPolygon({ lng, lat }: LngLat, geom: Geometry): boolean {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  for (const poly of polys) {
    let inside = false
    const ring = poly[0]
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
    }
    if (inside) return true
  }
  return false
}
