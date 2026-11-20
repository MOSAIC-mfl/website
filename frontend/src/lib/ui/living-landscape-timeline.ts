/**
 * Timeline of the home page's living-landscape animation: the paper illustration builds itself layer
 * by layer — sky, mountains, hills and ground, then each part of the landscape with its medallion,
 * then the dashed arc and the caption — holds on the full picture and loops.
 * Layers and timing are Lizeth's layer set for the transition (capas-completas-transicion,
 * 2026-11-20): every layer is whole (what other layers hide is drawn too), and each one comes in with
 * a soft fade and a short rise from below.
 * Pure (no DOM): `LivingLandscape.astro` applies the poses. Distances are in pixels of the 1116 x 750
 * scene. The layers are exported by MOSAIC_development/_docs/living-landscape-animation/build/
 * export_layers_site.py in the project folder, outside this repository.
 */

export interface Cue {
  id: string
  t0: number
  dur: number
  /** the layer rises this many pixels into place */
  rise: number
}

export interface Pose {
  ty: number
  opacity: number
}

/** each layer's entry, in seconds */
export const ENTRY = 0.5
/** layer id → start time, in order of entry */
export const SCHEDULE: readonly (readonly [string, number])[] = [
  ['sky', 0.0],
  ['mountain_cream', 0.5],
  ['mountains_teal', 1.0],
  ['hills', 1.5],
  ['ground', 2.0],
  ['water', 3.0],
  ['forests', 4.5],
  ['biodiversity', 6.0],
  ['people', 7.5],
  ['agriculture', 9.0],
  ['soils', 10.5],
  ['climate', 12.0],
  ['arc', 13.0],
]
/** every layer has settled; the still illustration is shown on top from here */
export const SETTLE = 13.5
/** the scene fades out from here, after a two-second hold */
export const FADE_OUT = 15.5
export const CYCLE = 16.1

export function buildTimeline(ids: readonly string[]): Cue[] {
  const have = new Set(ids)
  return SCHEDULE.filter(([id]) => have.has(id)).map(([id, t0]) => ({ id, t0, dur: ENTRY, rise: 8 }))
}

/** ease-out: fast start, soft landing, no overshoot */
const ease = (p: number): number => 1 - (1 - p) ** 3

/** Pose of a layer `p` (0…1) of the way through its entry. At p = 1 it is at rest. */
export function pose(cue: Cue, p: number): Pose {
  if (p >= 1) return { ty: 0, opacity: 1 }
  const q = Math.max(0, p)
  return { ty: cue.rise * (1 - ease(q)), opacity: Math.min(1, q / 0.8) }
}
