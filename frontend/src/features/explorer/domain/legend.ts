/** What the legend box shows. Renderers build it; the Legend component only draws it. */
import { rampSteps } from './color'
import type { LegendConfig } from './config'

export interface LegendSwitch {
  label: string
  options: { id: string; label: string; disabled?: boolean }[]
  value: string
}

/** A labelled mark on a colour bar; `at` runs from 0 (left end) to 1 (right end). */
export interface LegendTick {
  at: number
  label: string
}

/** A class of a classes legend; rows of one group come together and the first carries the heading. */
export interface LegendRow {
  color: string
  label: string
  group?: string
}

export type LegendModel = {
  title: string
  switch?: LegendSwitch
  notes: string[]
} & (
  | { kind: 'steps'; colors: string[]; axis: [string, string]; ticks?: LegendTick[] }
  | { kind: 'classes'; rows: LegendRow[] }
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
      rows: groupRows(cfg.classes.map((c) => ({ color: c.color ?? (c.rgb ? `rgb(${c.rgb.join(',')})` : '#999'), label: c.name, ...(c.group ? { group: c.group } : {}) }))),
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

/**
 * Rows of one group together, groups in the order they first appear, the profile's order kept inside a
 * group; rows without a group come last (e.g. 'Not observed', which is not a class).
 */
export function groupRows(rows: LegendRow[]): LegendRow[] {
  if (!rows.some((r) => r.group)) return rows
  const order: string[] = []
  for (const r of rows) if (r.group && !order.includes(r.group)) order.push(r.group)
  return [...order.flatMap((g) => rows.filter((r) => r.group === g)), ...rows.filter((r) => !r.group)]
}

/** A continuous legend from a colour ramp. */
export function rampLegend(title: string, ramp: readonly string[], axis: [string, string], notes: string[], ticks?: LegendTick[]): LegendModel {
  return { kind: 'steps', title, colors: rampSteps(ramp), axis, notes, ...(ticks?.length ? { ticks } : {}) }
}

/** Where a value sits on a bar running from lo to hi (0..1), or null outside it. */
export function tickAt(value: number, lo: number, hi: number): number | null {
  if (!(hi > lo)) return null
  const at = (value - lo) / (hi - lo)
  return at > 0 && at < 1 ? at : null
}

export { fill as fillTemplate }
