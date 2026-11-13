/** What the legend box shows. Renderers build it; the Legend component only draws it. */
import { rampSteps } from './color'
import type { LegendConfig } from './config'

export interface LegendSwitch {
  label: string
  options: { id: string; label: string; disabled?: boolean }[]
  value: string
}

export type LegendModel = {
  title: string
  switch?: LegendSwitch
  notes: string[]
} & (
  | { kind: 'steps'; colors: string[]; axis: [string, string] }
  | { kind: 'classes'; rows: { color: string; label: string }[] }
)

const fill = (text: string, vars: Record<string, string | number>): string =>
  text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))

/** A legend written in the profile, with {year}-style placeholders filled. */
export function legendFrom(cfg: LegendConfig, vars: Record<string, string | number> = {}, extraNotes: string[] = []): LegendModel {
  const notes = [...(cfg.notes ?? []), ...(cfg.source ? [cfg.source] : []), ...extraNotes].map((n) => fill(n, vars))
  if (cfg.kind === 'classes') {
    return {
      kind: 'classes',
      title: fill(cfg.title, vars),
      notes,
      rows: cfg.classes.map((c) => ({ color: c.color ?? (c.rgb ? `rgb(${c.rgb.join(',')})` : '#999'), label: c.name })),
    }
  }
  return {
    kind: 'steps',
    title: fill(cfg.title, vars),
    notes,
    colors: cfg.colors,
    axis: [cfg.labels[0] ?? '', cfg.labels[1] ?? ''],
  }
}

/** A continuous legend from a colour ramp. */
export function rampLegend(title: string, ramp: readonly string[], axis: [string, string], notes: string[]): LegendModel {
  return { kind: 'steps', title, colors: rampSteps(ramp), axis, notes }
}

export { fill as fillTemplate }
