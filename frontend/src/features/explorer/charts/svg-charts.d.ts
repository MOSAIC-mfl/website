/** Types of the vendored chart module (svg-charts.js). Options as documented in its header. */
export type Format = (v: number) => string | number

export interface Annotation {
  at?: number
  from?: number
  to?: number
  label: string
  short?: string
  colour?: string
}
export interface Reference {
  value: number
  label?: string
  at?: 'left' | 'right'
}
export interface LineSeries {
  name: string
  values: (number | null)[]
  colour?: string
  dash?: boolean
}
export interface LineOptions {
  labels: string[]
  series: LineSeries[]
  format?: Format
  tickFormat?: Format | null
  height?: number
  min?: number
  max?: number
  annotations?: Annotation[]
  reference?: Reference | Reference[]
  today?: number | null
  todayLabel?: string
  yTicks?: number[] | null
  legend?: HTMLElement | string | null
  tipLabels?: string[] | null
}
export interface BarsOptions {
  labels: string[]
  values: number[]
  format?: Format
  tickFormat?: Format | null
  height?: number
  highlight?: number | number[] | null
  annotations?: Annotation[]
  reference?: Reference | Reference[]
  max?: number | null
}

export function line(el: HTMLElement, options: LineOptions): { legend: HTMLUListElement | null }
export function bars(el: HTMLElement, options: BarsOptions): void
export function ticks(min: number, max: number, count?: number): number[]
export const fmt: {
  int: (v: number) => string
  dec: (d: number) => (v: number) => string
  compact: (v: number) => string
}
