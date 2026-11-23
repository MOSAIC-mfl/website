/** Text formats shared by panels and popovers. */
export interface LngLat {
  lng: number
  lat: number
}

export const fmtCoord = ({ lat, lng }: LngLat): string =>
  `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? 'E' : 'W'}`

export const fmtInt = (v: number): string => Math.round(v).toLocaleString('en-US')

export const fmtFixed = (v: number | null | undefined, d: number): string => (v == null ? '—' : v.toFixed(d))

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** '2026-09-14' → '14 Sep 2026', '2024-05' → 'May 2024'; anything else is returned as it came. */
export function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(iso)
  if (!m) return iso
  const month = MONTHS_SHORT[Number(m[2]) - 1]
  if (!month) return iso
  return m[3] ? `${Number(m[3])} ${month} ${m[1]}` : `${month} ${m[1]}`
}

/** Axis ticks without a needless '.0': 1138 → '1,138', 2.5 → '2.5'. */
export const fmtTick = (v: number): string => v.toLocaleString('en-US', { maximumFractionDigits: 2 })

export const signed = (v: number, d: number): string => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`
