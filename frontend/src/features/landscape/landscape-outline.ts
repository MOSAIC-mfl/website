/**
 * The MOSAIC living-landscape boundary on a map explorer. An explorer frames a wider area than the
 * landscape (the whole Lake Victoria basin, the whole Ucayali department), so without this line the reader
 * cannot tell which part of the map is the landscape. The geometry is the site's own copy of the canonical
 * boundary (data/landscape_outlines.json, simplified for the locator map), so no profile has to carry it.
 */
import type { ExplorerConfig, StyleLayerSpec } from '../explorer/domain/config'
import outlines from '../../../data/landscape_outlines.json'

const SOURCE = 'mosaic-landscape'
export const OUTLINE_TOGGLE = 'mosaic_landscape'
const INK = '#1C2B3A'

type Ring = [number, number][]

/** The rings of a locator path ('M x y L x y … Z', x = lon + 180, y = 90 − lat) as [lon, lat] lines. */
export function pathRings(d: string): Ring[] {
  const rings: Ring[] = []
  let ring: Ring = []
  for (const m of d.matchAll(/([MLZ])\s*(-?[\d.]+)?[\s,]*(-?[\d.]+)?/gi)) {
    const cmd = m[1].toUpperCase()
    if (cmd === 'Z') {
      if (ring.length) ring.push(ring[0])
      continue
    }
    if (cmd === 'M' && ring.length) {
      rings.push(ring)
      ring = []
    }
    if (m[2] != null && m[3] != null) ring.push([+(Number(m[2]) - 180).toFixed(4), +(90 - Number(m[3])).toFixed(4)])
  }
  if (ring.length) rings.push(ring)
  return rings.filter((r) => r.length > 1)
}

/** The boundary of a landscape as GeoJSON lines, or null when the site has no outline for it. */
export function landscapeLines(code: string): { type: 'FeatureCollection'; features: unknown[] } | null {
  const entry = (outlines.outlines as Record<string, { d?: string }>)[code]
  if (!entry?.d) return null
  const rings = pathRings(entry.d)
  if (!rings.length) return null
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: { code }, geometry: { type: 'MultiLineString', coordinates: rings } }],
  }
}

/**
 * The explorer config with the landscape boundary added: a white halo under a dark dashed line, drawn
 * above the overlays and under the place names, and a switch at the top of the first rail group (on).
 */
export function withLandscapeOutline(config: ExplorerConfig, code: string, name: string): ExplorerConfig {
  const data = landscapeLines(code)
  if (!data || config.toggles.some((t) => t.id === OUTLINE_TOGGLE)) return config
  const layers: StyleLayerSpec[] = [
    {
      id: `${SOURCE}-halo`,
      type: 'line',
      source: SOURCE,
      layout: { 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 4.5, 'line-opacity': 0.85 },
    } as StyleLayerSpec,
    {
      id: `${SOURCE}-line`,
      type: 'line',
      source: SOURCE,
      layout: { 'line-join': 'round' },
      paint: { 'line-color': INK, 'line-width': 2, 'line-dasharray': [3, 1.5] },
    } as StyleLayerSpec,
  ]
  const base = config.map.layers
  const at = base.findIndex((l) => l.id === 'labels-start')
  const mapLayers = at < 0 ? [...base, ...layers] : [...base.slice(0, at), ...layers, ...base.slice(at)]
  return {
    ...config,
    map: { ...config.map, sources: { ...config.map.sources, [SOURCE]: { type: 'geojson', data } }, layers: mapLayers },
    toggles: [
      {
        id: OUTLINE_TOGGLE,
        group: config.groups[0],
        title: 'Landscape boundary',
        swatch: INK,
        attribution: `${name} boundary · MOSAIC`,
        default: true,
        layers: layers.map((l) => l.id),
      },
      ...config.toggles,
    ],
  }
}
