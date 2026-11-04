/**
 * Charts declared in a profile (story chapters): `builder` names how a series file becomes a chart.
 * Open for extension: a profile plugin can register more builders (registry.ts).
 */
import type { Annotation } from '../charts/svg-charts'
import type { Block, ChartSpec } from '../domain/blocks'
import { Options } from '../domain/options'
import { monthlyMeans, pick, seasonalTotals, sum, yearLabels } from '../domain/series'
import type { DataSource } from '../ports/data'

export type ChartBuilder = (o: Options, data: DataSource) => Promise<Block[]>

const fmt = (decimals: number, unit?: string) => (v: number) => `${v.toFixed(decimals)}${unit ? ` ${unit}` : ''}`

/** Annotations written with keys of the series ('2019', '2024-05') instead of indices. */
function annotations(o: Options, keys: string[], values: number[], format: (v: number) => string): Annotation[] {
  const at = (k: unknown) => keys.indexOf(String(k))
  return o.list('annotations').flatMap((a): Annotation[] => {
    const label = a.str('label')
    if (a.has('from')) {
      const from = at(a.raw('from'))
      const to = at(a.raw('to'))
      return from < 0 || to < 0 ? [] : [{ from, to, label, short: a.optStr('short') }]
    }
    const i = at(a.raw('at'))
    return i < 0 ? [] : [{ at: i, label: label.replace('{value}', format(values[i]).replace(/ \S+$/, '')), short: a.optStr('short') }]
  })
}

const chart = (title: string | undefined, spec: ChartSpec): Block => ({ type: 'chart', title, spec })

const seasonalTotal: ChartBuilder = async (o, data) => {
  const doc = await data.json(o.str('series'))
  const monthly = pick(doc, o.strList('path')) as Record<string, number | null>
  const rows = seasonalTotals(monthly, o.numList('months'))
  const keys = rows.map(([y]) => y)
  const decimals = o.num('decimals', 0)
  const values = rows.map(([, v]) => +v.toFixed(decimals))
  const [n0, n1] = o.numList('normal')
  const inNormal = rows.filter(([y]) => +y >= n0 && +y <= n1)
  const format = fmt(decimals, o.optStr('unit'))
  const spec: ChartSpec = {
    kind: 'line',
    options: {
      labels: yearLabels(keys),
      series: [{ name: o.optStr('series_name') ?? 'value', values }],
      format,
      tickFormat: (v) => Math.round(v),
      height: o.num('height', 150),
      annotations: annotations(o, keys, values, format),
      reference: inNormal.length
        ? { value: Math.round(sum(inNormal.map(([, v]) => v)) / inNormal.length), label: o.optStr('reference_label') ?? 'normal' }
        : undefined,
    },
  }
  return [chart(o.optStr('title'), spec)]
}

const monthlyMean: ChartBuilder = async (o, data) => {
  const doc = await data.json(o.str('series'))
  const points = (pick(doc, [o.str('points')]) ?? []) as Record<string, unknown>[]
  const dateKey = o.str('date')
  const valueKey = o.str('value')
  const means = monthlyMeans(points, (p) => String(p[dateKey]), (p) => Number(p[valueKey]))
  const keys = means.map(([k]) => k)
  const decimals = o.num('decimals', 2)
  const values = means.map(([, v]) => +v.toFixed(decimals))
  const format = fmt(decimals, o.optStr('unit'))
  const spec: ChartSpec = {
    kind: 'line',
    options: {
      labels: yearLabels(keys),
      series: [{ name: o.optStr('series_name') ?? 'value', values }],
      format,
      tickFormat: (v) => Math.round(v),
      height: o.num('height', 160),
      ...(o.bool('round_range') ? { min: Math.floor(Math.min(...values)), max: Math.ceil(Math.max(...values)) } : {}),
      annotations: annotations(o, keys, values, format),
    },
  }
  return [chart(o.optStr('title'), spec)]
}

const monthly: ChartBuilder = async (o, data) => {
  const doc = await data.json(o.str('series'))
  const series = pick(doc, o.strList('path')) as Record<string, number | null>
  const keys = Object.keys(series).sort()
  const values = keys.map((k) => series[k])
  const decimals = o.num('decimals', 2)
  const p = o.num('provisional', 0)
  const ref = o.sub('reference')
  const spec: ChartSpec = {
    kind: 'line',
    options: {
      labels: yearLabels(keys),
      series: [{ name: o.optStr('series_name') ?? 'value', values }],
      format: (v) => v.toFixed(decimals),
      tickFormat: (v) => v,
      height: o.num('height', 150),
      ...(o.has('min') ? { min: o.num('min') } : {}),
      ...(o.has('max') ? { max: o.num('max') } : {}),
      ...(p ? { today: keys.length - 1 - p, todayLabel: 'provisional', tipLabels: keys.map((k, i) => k + (i >= keys.length - p ? ' · provisional' : '')) } : {}),
      yTicks: o.has('y_ticks') ? o.numList('y_ticks') : null,
      annotations: annotations(o, keys, values.map((v) => v ?? NaN), (v) => v.toFixed(decimals)),
      reference: ref ? { value: ref.num('value'), label: ref.optStr('label') } : undefined,
    },
  }
  return [chart(o.optStr('title'), spec)]
}

const annualBars: ChartBuilder = async (o, data) => {
  const doc = await data.json(o.str('series'))
  const byYear = pick(doc, o.strList('path')) as Record<string, number>
  const years = Object.keys(byYear).sort()
  const values = years.map((y) => byYear[y])
  const decimals = o.num('decimals', 0)
  const unit = o.optStr('unit')
  const blocks: Block[] = [
    chart(o.optStr('title'), {
      kind: 'bars',
      options: {
        labels: years.map((y) => (+y % 5 === 0 ? y : '')),
        values,
        height: o.num('height', 140),
        format: (v) => `${Math.round(v).toLocaleString('en-US')}${unit ? ` ${unit}` : ''}`,
        highlight: o.has('highlight') ? years.indexOf(o.str('highlight')) : null,
        annotations: annotations(o, years, values, (v) => v.toFixed(decimals)),
      },
    }),
  ]
  const m = o.sub('multiples')
  if (m) {
    const regions = pick(doc, m.strList('path')) as Record<string, Record<string, number>>
    const names = m.strList('names').filter((n) => regions[n])
    const top = Math.max(...names.flatMap((n) => Object.values(regions[n])))
    const md = m.num('decimals', 1)
    const show = new Set(m.strList('label_years'))
    blocks.push({
      type: 'multiples',
      title: m.str('title'),
      items: names.map((n) => ({
        title: n,
        total: `${Math.round(sum(Object.values(regions[n]))).toLocaleString('en-US')}${unit ? ` ${unit}` : ''}`,
        spec: {
          kind: 'bars',
          options: {
            labels: years.map((y) => (show.has(y) ? y : '')),
            values: years.map((y) => regions[n][y]),
            height: m.num('height', 78),
            format: (v) => `${v.toFixed(md)}${unit ? ` ${unit}` : ''}`,
            max: top,
            tickFormat: (v) => String(v),
            annotations: annotations(m, years, [], String),
          },
        },
      })),
    })
  }
  return blocks
}

export const CORE_CHART_BUILDERS: Record<string, ChartBuilder> = {
  'seasonal-total': seasonalTotal,
  'monthly-mean': monthlyMean,
  monthly,
  'annual-bars': annualBars,
}
