/**
 * kind: index-grid - a monthly index on the climate grid (SPI-3): one slider over the months, the
 * latest months marked provisional, WMO classes in the click panel. Ported from climate.js.
 */
import type { Block, Inspection } from '../domain/blocks'
import type { LngLat } from '../domain/format'
import { rampLegend, type LegendModel } from '../domain/legend'
import { classify, monthRange, type IndexClass } from '../domain/series'
import { BaseRenderer } from './base'
import { gridData, gridLayer, NODATA, type GridData, type GridMeta } from './grid'
import type { ExplorerContext, OverlayView, TimeControl, TimeInput } from './types'

interface Time {
  month: number | null
}

export class IndexGridRenderer extends BaseRenderer<Time> {
  private meta: GridMeta | null = null

  get timeKey(): string {
    return this.config.id
  }

  private grid(ctx: ExplorerContext): GridData {
    return gridData(ctx, this.o.str('grid'))
  }

  private months(): string[] {
    const m = this.meta?.months_spi3
    return m ? monthRange(m.start, m.n) : []
  }

  private month(time: Time): number {
    const n = this.months().length
    return time.month != null && time.month >= 0 && time.month < n ? time.month : n - 1
  }

  private provisional(i: number): boolean {
    return i >= this.months().length - this.o.num('provisional_months', 0)
  }

  initialTime(): Time {
    return { month: null }
  }

  register(ctx: ExplorerContext): void {
    gridLayer(ctx, this.o.str('grid'), this.config.before)
  }

  async available(ctx: ExplorerContext): Promise<boolean> {
    try {
      this.meta = await this.grid(ctx).meta()
      return !!this.meta.months_spi3
    } catch {
      return false
    }
  }

  async show(ctx: ExplorerContext, view: OverlayView<Time>): Promise<void> {
    const grid = this.grid(ctx)
    const meta = (this.meta ??= await grid.meta())
    const stack = await grid.stack(this.o.str('stack'))
    const band = stack.bands[this.month(view.time)]
    if (!band) return
    const [lo, hi] = this.o.numList('range')
    const scale = this.o.num('scale', 1)
    gridLayer(ctx, this.o.str('grid'), this.config.before).draw(
      meta,
      (i) => (band[i] === NODATA ? null : band[i] * scale),
      lo,
      hi,
      this.o.strList('ramp'),
      null,
    )
  }

  hide(ctx: ExplorerContext): void {
    gridLayer(ctx, this.o.str('grid'), this.config.before).hide()
  }

  legend(): LegendModel | null {
    const months = this.months()
    if (!months.length) return null
    const p = this.o.num('provisional_months', 0)
    const notes = [...this.o.strList('legend_notes')]
    if (p && this.o.has('provisional_note')) {
      notes.push(this.o.str('provisional_note').replace('{from}', months.at(-p)!).replace('{to}', months.at(-1)!))
    }
    notes.push(this.o.str('source'))
    const axis = this.o.strList('axis')
    return rampLegend(this.o.optStr('title_long') ?? this.config.title, this.o.strList('ramp'), [axis[0] ?? '', axis[1] ?? ''], notes)
  }

  timeControl(view: OverlayView<Time>): TimeControl | null {
    const months = this.months()
    if (!months.length) return null
    const m = this.month(view.time)
    const short = this.o.optStr('short') ?? this.config.title
    return {
      segments: [],
      slider: { min: 0, max: months.length - 1, step: 1, value: m },
      caption: { strong: months[m], rest: `${short}${this.provisional(m) ? ' · provisional' : ''}` },
    }
  }

  applyTime(time: Time, input: TimeInput): Time {
    return input.type === 'slider' ? { month: input.value } : time
  }

  presetTime(time: Time, p: Record<string, string | number>): Time {
    if (p.month == null) return time
    const i = this.months().indexOf(String(p.month))
    return i >= 0 ? { month: i } : time
  }

  timeParams(time: Time): Record<string, string> {
    const months = this.months()
    return months.length ? { month: months[this.month(time)] } : {}
  }

  layerIds(): string[] {
    return []
  }

  async inspect(ctx: ExplorerContext, lngLat: LngLat, view: OverlayView<Time>): Promise<Inspection | null> {
    const grid = this.grid(ctx)
    const meta = (this.meta ??= await grid.meta())
    const cell = grid.cellAt(meta, lngLat)
    if (!cell) return null
    const months = this.months()
    const n = months.length
    const m = this.month(view.time)
    const scale = this.o.num('scale', 1)
    const [series, basinDoc, qc] = await Promise.all([
      grid.cellSeries(this.o.str('cells'), cell.index, n),
      ctx.data.json<{ monthly: Record<string, number | null> }>(this.o.str('basin_series')),
      this.o.has('qc') ? grid.stack(this.o.str('qc')) : Promise.resolve(null),
    ])
    const val = (x: number) => (x === NODATA ? null : x * scale)
    const basin = months.map((k) => basinDoc.monthly[k] ?? null)
    const cur = val(series[m])
    const classes = (this.o.raw<IndexClass[]>('classes') ?? []) as IndexClass[]
    const prov = this.provisional(m)
    const short = this.o.optStr('short') ?? this.config.title
    const area = this.o.optStr('area_name') ?? 'basin' // the profile's area (basin, department, ...)
    const Area = area[0].toUpperCase() + area.slice(1)
    const blocks: Block[] = [
      {
        type: 'kpis',
        items: [
          { label: `${short} · ${months[m]}${prov ? ' (provisional)' : ''}`, value: cur == null ? '—' : cur.toFixed(2), sub: cur == null ? '' : classify(cur, classes), lead: true },
          { label: `${Area} mean (land)`, value: basin[m] == null ? '—' : basin[m]!.toFixed(2) },
          { label: 'Calibration', value: this.o.optStr('calibration') ?? meta.normal, size: 16 },
        ],
      },
    ]
    if (qc) {
      // low-rainfall windows: SPI is statistically fragile where the normal 3-month total is small
      const cal = Number(months[m].slice(5)) - 1
      const normalMm = qc.bands[cal][cell.index] / 10
      const q0 = qc.bands[12 + cal][cell.index] / 10
      if (normalMm < 30 || q0 > 20) {
        blocks.push({
          type: 'note',
          tone: 'empty',
          text: `Low-rainfall season here (normal 3-month total ${normalMm.toFixed(0)} mm): SPI values in this window are statistically fragile.`,
        })
      }
    }
    if (prov && this.o.has('provisional_cell_note')) blocks.push({ type: 'pill-note', pill: 'provisional', text: this.o.str('provisional_cell_note') })
    const p = this.o.num('provisional_months', 0)
    const k0 = Math.max(0, n - 180)
    blocks.push({
      type: 'chart',
      title: `Last 15 years, this cell vs ${area} land mean`,
      spec: {
        kind: 'line',
        legend: true,
        options: {
          labels: months.slice(k0).map((k) => (k.endsWith('-01') && +k.slice(0, 4) % 3 === 0 ? k.slice(0, 4) : '')),
          height: 180,
          format: (x) => x.toFixed(1),
          min: -3,
          max: 3,
          series: [
            { name: 'this cell', values: Array.from(series.slice(k0)).map(val) },
            { name: `${area} mean`, values: basin.slice(k0), colour: '#8a8a8a' },
          ],
          today: n - k0 - 1 - p,
          todayLabel: 'provisional',
          tipLabels: months.slice(k0).map((k, i) => k + (k0 + i >= n - p ? ' · provisional' : '')),
        },
      },
      meta: this.o.optStr('cell_method'),
    })
    return { target: 'panel', title: `${short} at ${ctx.place(lngLat)}`, hint: this.o.optStr('cell_source'), blocks }
  }
}
