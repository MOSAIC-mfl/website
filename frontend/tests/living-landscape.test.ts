import { describe, expect, it } from 'vitest'
import manifest from '../src/components/home/living-landscape-pieces.json'
import { CYCLE, FADE_OUT, SCHEDULE, SETTLE, buildTimeline, pose } from '../src/lib/ui/living-landscape-timeline'

const ids = manifest.pieces.map((p) => p.id)
const cues = buildTimeline(ids)

describe('living-landscape animation timeline', () => {
  it('gives every layer a place on the timeline, once', () => {
    const placed = cues.map((c) => c.id)
    expect(new Set(placed).size).toBe(placed.length)
    expect([...placed].sort()).toEqual([...ids].sort())
  })

  it('brings the layers in the planned order: base, the seven parts, then the arc', () => {
    expect(cues.map((c) => c.id)).toEqual(SCHEDULE.map(([id]) => id))
    const starts = cues.map((c) => c.t0)
    expect(starts).toEqual([...starts].sort((a, b) => a - b))
    expect(cues.at(-1)?.id).toBe('arc')
  })

  it('settles every layer before the still is shown, and holds at least two seconds', () => {
    for (const c of cues) expect(c.t0 + c.dur).toBeLessThanOrEqual(SETTLE)
    expect(FADE_OUT - SETTLE).toBeGreaterThanOrEqual(2)
    expect(CYCLE).toBeGreaterThan(FADE_OUT)
  })

  it('starts each layer hidden and ends it at rest', () => {
    for (const c of cues) {
      expect(pose(c, 0).opacity).toBe(0)
      expect(pose(c, 1)).toEqual({ ty: 0, opacity: 1 })
    }
  })
})
