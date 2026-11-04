/**
 * Shareable state in the URL hash, as the explorer reads it:
 *   #layer=precip&var=tmean&season=ond&mode=anomaly&year=2020&cell=34.5,-0.2&c=34.7,-0.1,9,30&lake=1
 */
import type { Camera } from './config'
import type { LngLat } from './format'

export interface HashState {
  layer?: string
  time: Record<string, string>
  cell?: LngLat
  camera?: Camera
  panel?: string
}

const TIME_KEYS = ['var', 'season', 'mode', 'year', 'month']

export function parseHash(hash: string, panelIds: readonly string[] = []): HashState {
  const h = new URLSearchParams(hash.replace(/^#/, ''))
  const out: HashState = { time: {} }
  const layer = h.get('layer')
  if (layer) out.layer = layer
  for (const k of TIME_KEYS) {
    const v = h.get(k)
    if (v) out.time[k] = v
  }
  const nums = (s: string | null) => (s ? s.split(',').map(Number) : [])
  const [lng, lat] = nums(h.get('cell'))
  if (Number.isFinite(lng) && Number.isFinite(lat)) out.cell = { lng, lat }
  const [cl, ca, z, p] = nums(h.get('c'))
  if (Number.isFinite(cl) && Number.isFinite(ca)) out.camera = { lng: cl, lat: ca, zoom: z || 10, pitch: p ?? 0 }
  const panel = panelIds.find((id) => h.get(id))
  if (panel) out.panel = panel
  return out
}

export function formatHash(s: HashState): string {
  const h = new URLSearchParams()
  if (s.layer) h.set('layer', s.layer)
  for (const [k, v] of Object.entries(s.time)) h.set(k, v)
  if (s.cell) h.set('cell', `${s.cell.lng.toFixed(4)},${s.cell.lat.toFixed(4)}`)
  if (s.panel) h.set(s.panel, '1')
  const text = h.toString()
  return text ? `#${text}` : ''
}
