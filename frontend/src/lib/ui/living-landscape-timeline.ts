/**
 * Timeline of the home page's living-landscape animation: the paper illustration builds itself one
 * part at a time, each part of the scene with its medallion, then the dashed arc and the caption,
 * holds on the full picture and loops. Order and timing follow the layer plan of 2026-11-19 (base 0 s,
 * water 1 s, then one part every 1.5 s, arc and caption at 11.5 s, still from 13 s to 15 s); every
 * entry is a soft fade with a short move, 0.4 to 0.6 s.
 * Pure (no DOM): `LivingLandscape.astro` applies the poses. Distances are in pixels of the
 * 1116 x 750 scene. The pieces are cut from the illustration outside this repository
 * (MOSAIC_development/_docs/living-landscape-animation/build in the project folder).
 */

export type Kind = 'slide' | 'pop' | 'wipe' | 'rise' | 'path'

export interface Params {
  dx?: number
  dy?: number
  rot?: number
  /** starting scale of a pop */
  s0?: number
  /** CSS transform-origin */
  origin?: string
  /** path: [dx, dy, rot] waypoints, the piece glides through them to its resting place */
  pts?: [number, number, number][]
}

export interface Cue {
  id: string
  t0: number
  dur: number
  kind: Kind
  p: Params
}

export interface Pose {
  tx: number
  ty: number
  rot: number
  scale: number
  opacity: number
  /** CSS clip-path, empty when none */
  clip: string
}

/** every piece has settled; the still illustration is shown on top from here */
export const SETTLE = 12.8
/** the scene fades back to the empty sky from here */
export const FADE_OUT = 15.0
export const CYCLE = 15.6
/** pieces in the scene from the first frame */
export const ALWAYS = ['sky']

/** The cut was drawn on the 1536 px source; the site uses it at 3/4. */
const S = 0.75

const dash = (n: number): string => 'dash' + String(n).padStart(2, '0')

/** Ids that start with `prefix` and end in a number, in numeric order (river1 … river5). */
function numbered(ids: readonly string[], prefix: string): string[] {
  return ids
    .filter((i) => i.startsWith(prefix) && /^\d+$/.test(i.slice(prefix.length)))
    .sort((a, b) => Number(a.slice(prefix.length)) - Number(b.slice(prefix.length)))
}

export function buildTimeline(ids: readonly string[]): Cue[] {
  const have = new Set(ids)
  const cues: Cue[] = []
  const at = (id: string, t0: number, dur: number, kind: Kind, p: Params = {}): void => {
    if (!have.has(id)) return
    const q: Params = { ...p }
    if (q.dx !== undefined) q.dx *= S
    if (q.dy !== undefined) q.dy *= S
    if (q.pts) q.pts = q.pts.map(([x, y, r]) => [x * S, y * S, r])
    cues.push({ id, t0, dur, kind, p: q })
  }
  /** a part of the landscape: its medallion and label first, the scene follows */
  const medal = (name: string, t: number): void => {
    at('med_' + name, t, 0.5, 'pop', { s0: 0.8 })
    at('label_' + name, t + 0.1, 0.5, 'slide', { dy: 10 })
  }

  // 0 s the base: hills and ground rise into the dome, back to front
  at('m1', 0.0, 0.6, 'slide', { dy: 40 })
  at('m2', 0.15, 0.6, 'slide', { dy: 40 })
  at('m3', 0.3, 0.6, 'slide', { dy: 40 })
  at('ground', 0.45, 0.6, 'slide', { dy: 40 })
  // 1 s water: the river flows in from its far end
  medal('water', 1.0)
  numbered(ids, 'river').forEach((r, k) => at(r, 1.1 + k * 0.08, 0.5, 'slide', { dy: -10 }))
  // 2.5 s forests: the grove grows up from its base
  medal('forests', 2.5)
  at('grove', 2.6, 0.6, 'wipe', { dy: 10 })
  // 4 s biodiversity: grasses, flowers, then the butterfly glides in
  medal('biodiversity', 4.0)
  at('plants', 4.1, 0.5, 'wipe', { dy: 8 })
  numbered(ids, 'flower').forEach((f, k) => at(f, 4.3 + k * 0.06, 0.4, 'pop', { s0: 0.6, origin: '50% 100%' }))
  at('butterfly', 4.5, 0.6, 'path', { pts: [[-90, 30, -12], [-40, 6, 8], [0, 0, 0]] })
  // 5.5 s people and livelihoods: the farmhouse, then the cattle
  medal('people', 5.5)
  at('walls', 5.6, 0.5, 'rise', { dy: 30 })
  at('roofs', 5.75, 0.45, 'slide', { dy: -16 })
  at('cow1', 5.9, 0.5, 'slide', { dx: -30 })
  at('cow2', 5.98, 0.5, 'slide', { dx: 30 })
  // 7 s agriculture: the field, its strips, then the wheat
  medal('agriculture', 7.0)
  at('field', 7.1, 0.5, 'slide', { dx: 40 })
  numbered(ids, 'stripe').forEach((s, k) => at(s, 7.25 + k * 0.05, 0.4, 'slide', { dx: 24 }))
  numbered(ids, 'wheat').forEach((w, k) => at(w, 7.4 + k * 0.03, 0.4, 'pop', { s0: 0.6, origin: '50% 100%' }))
  // 8.5 s land and soils: bottom layer first
  medal('land', 8.5)
  at('soil3', 8.6, 0.45, 'slide', { dy: 24 })
  at('soil2', 8.7, 0.45, 'slide', { dy: 24 })
  at('soil1', 8.8, 0.45, 'slide', { dy: 24 })
  // 10 s climate: the sun rises behind the hills
  medal('climate', 10.0)
  at('sun', 10.1, 0.9, 'slide', { dy: 90 })
  // 11.5 s the dashed arc, one dash after another from water to climate, then the caption
  for (let n = 1; n <= 16; n++) at(dash(n), 11.5 + (n - 1) * 0.04, 0.4, 'pop', { s0: 0.5 })
  at('rule_l', 12.2, 0.5, 'slide', { dx: -24 })
  at('rule_r', 12.2, 0.5, 'slide', { dx: 24 })
  at('caption', 12.25, 0.5, 'slide', { dy: 12 })
  return cues
}

/** ease-out: fast start, soft landing, no overshoot */
const ease = (p: number): number => 1 - (1 - p) ** 3
/** the piece is fully opaque after the first 60 % of its move */
const fadeIn = (p: number): number => {
  const q = Math.min(1, p / 0.6)
  return q * q * (3 - 2 * q)
}

/** Pose of a piece `p` (0…1) of the way through its cue. At p = 1 every kind is at rest. */
export function pose(kind: Kind, prm: Params, p: number): Pose {
  if (p >= 1) return { tx: 0, ty: 0, rot: 0, scale: 1, opacity: 1, clip: '' }
  const e = ease(Math.max(0, p))
  const k = 1 - e
  const out: Pose = { tx: 0, ty: 0, rot: 0, scale: 1, opacity: fadeIn(Math.max(0, p)), clip: '' }
  if (kind === 'slide') {
    out.tx = (prm.dx ?? 0) * k
    out.ty = (prm.dy ?? 0) * k
    out.rot = (prm.rot ?? 0) * k
  } else if (kind === 'pop') {
    const s0 = prm.s0 ?? 0.8
    out.scale = s0 + (1 - s0) * e
    out.rot = (prm.rot ?? 0) * k
  } else if (kind === 'wipe') {
    if (e < 1) out.clip = `inset(${((1 - e) * 100).toFixed(2)}% 0 0 0)`
    out.ty = (prm.dy ?? 0) * k
  } else if (kind === 'rise') {
    out.ty = (prm.dy ?? 0) * k
    if (out.ty > 0) out.clip = `inset(0 0 ${out.ty.toFixed(1)}px 0)`
  } else if (kind === 'path' && prm.pts && prm.pts.length) {
    // glide along the waypoints, eased as a whole
    const n = prm.pts.length - 1
    const x = e * n
    const i = Math.min(n - 1, Math.floor(x))
    const f = n === 0 ? 1 : x - i
    const a = prm.pts[Math.max(0, i)] ?? [0, 0, 0]
    const b = prm.pts[Math.min(n, i + 1)] ?? [0, 0, 0]
    out.tx = a[0] + (b[0] - a[0]) * f
    out.ty = a[1] + (b[1] - a[1]) * f
    out.rot = a[2] + (b[2] - a[2]) * f
  }
  return out
}
