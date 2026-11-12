import { catalogue } from '../../lib/catalog'
import { headline } from '../../lib/domain/stats'
import { useAsync } from '../../lib/ui/useAsync'

/** Date of the most recent harvest of any source, as "12 Nov 2026" (null when unknown). */
export function lastHarvest(sources: { harvested_at?: string | null }[]): string | null {
  const times = sources.map((s) => Date.parse(s.harvested_at ?? '')).filter((t) => !Number.isNaN(t))
  if (times.length === 0) return null
  return new Date(Math.max(...times)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** The figures strip of the catalogue page ("119 datasets · 11 landscapes · 15 countries · Updated …"). */
export function CatalogueStats() {
  const o = useAsync(() => catalogue().overview(), [])
  const h = o.status === 'ok' ? headline(o.data.total, o.data.facets) : null
  const updated = o.status === 'ok' ? lastHarvest(o.data.sources) : null
  const stat = (value: number | undefined, label: string) => (
    <span className="catalogue-stat">
      <span className="catalogue-stat-value">{value ?? '–'}</span>
      <span className="catalogue-stat-label">{label}</span>
    </span>
  )
  return (
    <>
      {stat(h?.resources, 'datasets')}
      {stat(h?.landscapes, 'landscapes')}
      {stat(h?.countries, 'countries')}
      {updated && <span className="catalogue-updated">Updated {updated}</span>}
    </>
  )
}
