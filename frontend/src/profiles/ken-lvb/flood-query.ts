/**
 * Lake Victoria profile: what a click shows on the flood layers (the explorer's floodValuesAt and
 * showPopover). The query raster has three bands at 100 m (the maximum of the 20 m cells): years
 * flooded, flood frequency and the share of observations GFM excluded; 255 = no data and, on band 3,
 * 254 = radar look-alike zone (DATA_REPORT §3.1).
 */
import type { Block } from '@/features/explorer/domain/blocks'
import { fmtCoord } from '@/features/explorer/domain/format'
import type { Options } from '@/features/explorer/domain/options'
import { pixelAt } from '@/features/explorer/inspectors/raster-point'
import type { Inspector } from '@/features/explorer/renderers/types'

const NO_DATA = 255
const LOOK_ALIKE = 254

export function floodQuery(o: Options): Inspector {
  return {
    async inspect(ctx, lngLat, vars) {
      const blocks: Block[] = []
      const rows: [string, string][] = [['Place', fmtCoord(lngLat)]]
      let v: { years: number; freq: number; excl: number } | null = null
      try {
        const img = await ctx.data.raster(o.str('asset'))
        const px = pixelAt(img, lngLat, o.optStr('crs'))
        if (px) {
          const [y, f, e] = await img.read([px.col, px.row, px.col + 1, px.row + 1])
          v = { years: y[0], freq: f[0], excl: e[0] }
        }
      } catch {
        v = null
      }
      const notes: string[] = []
      if (v && v.excl === LOOK_ALIKE) {
        notes.push(
          'Not assessed: repeated radar detections over dry grassland with no support in the optical record (JRC GSW); likely radar look-alikes, not flooding. See DATA_REPORT §3.1.',
        )
      } else if (!v || v.years === NO_DATA) {
        rows.push(['Flood record', 'no data (water or outside basin)'])
      } else {
        rows.push(['Years flooded', `up to ${v.years} of 10`])
        rows.push(['Flood frequency', v.freq === NO_DATA ? 'not computed' : `up to ${v.freq} % of valid obs.`])
        if (v.excl !== NO_DATA && v.excl >= 50) {
          rows.push(['Observations excluded', `up to ${v.excl} %`])
          notes.push('Radar sensitivity low here; absence of floods is uncertain.')
        }
      }
      notes.push('Flooded in up to N of 10 years within 100 m (maximum of the 20 m cells). Hazard proxy, not risk.')
      blocks.push({ type: 'rows', rows }, ...notes.map((text) => ({ type: 'note' as const, text })))
      if (o.has('source')) blocks.push({ type: 'note', text: o.str('source') })
      return { target: 'popover', title: vars.overlayTitle, blocks }
    },
  }
}
