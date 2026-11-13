/** Text formats shared by panels and popovers. */
export interface LngLat {
  lng: number
  lat: number
}

export const fmtCoord = ({ lat, lng }: LngLat): string =>
  `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? 'E' : 'W'}`

export const fmtInt = (v: number): string => Math.round(v).toLocaleString('en-US')

export const fmtFixed = (v: number | null | undefined, d: number): string => (v == null ? '—' : v.toFixed(d))

export const signed = (v: number, d: number): string => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`
