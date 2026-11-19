/**
 * Timeline of the home page's living-landscape animation: the paper illustration builds itself one
 * piece at a time, each part of the scene with its medallion, then holds on the full picture and loops.
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
  /** height of a small hop while sliding */
  hop?: number
  /** ease without the paper bounce (the sun) */
  soft?: boolean
  /** stepped path: [dx, dy, rot] per step, the last one is the resting place */
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
  /** CSS clip-path, empty when none */
  clip: string
}

export const FPS = 12
/** every piece has settled; the still illustration is shown on top from here */
export const SETTLE = 16.4
/** the scene fades back to the empty sky from here */
export const FADE_OUT = 19.0
export const CYCLE = 19.6
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
    if (q.hop !== undefined) q.hop *= S
    if (q.pts) q.pts = q.pts.map(([x, y, r]) => [x * S, y * S, r])
    cues.push({ id, t0, dur, kind, p: q })
  }
  const medal = (name: string, t: number): void => {
    at('med_' + name, t, 0.45, 'pop', { s0: 0.35, rot: -8 })
    at('label_' + name, t + 0.12, 0.4, 'slide', { dy: 14 })
  }
  const dashes = (from: number, to: number, t: number): void => {
    for (let n = from; n <= to; n++) at(dash(n), t + (n - from) * 0.09, 0.22, 'pop', { s0: 0.2, rot: 25 })
  }

  // 1 the hills slide up, back to front
  at('m1', 0.3, 0.8, 'slide', { dy: 150 })
  at('m2', 0.65, 0.8, 'slide', { dy: 170 })
  at('m3', 1.0, 0.8, 'slide', { dy: 180 })
  at('ground', 1.35, 0.8, 'slide', { dy: 220 })
  // 2 water: the river arrives in sections, far end first
  medal('water', 2.35)
  numbered(ids, 'river').forEach((r, k) => at(r, 2.5 + k * 0.22, 0.4, 'slide', { dy: -18, rot: k % 2 ? 1.5 : -1.5 }))
  // 3 forests: the grove is revealed from its base, trunks before treetops
  dashes(1, 4, 3.85)
  medal('forests', 4.25)
  at('grove', 4.35, 1.2, 'wipe', { dy: 16 })
  // 4 biodiversity: grasses, flowers, then the butterfly on a short stepped path
  dashes(5, 6, 5.65)
  medal('biodiversity', 5.85)
  at('plants', 5.95, 0.6, 'wipe', { dy: 10 })
  numbered(ids, 'flower').forEach((f, k) =>
    at(f, 6.35 + k * 0.12, 0.35, 'pop', { s0: 0.2, rot: k % 2 ? 10 : -10, origin: '50% 100%' }),
  )
  at('butterfly', 6.95, 0.9, 'path', { pts: [[-120, 34, -18], [-84, 6, 10], [-52, 26, -12], [-22, -4, 8], [0, 0, 0]] })
  // 5 people and livelihoods: walls, roofs, then the cattle
  dashes(7, 8, 7.95)
  medal('people', 8.15)
  at('walls', 8.3, 0.5, 'rise', { dy: 46 })
  at('roofs', 8.75, 0.4, 'slide', { dy: -30 })
  at('cow1', 9.1, 0.55, 'slide', { dx: -70, hop: 5 })
  at('cow2', 9.3, 0.55, 'slide', { dx: 80, hop: 5 })
  // 6 agriculture: the field, its strips, then the wheat one stalk at a time
  dashes(9, 10, 9.8)
  medal('agriculture', 10.0)
  at('field', 10.1, 0.55, 'slide', { dx: 120 })
  numbered(ids, 'stripe').forEach((s, k) => at(s, 10.5 + k * 0.12, 0.35, 'slide', { dx: 60 }))
  numbered(ids, 'wheat').forEach((w, k) =>
    at(w, 11.0 + k * 0.1, 0.3, 'pop', { s0: 0.1, rot: k % 2 ? 8 : -8, origin: '50% 100%' }),
  )
  // 7 land and soils: bottom layer first
  dashes(11, 12, 12.25)
  medal('land', 12.45)
  at('soil3', 12.55, 0.45, 'slide', { dy: 60 })
  at('soil2', 12.8, 0.45, 'slide', { dy: 70 })
  at('soil1', 13.05, 0.45, 'slide', { dy: 80 })
  // 8 climate: the sun rises behind the hills
  dashes(13, 16, 13.55)
  medal('climate', 13.95)
  at('sun', 14.0, 1.1, 'slide', { dy: 120, soft: true })
  // the caption and its two rules
  at('rule_l', 15.35, 0.4, 'slide', { dx: -46 })
  at('rule_r', 15.35, 0.4, 'slide', { dx: 46 })
  at('caption', 15.5, 0.45, 'slide', { dy: 22 })
  return cues
}

const C1 = 1.25
const C3 = C1 + 1
/** ease-out with a small overshoot: the paper bounce */
const back = (p: number): number => 1 + C3 * (p - 1) ** 3 + C1 * (p - 1) ** 2
const cubic = (p: number): number => 1 - (1 - p) ** 3

/** Pose of a piece `p` (0…1) of the way through its cue. At p = 1 every kind is at rest. */
export function pose(kind: Kind, prm: Params, p: number): Pose {
  if (p >= 1) return { tx: 0, ty: 0, rot: 0, scale: 1, clip: '' }
  const e = prm.soft ? cubic(p) : back(p)
  const k = 1 - e
  const out: Pose = { tx: 0, ty: 0, rot: 0, scale: 1, clip: '' }
  if (kind === 'slide') {
    out.tx = (prm.dx ?? 0) * k
    out.ty = (prm.dy ?? 0) * k - (prm.hop ? prm.hop * Math.sin(Math.PI * Math.min(p, 1)) : 0)
    out.rot = (prm.rot ?? 0) * k
  } else if (kind === 'pop') {
    const s0 = prm.s0 ?? 0.4
    out.scale = s0 + (1 - s0) * e
    out.rot = (prm.rot ?? 0) * k
  } else if (kind === 'wipe') {
    const r = (1 - Math.cos(Math.PI * p)) / 2
    if (r < 1) out.clip = `inset(${((1 - r) * 100).toFixed(2)}% 0 0 0)`
    out.ty = (prm.dy ?? 0) * k
  } else if (kind === 'rise') {
    out.ty = (prm.dy ?? 0) * k
    if (out.ty > 0) out.clip = `inset(0 0 ${out.ty.toFixed(1)}px 0)`
  } else if (kind === 'path' && prm.pts && prm.pts.length) {
    const n = prm.pts.length
    const step = prm.pts[Math.min(n - 1, Math.floor(p * n))] ?? [0, 0, 0]
    ;[out.tx, out.ty, out.rot] = step
  }
  return out
}
