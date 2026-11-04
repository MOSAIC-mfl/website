/**
 * Side panels opened from the rail (and optionally by clicking a map layer). kind 'series-summary':
 * KPIs of a dated series (latest, vs median, record) and its monthly chart - the lake level panel.
 */
import type { Block, PanelContent } from '../domain/blocks'
import type { PanelConfig } from '../domain/config'
import { fillTemplate } from '../domain/legend'
import { Options } from '../domain/options'
import { median, monthlyMeans } from '../domain/series'
import type { ExplorerContext } from '../renderers/types'

export interface SidePanel {
  readonly config: PanelConfig
  heading(): { title: string; subtitle?: string }
  load(ctx: ExplorerContext): Promise<PanelContent>
}

export type PanelFactory = (config: PanelConfig) => SidePanel

type Point = Record<string, unknown>

const seriesSummary: PanelFactory = (config) => {
  const o = new Options(config, `panels.${config.id}`)
  return {
    config,
    heading: () => ({ title: o.optStr('heading') ?? config.title, subtitle: o.optStr('subheading') }),
    async load(ctx) {
      const doc = await ctx.data.json<Record<string, unknown>>(o.str('series'))
      const points = (doc[o.str('points')] ?? []) as Point[]
      const dk = o.str('date')
      const vk = o.str('value')
      const unit = o.optStr('unit') ?? ''
      const d = o.num('decimals', 2)
      const values = points.map((p) => Number(p[vk]))
      const latest = points[points.length - 1]
      const med = median(values)
      const recI = values.indexOf(Math.max(...values))
      const rec = points[recI]
      const stats: Record<string, { value: string; vars: Record<string, string> }> = {
        latest: { value: Number(latest[vk]).toFixed(d), vars: { date: String(latest[dk]) } },
        vs_median: { value: `${Number(latest[vk]) >= med ? '+' : ''}${(Number(latest[vk]) - med).toFixed(d)}`, vars: {} },
        max: { value: Number(rec[vk]).toFixed(d), vars: { month: String(rec[dk]).slice(0, 7), date: String(rec[dk]) } },
      }
      const blocks: Block[] = [
        {
          type: 'kpis',
          items: o.list('summary').map((s, i) => {
            const st = stats[s.str('stat')]
            return { label: fillTemplate(s.str('label'), st.vars), value: st.value, unit, lead: i === 0 }
          }),
        },
      ]
      const c = o.sub('chart')
      if (c) {
        const means = monthlyMeans(points, (p) => String(p[dk]), (p) => Number(p[vk]))
        const keys = means.map(([k]) => k)
        const vals = means.map(([, v]) => +v.toFixed(d))
        const recK = String(rec[dk]).slice(0, 7)
        const cd = c.num('decimals', 1)
        blocks.push({
          type: 'chart',
          title: c.optStr('title'),
          spec: {
            kind: 'line',
            options: {
              labels: keys.map((k) => (k.endsWith('-01') && +k.slice(0, 4) % 5 === 0 ? k.slice(0, 4) : '')),
              series: [{ name: vk.toUpperCase(), values: vals }],
              format: (v) => v.toFixed(cd),
              height: c.num('height', 190),
              min: Math.floor(Math.min(...vals)) - 0.3,
              max: Math.ceil(Math.max(...vals)) + 0.3,
              annotations: c.has('annotate_max')
                ? [{ at: keys.indexOf(recK), label: fillTemplate(c.str('annotate_max'), { value: Number(rec[vk]).toFixed(1) }), short: c.optStr('annotate_max_short') }]
                : [],
              reference: c.optStr('reference') === 'median' ? { value: med, label: 'median' } : undefined,
            },
          },
          meta: o.has('note')
            ? fillTemplate(o.str('note'), {
                n: Number(doc.n ?? points.length).toLocaleString('en-US'),
                first: String(points[0][dk]),
                last: String(latest[dk]),
                source: String(doc.source ?? ''),
                fetched: String(doc.fetched ?? ''),
              })
            : undefined,
        })
      }
      return { title: o.optStr('heading') ?? config.title, hint: o.optStr('subheading'), blocks }
    },
  }
}

export const CORE_PANELS: Record<string, PanelFactory> = { 'series-summary': seriesSummary }
