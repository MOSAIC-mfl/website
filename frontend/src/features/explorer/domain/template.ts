/**
 * Text templates over a record's fields: `{field}` is replaced by the value, with optional filters
 * `{field|int}`, `{field|num}`, `{field|fixed:1}`, `{field|scale:0.1}`, `{field|spaces}`,
 * `{field|date8}` (20190420 -> 2019-04-20), chained left to right. A template whose fields are all
 * missing gives "—". Used by the attribute inspectors and the class charts.
 */
const DASH = '—'

function applyFilter(v: unknown, filter: string): unknown {
  const [name, arg] = filter.split(':')
  const n = typeof v === 'number' ? v : Number(v)
  switch (name) {
    case 'int':
      return Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : v
    case 'num':
      return Number.isFinite(n) ? n.toLocaleString('en-US') : v
    case 'fixed':
      return Number.isFinite(n) ? n.toFixed(Number(arg ?? 0)) : v
    case 'scale':
      return Number.isFinite(n) ? n * Number(arg ?? 1) : v
    case 'spaces':
      return String(v).replaceAll('_', ' ')
    case 'date8': {
      const s = String(v)
      return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s
    }
    default:
      return v
  }
}

/** Fills `{field|filter}` placeholders; DASH when none of the fields has a value. */
export function fillFields(template: string, props: Record<string, unknown>): string {
  let found = 0
  let fields = 0
  const out = template.replace(/\{([\w.]+)((?:\|[\w.:-]+)*)\}/g, (_m, key: string, filters: string) => {
    fields++
    let v: unknown = props[key]
    if (v == null || v === '') return ''
    found++
    for (const f of filters.split('|').filter(Boolean)) v = applyFilter(v, f)
    return String(v)
  })
  return fields > 0 && found === 0 ? DASH : out
}

