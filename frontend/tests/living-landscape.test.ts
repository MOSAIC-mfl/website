import { describe, expect, it } from 'vitest'
import manifest from '../src/components/home/living-landscape-pieces.json'
import { ALWAYS, CYCLE, FADE_OUT, SETTLE, buildTimeline, pose } from '../src/lib/ui/living-landscape-timeline'

const ids = manifest.pieces.map((p) => p.id)
const cues = buildTimeline(ids)

describe('living-landscape animation timeline', () => {
  it('gives every piece a place on the timeline, once', () => {
    const placed = cues.map((c) => c.id)
    expect(new Set(placed).size).toBe(placed.length)
    expect([...placed, ...ALWAYS].sort()).toEqual([...ids].sort())
  })

  it('settles every piece before the still is shown, and holds at least two seconds', () => {
    for (const c of cues) expect(c.t0 + c.dur).toBeLessThanOrEqual(SETTLE)
    expect(FADE_OUT - SETTLE).toBeGreaterThanOrEqual(2)
    expect(CYCLE).toBeGreaterThan(FADE_OUT)
  })

  it('brings each medallion in with its label', () => {
    for (const name of ['water', 'forests', 'biodiversity', 'people', 'agriculture', 'land', 'climate']) {
      const med = cues.find((c) => c.id === `med_${name}`)
      const label = cues.find((c) => c.id === `label_${name}`)
      expect(med && label && Math.abs(med.t0 - label.t0) < 0.5).toBe(true)
    }
  })

  it('ends every kind of move at rest', () => {
    for (const c of cues) {
      const q = pose(c.kind, c.p, 1)
      expect([q.tx, q.ty, q.rot, q.scale, q.opacity, q.clip]).toEqual([0, 0, 0, 1, 1, ''])
    }
  })

  it('brings each part in with a soft entry of 0.4 to 0.6 s, starting transparent', () => {
    for (const c of cues) {
      expect(c.dur).toBeGreaterThanOrEqual(0.4)
      expect(c.dur).toBeLessThanOrEqual(0.9) // the sun rises a little slower
      expect(pose(c.kind, c.p, 0).opacity).toBe(0)
    }
  })

  it('follows the layer plan: base, water, forests, biodiversity, people, agriculture, land, climate, arc', () => {
    const start = (id: string): number => cues.find((c) => c.id === id)?.t0 ?? NaN
    const order = ['ground', 'med_water', 'med_forests', 'med_biodiversity', 'med_people', 'med_agriculture', 'med_land', 'med_climate', 'dash01', 'caption']
    const times = order.map(start)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(start('dash16')).toBeLessThan(start('caption'))
  })
})
