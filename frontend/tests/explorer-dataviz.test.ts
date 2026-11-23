/**
 * Map explorer readability rules from the 2026-11-23 chart review: dates and ticks people can read,
 * marks on legend bars, and the MOSAIC landscape boundary added to an explorer.
 */
import { describe, expect, it } from 'vitest'
import lvb from './fixtures-landscape-ken-lvb.json'
import { parseExplorerConfig } from '../src/features/explorer/domain/config'
import { fmtDate, fmtTick } from '../src/features/explorer/domain/format'
import { rampLegend, tickAt } from '../src/features/explorer/domain/legend'
import { landscapeLines, OUTLINE_TOGGLE, pathRings, withLandscapeOutline } from '../src/features/landscape/landscape-outline'

const section = (lvb as { sections: { kind: string; config?: unknown }[] }).sections.find((s) => s.kind === 'map-explorer')!

describe('formats', () => {
  it('writes ISO dates the way people read them', () => {
    expect(fmtDate('2026-09-14')).toBe('14 Sep 2026')
    expect(fmtDate('2024-05')).toBe('May 2024')
    expect(fmtDate('not a date')).toBe('not a date')
  })

  it('drops needless decimals from axis ticks', () => {
    expect(fmtTick(1138)).toBe('1,138')
    expect(fmtTick(2.5)).toBe('2.5')
  })
})

describe('legend marks', () => {
  it('places a value on the bar, and nothing at or beyond its ends', () => {
    expect(tickAt(100, 70, 130)).toBe(0.5)
    expect(tickAt(70, 70, 130)).toBeNull()
    expect(tickAt(5, 0, 0)).toBeNull()
  })

  it('keeps ticks only when there are some', () => {
    expect(rampLegend('t', ['#000', '#fff'], ['0', '1'], [])).not.toHaveProperty('ticks')
    expect(rampLegend('t', ['#000', '#fff'], ['0', '1'], [], [{ at: 0.5, label: 'mid' }])).toMatchObject({ ticks: [{ at: 0.5, label: 'mid' }] })
  })
})

describe('landscape boundary', () => {
  it('reads a locator path back to longitude and latitude', () => {
    expect(pathRings('M215 90L216 89L216 91Z')).toEqual([
      [
        [35, 0],
        [36, 1],
        [36, -1],
        [35, 0],
      ],
    ])
  })

  it('has a boundary for each map-explorer landscape', () => {
    for (const code of ['KEN-LVB', 'PER-PCL']) expect(landscapeLines(code)?.features).toHaveLength(1)
    expect(landscapeLines('NOPE-XX')).toBeNull()
  })

  it('adds the boundary above the overlays, under the labels, switched on at the top of the rail', () => {
    const config = parseExplorerConfig(section.config)
    const out = withLandscapeOutline(config, 'KEN-LVB', 'Lake Victoria Basin (Kenya)')
    expect(out.toggles[0]).toMatchObject({ id: OUTLINE_TOGGLE, group: config.groups[0], default: true })
    const ids = out.map.layers.map((l) => l.id)
    const line = ids.indexOf('mosaic-landscape-line')
    expect(line).toBeGreaterThan(ids.indexOf('dim'))
    expect(line).toBeLessThan(ids.indexOf('labels-start'))
    expect(out.map.sources['mosaic-landscape']).toBeDefined()
    // applied twice, it adds nothing
    expect(withLandscapeOutline(out, 'KEN-LVB', 'x').toggles.filter((t) => t.id === OUTLINE_TOGGLE)).toHaveLength(1)
  })
})
