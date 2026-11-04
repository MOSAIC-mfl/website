/**
 * What panels, popovers and story chapters show, as data. Inspectors and panels build blocks;
 * React components draw them (ui/Blocks.tsx). Keeps HTML out of the logic: no innerHTML anywhere.
 */
import type { BarsOptions, LineOptions } from '../charts/svg-charts'

export type ChartSpec = { kind: 'line'; options: Omit<LineOptions, 'legend'>; legend?: boolean } | { kind: 'bars'; options: BarsOptions }

export interface Kpi {
  label: string
  value: string
  unit?: string
  sub?: string
  /** first and larger cell of the strip */
  lead?: boolean
  /** smaller value text (a name, a range) */
  size?: number
}

export type Block =
  | { type: 'kpis'; items: Kpi[] }
  | { type: 'chart'; title?: string; spec: ChartSpec; meta?: string }
  | { type: 'multiples'; title: string; items: { title: string; total: string; spec: ChartSpec }[] }
  | { type: 'rows'; rows: [string, string][] }
  | { type: 'note'; text: string; tone?: 'meta' | 'empty' | 'caveat' }
  | { type: 'pill-note'; pill: string; text: string }

export interface PanelContent {
  title: string
  hint?: string
  blocks: Block[]
}

/** A click result: a small popover at the click point, or the side panel. */
export type Inspection = ({ target: 'popover' } | { target: 'panel' }) & PanelContent
