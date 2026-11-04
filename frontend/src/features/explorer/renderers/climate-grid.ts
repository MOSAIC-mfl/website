/**
 * kind: climate-grid - yearly and seasonal climate stacks (precipitation, temperature): a time bar
 * with variable, season, value/anomaly and year, and a click panel with the cell's months against
 * the normal. Ported from the explorer's climate.js; the texts come from the profile.
 *
 * Every climate-grid overlay shares one time state (`timeKey: 'climate'`): switching from
 * precipitation to temperature keeps the season, the mode and the year, as in the explorer.
 */
import type { Block, Inspection } from '../domain/blocks'
import type { LngLat } from '../domain/format'
import { fmtInt, signed } from '../domain/format'
import { rampLegend, type LegendModel } from '../domain/legend'
import type { Options } from '../domain/options'
import { BaseRenderer } from './base'
import { gridData, gridLayer, NODATA, WATER, type GridData, type GridMeta } from './grid'
import type { ExplorerContext, OverlayView, Segment, TimeControl, TimeInput } from './types'

export interface ClimateTime {
  v: string
  season: string
  mode: 'value' | 'anomaly'
  year: number | null
}

interface Variable {
  id: string
  label: string
  title: string
  cells: string
  normals?: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SEASON_MONTHS: Record<string, number[]> = { annual: [], mam: [2, 3, 4], ond: [9, 10, 11] }
const seasonName = (s: string) => (s === 'annual' ? 'annual' : s.toUpperCase())

export class ClimateGridRenderer extends BaseRenderer<ClimateTime> {
  readonly timeKey = 'climate'
  private meta: GridMeta | null = null

  private grid(ctx: ExplorerContext): GridData {
    return gridData(ctx, this.o.str('grid'))
  }

  private variables(): Variable[] {
    const single = this.o.list('variables').length === 1
    const overlayNormals = this.o.sub('anomaly')?.optStr('normals')
    return this.o.list('variables').map((v: Options) => ({
      id: v.str('id'),
      label: v.optStr('label') ?? v.str('id'),
      title: v.optStr('title') ?? v.str('id'),
      cells: v.str('cells'),
      normals: v.optStr('normals') ?? (single ? overlayNormals : undefined),
    }))
  }

  private variable(time: ClimateTime): Variable {
    const vars = this.variables()
    return vars.find((v) => v.id === time.v) ?? vars[0]
  }

  private seasons(): string[] {
    const s = this.o.strList('seasons')
    return s.length ? s : ['annual', 'mam', 'ond']
  }

  initialTime(): ClimateTime {
    return { v: this.variables()[0].id, season: 'annual', mode: 'value', year: null }
  }

  /** the time adjusted to this overlay (its variables, years, whether it has an anomaly) */
  private normalize(time: ClimateTime): ClimateTime {
    const v = this.variable(time)
    const season = this.seasons().includes(time.season) ? time.season : 'annual'
    const mode = time.mode === 'anomaly' && v.normals ? 'anomaly' : 'value'
    const years = this.meta?.years[`${v.id}_${season}`] ?? []
    const year = time.year != null && years.includes(time.year) ? time.year : (years.at(-1) ?? time.year)
    return { v: v.id, season, mode, year }
  }

  register(ctx: ExplorerContext): void {
    gridLayer(ctx, this.o.str('grid'), this.config.before)
  }

  async available(ctx: ExplorerContext): Promise<boolean> {
    try {
      this.meta = await this.grid(ctx).meta()
      return true
    } catch {
      return false
    }
  }

  async show(ctx: ExplorerContext, view: OverlayView<ClimateTime>): Promise<void> {
    const grid = this.grid(ctx)
    const meta = (this.meta ??= await grid.meta())
    const t = this.normalize(view.time)
    const v = this.variable(t)
    const key = `${v.id}_${t.season}`
    const years = meta.years[key] ?? []
    const [stack, normal, water] = await Promise.all([
      grid.stack(`${key}.tif`),
      t.mode === 'anomaly' && v.normals ? grid.normal(`${v.normals}_${t.season}`) : Promise.resolve(null),
      grid.landmask(),
    ])
    const band = stack.bands[years.indexOf(t.year ?? -1)]
    if (!band) return
    const { lo, hi, ramp } = this.display(meta, t)
    const scale = meta.scale
    const ratio = this.o.sub('anomaly')?.optStr('kind') === 'ratio'
    gridLayer(ctx, this.o.str('grid'), this.config.before).draw(
      meta,
      (i) => {
        const raw = band[i]
        if (raw === NODATA) return null
        const value = raw * scale
        if (!normal) return value
        const n = normal[i]
        if (n === NODATA) return null
        return ratio ? (100 * value) / (n * scale) : value - n * scale
      },
      lo,
      hi,
      ramp,
      water,
    )
  }

  hide(ctx: ExplorerContext): void {
    gridLayer(ctx, this.o.str('grid'), this.config.before).hide()
  }

  private display(meta: GridMeta, t: ClimateTime): { lo: number; hi: number; ramp: string[]; label: string } {
    const units = this.o.str('units')
    if (t.mode === 'anomaly') {
      const a = this.o.sub('anomaly')!
      const r = meta.ranges[`${t.v}_${t.season}_anom`] ?? [0, 1]
      const c = a.num('centre', 0)
      const d = Math.max(Math.abs(r[0] - c), Math.abs(r[1] - c))
      return { lo: c - d, hi: c + d, ramp: a.strList('ramp'), label: `${a.str('units')} (${meta.normal})` }
    }
    const r = meta.ranges[`${t.v}_${t.season}`] ?? [0, 1]
    return { lo: r[0], hi: r[1], ramp: this.o.strList('ramp'), label: `${units} · ${seasonName(t.season)} ${this.o.str('aggregate')}` }
  }

  legend(view: OverlayView<ClimateTime>): LegendModel | null {
    if (!this.meta) return null
    const t = this.normalize(view.time)
    const { lo, hi, ramp, label } = this.display(this.meta, t)
    const note = `${this.o.str('source')} · 0.05° (~5.5 km)${this.o.has('water_note') ? ` · ${this.o.str('water_note')}` : ''}`
    return rampLegend(`${this.variable(t).title} — ${label}`, ramp, [lo.toFixed(0), hi.toFixed(0)], [note])
  }

  timeControl(view: OverlayView<ClimateTime>): TimeControl | null {
    if (!this.meta) return null
    const t = this.normalize(view.time)
    const vars = this.variables()
    const years = this.meta.years[`${t.v}_${t.season}`] ?? []
    const segments: Segment[] = [
      { id: 'v', label: 'Variable', value: t.v, hidden: vars.length < 2, options: vars.map((v) => ({ value: v.id, label: v.label })) },
      {
        id: 'season',
        label: 'Season',
        value: t.season,
        options: this.seasons().map((s) => ({ value: s, label: s === 'annual' ? 'Annual' : s.toUpperCase() })),
      },
      {
        id: 'mode',
        label: 'Mode',
        value: t.mode,
        options: [
          { value: 'value', label: 'Value' },
          { value: 'anomaly', label: 'Anomaly', disabled: !this.variable(t).normals },
        ],
      },
    ]
    return {
      segments,
      slider: { min: years[0] ?? 0, max: years.at(-1) ?? 0, step: 1, value: t.year ?? 0 },
      caption: { strong: String(t.year ?? ''), rest: `${seasonName(t.season)} ${this.o.str('aggregate')}` },
    }
  }

  applyTime(time: ClimateTime, input: TimeInput): ClimateTime {
    const t = this.normalize(time)
    if (input.type === 'slider') return { ...t, year: input.value }
    if (input.id === 'v') return this.normalize({ ...t, v: input.value })
    if (input.id === 'season') return this.normalize({ ...t, season: input.value })
    if (input.id === 'mode') return this.normalize({ ...t, mode: input.value === 'anomaly' ? 'anomaly' : 'value' })
    return t
  }

  presetTime(time: ClimateTime, p: Record<string, string | number>): ClimateTime {
    return {
      v: p.var != null ? String(p.var) : time.v,
      season: p.season != null ? String(p.season) : time.season,
      mode: p.mode === 'anomaly' ? 'anomaly' : p.mode === 'value' ? 'value' : time.mode,
      year: p.year != null ? Number(p.year) : time.year,
    }
  }

  timeParams(time: ClimateTime): Record<string, string> {
    const t = this.normalize(time)
    return { var: t.v, season: t.season, mode: t.mode, ...(t.year != null ? { year: String(t.year) } : {}) }
  }

  layerIds(): string[] {
    return []
  }

  async inspect(ctx: ExplorerContext, lngLat: LngLat, view: OverlayView<ClimateTime>): Promise<Inspection | null> {
    const grid = this.grid(ctx)
    const meta = (this.meta ??= await grid.meta())
    const cell = grid.cellAt(meta, lngLat)
    if (!cell) return null
    const t = this.normalize(view.time)
    const v = this.variable(t)
    const seriesVar = this.variables().find((x) => x.cells === v.cells && x.normals) ?? v
    const n = Number(meta.months[`n_${seriesVar.id}`] ?? 0)
    const y0 = Number(String(meta.months.start).slice(0, 4))
    const series = await grid.cellSeries(v.cells, cell.index, n)
    const scale = meta.scale
    const val = (x: number) => (x === NODATA ? null : x * scale)
    const monthsOf = (y: number) => Array.from(series.slice((y - y0) * 12, (y - y0) * 12 + 12))
    const total = this.o.str('aggregate') === 'total'
    const agg = (vals: number[]) => {
      const idx = SEASON_MONTHS[t.season] ?? []
      const sel = (idx.length ? vals.filter((_, i) => idx.includes(i)) : vals).map(val)
      if (sel.some((x) => x == null)) return null
      const s = (sel as number[]).reduce((a, b) => a + b, 0)
      return total ? s : s / sel.length
    }
    const [n0, n1] = meta.normal.split('-').map(Number)
    const normalYears: (number | null)[] = []
    for (let y = n0; y <= n1; y++) normalYears.push(agg(monthsOf(y)))
    const yearVal = t.year != null ? agg(monthsOf(t.year)) : null
    const normal = normalYears.every((x) => x != null) ? (normalYears as number[]).reduce((a, b) => a + b, 0) / normalYears.length : null
    const unit = this.o.str('units')
    const fmtV = (x: number | null) => (x == null ? '—' : total ? fmtInt(x) : x.toFixed(1))
    const anomaly = this.o.sub('anomaly')
    const ratio = anomaly?.optStr('kind') === 'ratio'
    const anomTxt =
      yearVal != null && normal != null
        ? ratio
          ? `${Math.round((100 * yearVal) / normal)} % of normal`
          : `${signed(yearVal - normal, 1)} ${anomaly?.optStr('units') ?? unit}`
        : '—'
    const water = (await grid.landmask())[cell.index] === WATER
    const blocks: Block[] = [
      {
        type: 'kpis',
        items: [
          { label: `${seasonName(t.season)} ${this.o.str('aggregate')} · ${t.year}`, value: fmtV(yearVal), unit, lead: true },
          { label: `Normal ${meta.normal}`, value: fmtV(normal), unit },
          { label: 'This year', value: anomTxt, size: 18 },
        ],
      },
    ]
    if (water && this.o.has('water_cell_note')) blocks.push({ type: 'note', tone: 'empty', text: this.o.str('water_cell_note') })
    if (seriesVar.id !== v.id) {
      blocks.push({ type: 'note', text: `The series below shows ${seriesVar.title}; the map shows ${v.title}.` })
    }
    const normMon = MONTHS.map((_, m) => {
      let s = 0
      let k = 0
      for (let y = n0; y <= n1; y++) {
        const x = val(monthsOf(y)[m])
        if (x != null) {
          s += x
          k++
        }
      }
      return k ? +(s / k).toFixed(1) : null
    })
    const lastYear = y0 + Math.floor((n - 1) / 12)
    blocks.push({
      type: 'chart',
      title: `${t.year} by month vs the ${meta.normal} monthly normal (${unit})`,
      spec: {
        kind: 'line',
        legend: true,
        options: {
          labels: MONTHS,
          height: 180,
          format: (x) => (total ? Math.round(x) : x.toFixed(1)),
          series: [
            { name: String(t.year), values: t.year != null ? monthsOf(t.year).map(val) : [] },
            { name: `normal ${meta.normal}`, values: normMon, colour: '#8a8a8a', dash: true },
          ],
        },
      },
      meta: `${this.o.str('source')}, 0.05° cell · monthly series ${y0}–${lastYear}`,
    })
    return { target: 'panel', title: `${v.title} at ${ctx.place(lngLat)}`, hint: this.o.str('source'), blocks }
  }
}
