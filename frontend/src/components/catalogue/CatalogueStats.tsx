import { catalogue } from '../../lib/catalog'
import { headline } from '../../lib/domain/stats'
import { useAsync } from '../../lib/ui/useAsync'

/** The figures strip of the catalogue page ("119 datasets · 11 landscapes · 15 countries"). */
export function CatalogueStats() {
  const o = useAsync(() => catalogue().overview(), [])
  const h = o.status === 'ok' ? headline(o.data.info.totals.resources, o.data.facets) : null
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
    </>
  )
}
