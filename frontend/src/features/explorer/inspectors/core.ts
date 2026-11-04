/**
 * Core inspectors: what a click shows while an overlay is active, configured in the profile
 * (`inspect: {kind: ...}` on the overlay). Profile plugins can register more (profiles/<code>/).
 */
import type { Block, Inspection } from '../domain/blocks'
import { fillTemplate } from '../domain/legend'
import { fmtInt } from '../domain/format'
import { pointInPolygon } from '../domain/geo'
import type { Options } from '../domain/options'
import { median, pick, sum } from '../domain/series'
import type { ExplorerContext, Inspector, InspectorFactory, InspectVars } from '../renderers/types'
import { pixelAt } from './raster-point'
import type { LngLat } from '../domain/format'

/** cell-sum: value of the clicked cell and of the 3×3 block around it (population counts). */
export const cellSum: InspectorFactory = (o: Options): Inspector => ({
  async inspect(ctx, lngLat) {
    const img = await ctx.data.raster(o.str('asset'))
    const px = pixelAt(img, lngLat, o.optStr('crs'))
    if (!px) return null
    const win: [number, number, number, number] = [
      Math.max(px.col - 1, 0),
      Math.max(px.row - 1, 0),
      Math.min(px.col + 2, img.width),
      Math.min(px.row + 2, img.height),
    ]
    const [data] = await img.read(win)
    const width = win[2] - win[0]
    const centre = data[(px.row - win[1]) * width + (px.col - win[0])]
    let block = 0
    for (let i = 0; i < data.length; i++) if (data[i] > 0) block += data[i]
    return {
      target: 'popover',
      title: o.str('title'),
      blocks: [
        { type: 'rows', rows: [[o.str('cell_label'), centre < 0 ? (o.optStr('nodata_text') ?? 'no data') : fmtInt(centre)], [o.str('block_label'), fmtInt(block)]] },
        ...(o.has('note') ? [{ type: 'note' as const, text: o.str('note') }] : []),
      ],
    }
  },
})

interface ClassDef {
  value: number
  name: string
}

/** class-at-point: the class of a categorical raster (one band per year, or a single band). */
export const classAtPoint: InspectorFactory = (o: Options): Inspector => ({
  async inspect(ctx, lngLat, vars) {
    const img = await ctx.data.raster(o.str('asset'))
    const px = pixelAt(img, lngLat, o.optStr('crs'))
    const classes = (o.raw<ClassDef[]>('classes') ?? []) as ClassDef[]
    const year = vars.year ?? o.optStr('year') ?? ''
    let value: number | null = null
    if (px) {
      const years = o.bool('band_per_year') ? (vars.years ?? []) : []
      const sample = years.length ? Math.max(0, years.indexOf(year)) : 0
      value = (await img.read([px.col, px.row, px.col + 1, px.row + 1], [sample]))[0][0]
    }
    const cls = classes.find((c) => c.value === value)
    const items: Block[] = []
    const kpis = [{ label: `Class · ${year}`, value: cls ? cls.name : 'no data', lead: true, size: 20 }]
    const area = o.sub('area_series')
    if (area) {
      const doc = await ctx.data.json(area.str('file'))
      const areas = pick(doc, area.strList('path'), { year }) as Record<string, number> | undefined
      const a = cls && areas ? areas[cls.name] : undefined
      kpis.push({ label: area.str('label'), value: a != null ? `${fmtInt(a)} ${area.optStr('unit') ?? ''}`.trim() : '—', lead: false, size: 18 })
    }
    for (const f of o.list('facts')) kpis.push({ label: f.str('label'), value: f.str('value'), lead: false, size: 15 })
    if (o.has('years_label')) kpis.push({ label: 'Years', value: o.str('years_label'), lead: false, size: 16 })
    items.push({ type: 'kpis', items: kpis })
    if (o.has('note')) items.push({ type: 'note', text: o.str('note') })
    return { target: 'panel', title: fillTemplate(o.str('title'), { place: ctx.place(lngLat) }), hint: o.optStr('hint'), blocks: items }
  },
})

/** annual-series: a basin-wide yearly series with the selected year highlighted. */
export const annualSeries: InspectorFactory = (o: Options): Inspector => ({
  async inspect(ctx, _lngLat, vars) {
    const doc = await ctx.data.json<Record<string, unknown>>(o.str('series'))
    const data = pick(doc, o.strList('path')) as Record<string, number>
    const years = Object.keys(data)
    const values = Object.values(data)
    const y = vars.year ?? years.at(-1) ?? ''
    const unit = o.str('unit')
    const note = o.optStr('note') ?? (o.has('note_field') ? String(doc[o.str('note_field')] ?? '') : '')
    return {
      target: 'panel',
      title: o.str('title'),
      hint: o.optStr('hint'),
      blocks: [
        {
          type: 'kpis',
          items: [
            { label: `${y} · basin`, value: fmtInt(data[y] ?? 0), unit, lead: true },
            { label: 'Median year', value: fmtInt(median(values)), size: 18 },
            { label: 'Record', value: fmtInt(Math.max(...values)), size: 18 },
          ],
        },
        {
          type: 'chart',
          title: o.str('chart_title'),
          spec: {
            kind: 'bars',
            options: {
              labels: years.map((x) => (+x % 5 === 0 ? x : '')),
              values,
              height: 160,
              format: (v) => fmtInt(v),
              highlight: years.indexOf(String(y)),
            },
          },
          meta: note || undefined,
        },
      ],
    }
  },
})

type Polygons = { features: { properties: Record<string, unknown>; geometry: Parameters<typeof pointInPolygon>[1] }[] }

/** region-series: the series of the region under the click (sub-basins), else the whole area. */
export const regionSeries: InspectorFactory = (o: Options): Inspector => {
  let polygons: Promise<Polygons | null> | null = null
  const regionAt = async (ctx: ExplorerContext, lngLat: LngLat): Promise<string> => {
    const fallback = o.str('default_region')
    if (!o.has('polygons')) return fallback
    polygons ??= ctx.data.json<Polygons>(o.str('polygons')).catch(() => null)
    const p = await polygons
    const hit = p?.features.find((f) => pointInPolygon(lngLat, f.geometry))
    return hit ? String(hit.properties.name) : fallback
  }
  return {
    async inspect(ctx, lngLat, vars: InspectVars): Promise<Inspection> {
      const doc = await ctx.data.json<Record<string, unknown>>(o.str('series'))
      const regions = pick(doc, o.strList('regions_path')) as Record<string, Record<string, number>>
      let region = await regionAt(ctx, lngLat)
      if (!regions[region]) region = o.str('default_region')
      const yearly = regions[region]
      const years = Object.keys(yearly)
      const values = years.map((y) => yearly[y])
      const year = vars.year ?? years.at(-1) ?? ''
      const upto = sum(years.filter((y) => +y <= +year).map((y) => yearly[y]))
      const unit = o.str('unit')
      const extra = o.sub('kpi_extra')
      const meta = o.strList('meta_fields').map((f) => String(doc[f] ?? '')).filter(Boolean).join(' · ')
      return {
        target: 'panel',
        title: fillTemplate(o.str('title'), { region }),
        hint: o.optStr('hint'),
        blocks: [
          {
            type: 'kpis',
            items: [
              { label: fillTemplate(o.str('kpi_upto'), { year }), value: fmtInt(upto), unit, lead: true },
              { label: o.str('kpi_total'), value: fmtInt(sum(values)), unit },
              ...(extra ? [{ label: extra.str('label'), value: extra.str('value'), size: 16 }] : []),
            ],
          },
          {
            type: 'chart',
            title: fillTemplate(o.str('chart_title'), { region }),
            spec: {
              kind: 'bars',
              options: {
                labels: years.map((y) => (+y % 5 === 0 ? y : '')),
                values,
                height: 170,
                format: (v) => fmtInt(v),
                highlight: years.indexOf(String(year)),
              },
            },
            meta: meta || undefined,
          },
        ],
      }
    },
  }
}

export const CORE_INSPECTORS: Record<string, InspectorFactory> = {
  'cell-sum': cellSum,
  'class-at-point': classAtPoint,
  'annual-series': annualSeries,
  'region-series': regionSeries,
}
