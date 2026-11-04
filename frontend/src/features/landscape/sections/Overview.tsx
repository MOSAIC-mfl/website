/** kind: overview - what the catalogue knows about the landscape at a glance. */
import type { SectionProps } from './types'

export function OverviewSection({ page, base }: SectionProps) {
  const c = page.counts
  const pct = c.datasets ? Math.round((100 * (c.complete ?? 0)) / c.datasets) : 0
  const browse = `${base}/catalogue/?landscape=${encodeURIComponent(page.code)}`
  return (
    <div className="lp-overview">
      <dl className="lp-facts">
        <div>
          <dt>Datasets in the catalogue</dt>
          <dd>{c.datasets ?? 0}</dd>
        </div>
        <div>
          <dt>With complete metadata</dt>
          <dd>
            {c.complete ?? 0} <span className="lp-fact-note">({pct}%)</span>
          </dd>
        </div>
        <div>
          <dt>Countries</dt>
          <dd>{page.countries.join(', ') || '—'}</dd>
        </div>
        <div>
          <dt>Code</dt>
          <dd className="lp-code">{page.code}</dd>
        </div>
      </dl>
      <p className="lp-overview-links">
        <a href={browse}>Browse its datasets in the catalogue &rarr;</a>
      </p>
    </div>
  )
}
