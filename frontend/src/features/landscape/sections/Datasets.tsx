/** kind: catalogue-datasets - the catalogue's datasets for the landscape, with the catalogue's cards. */
import { DatasetGrid } from '../../../components/catalogue/DatasetGrid'
import { LoadError, Loading } from '../../../components/catalogue/LoadState'
import { catalogue } from '../../../lib/catalog'
import { useAsync } from '../../../lib/ui/useAsync'
import type { SectionProps } from './types'

const SHOWN = 6

export function DatasetsSection({ page, base }: SectionProps) {
  const repo = catalogue()
  const res = useAsync(
    async () => {
      const [overview, result] = await Promise.all([
        repo.overview(),
        repo.search({ text: '', filters: { landscape: [page.code] }, sort: 'recent', page: 1, pageSize: SHOWN }),
      ])
      return { labels: overview.labels, result }
    },
    [page.code],
  )
  if (res.status === 'loading') return <Loading />
  if (res.status === 'error') return <LoadError error={res.error} onRetry={res.retry} />
  const { labels, result } = res.data
  const all = `${base}/catalogue/?landscape=${encodeURIComponent(page.code)}`
  return (
    <div className="catalogue-page lp-datasets">
      <DatasetGrid datasets={result.items} base={base} labels={labels} />
      {result.total > result.items.length && (
        <p className="lp-more">
          <a href={all}>
            See all {result.total} datasets of {page.label} in the catalogue &rarr;
          </a>
        </p>
      )}
    </div>
  )
}
