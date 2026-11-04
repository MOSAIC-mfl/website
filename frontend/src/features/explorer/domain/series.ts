/** Series arithmetic used by panels and story charts (pure). */

export const median = (values: readonly number[]): number => {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

export const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0)

/** Monthly means of dated points: {'2020-05': mean, ...} in date order. */
export function monthlyMeans<T>(points: readonly T[], date: (p: T) => string, value: (p: T) => number): [string, number][] {
  const acc = new Map<string, { s: number; n: number }>()
  for (const p of points) {
    const k = date(p).slice(0, 7)
    const m = acc.get(k) ?? { s: 0, n: 0 }
    m.s += value(p)
    m.n += 1
    acc.set(k, m)
  }
  return [...acc.keys()].sort().map((k) => [k, acc.get(k)!.s / acc.get(k)!.n])
}

/** Labels that keep only round years ('2020' every `step` years); the rest empty. */
export const yearLabels = (keys: readonly (string | number)[], step = 5): string[] =>
  keys.map((k) => {
    const s = String(k)
    const y = +s.slice(0, 4)
    return y % step === 0 && (s.length === 4 || s.endsWith('-01')) ? s.slice(0, 4) : ''
  })

/** Months 'YYYY-MM' from a start month, n of them. */
export function monthRange(start: string, n: number): string[] {
  const [y, m] = start.split('-').map(Number)
  return Array.from({ length: n }, (_, i) => {
    const t = y * 12 + (m - 1) + i
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
  })
}

/** Totals over some months of each year (e.g. Oct-Dec rains), only for complete years. */
export function seasonalTotals(monthly: Record<string, number | null>, months: readonly number[]): [string, number][] {
  const years = [...new Set(Object.keys(monthly).map((k) => k.slice(0, 4)))].sort()
  const out: [string, number][] = []
  for (const y of years) {
    const vals = months.map((m) => monthly[`${y}-${String(m).padStart(2, '0')}`])
    if (vals.every((v) => typeof v === 'number' && Number.isFinite(v))) out.push([y, sum(vals as number[])])
  }
  return out
}

export interface IndexClass {
  max?: number
  below?: number
  label: string
}

/** Class of an index value: the first class whose `max` (<=) or `below` (<) holds. */
export const classify = (v: number, classes: readonly IndexClass[]): string =>
  classes.find((c) => (c.max != null ? v <= c.max : c.below != null ? v < c.below : true))?.label ?? ''

/** Read a nested value: path ['areas', '{year}', 'Basin'] with {placeholders} filled. */
export function pick(doc: unknown, path: readonly string[], vars: Record<string, string | number> = {}): unknown {
  let node: unknown = doc
  for (const raw of path) {
    const k = raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m))
    node = node && typeof node === 'object' ? (node as Record<string, unknown>)[k] : undefined
  }
  return node
}
