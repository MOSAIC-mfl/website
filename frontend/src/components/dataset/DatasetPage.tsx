/**
 * Dataset page (container): reads one record from mosaic-api (/catalogue/dataset/?id=<source>:<id>)
 * and lays it out as the approved design - a header, four sections shown one at a time as tabs, and
 * a side column. Each section is its own presentational component; the words come from ./view.
 */
import { useCallback, useEffect, useState } from 'react'
import { catalogue, landscapePages } from '../../lib/catalog'
import { useAsync } from '../../lib/ui/useAsync'
import { QS_STORAGE_KEY } from '../../lib/ui/useCatalogueQuery'
import { LoadError, Loading } from '../catalogue/LoadState'
import { AccessSection } from './AccessSection'
import { Breadcrumb } from './Breadcrumb'
import { CitationSection } from './CitationSection'
import { DatasetHeader } from './DatasetHeader'
import { DatasetSide } from './DatasetSide'
import { OverviewSection } from './OverviewSection'
import { TechnicalSection } from './TechnicalSection'

export const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'access', label: 'Access & use' },
  { id: 'technical', label: 'Technical metadata' },
  { id: 'citation', label: 'Citation & contacts' },
] as const
type SectionId = (typeof SECTIONS)[number]['id']

const sectionOf = (hash: string): SectionId => (SECTIONS.find((s) => s.id === hash.slice(1))?.id ?? 'overview')

/** The section in the address (#access), so a section can be linked and Back steps through them. */
function useSection(): [SectionId, (id: SectionId) => void] {
  const [section, setSection] = useState<SectionId>(() => (typeof location === 'undefined' ? 'overview' : sectionOf(location.hash)))
  useEffect(() => {
    const onPop = () => setSection(sectionOf(location.hash))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const go = useCallback((id: SectionId) => {
    history.pushState(null, '', `#${id}`)
    setSection(id)
    const nav = document.querySelector('.dp-nav')
    const top = nav?.getBoundingClientRect().top ?? 0
    if (nav && (top < 0 || top > window.innerHeight * 0.6)) window.scrollTo({ top: top + window.scrollY - 88 })
  }, [])
  return [section, go]
}

function backToCatalogue(base: string): string {
  try {
    const qs = sessionStorage.getItem(QS_STORAGE_KEY)
    if (qs) return `${base}/catalogue?${qs}`
  } catch {
    /* storage unavailable */
  }
  return `${base}/catalogue`
}

export function DatasetPage({ base }: { base: string }) {
  const id = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('id') ?? ''
  const repo = catalogue()
  const [section, go] = useSection()
  const state = useAsync(async () => {
    const [detail, overview, landscapes] = await Promise.all([
      repo.get(id),
      repo.overview(),
      landscapePages().landscapes().catch(() => []),
    ])
    const related = detail ? await repo.related(detail, 4) : []
    const landscapeBoxes = Object.fromEntries(landscapes.map((l) => [l.code, l.bbox]))
    return { detail, labels: overview.labels, related, landscapeBoxes }
  }, [repo, id])

  // every link on the page that points at a section (#access, …) switches to it
  const onClick = (e: React.MouseEvent) => {
    const a = (e.target as Element).closest?.('a[href^="#"]')
    const target = a?.getAttribute('href')?.slice(1)
    const s = SECTIONS.find((x) => x.id === target)
    if (!s) return
    e.preventDefault()
    go(s.id)
  }

  if (state.status === 'loading') return <div className="container dp"><Loading what="the dataset" /></div>
  if (state.status === 'error') return <div className="container dp"><LoadError error={state.error} onRetry={state.retry} /></div>
  const { detail: d, labels, related, landscapeBoxes } = state.data
  if (!d) {
    return (
      <div className="container dp">
        <div className="empty-state">
          <h3>Dataset not found</h3>
          <p>No dataset has the id “{id}”.</p>
          <a className="empty-state-clear" href={`${base}/catalogue`}>Back to catalogue</a>
        </div>
      </div>
    )
  }
  const title = d.record.title ?? d.local_id
  if (typeof document !== 'undefined') document.title = `${title} | MOSAIC`
  const jsonUrl = repo.recordLink(d)

  return (
    <div className="container dp is-tabbed" onClick={onClick}>
      <Breadcrumb crumbs={[{ label: 'Home', href: `${base}/` }, { label: 'Catalogue', href: `${base}/catalogue` }, { label: title }]} />
      <DatasetHeader d={d} labels={labels} base={base} jsonUrl={jsonUrl} />

      <nav className="dp-nav" aria-label="Sections of this record">
        <ul>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} aria-current={s.id === section ? 'true' : undefined}>{s.label}</a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="dp-layout">
        <div className="dp-main">
          {section === 'overview' && <OverviewSection d={d} labels={labels} />}
          {section === 'access' && <AccessSection d={d} labels={labels} />}
          {section === 'technical' && <TechnicalSection d={d} labels={labels} jsonUrl={jsonUrl} landscapeBoxes={landscapeBoxes} />}
          {section === 'citation' && <CitationSection d={d} base={base} />}
        </div>
        <DatasetSide d={d} labels={labels} base={base} related={related} />
      </div>

      <a className="dp-small dp-back" href={backToCatalogue(base)}>&larr; Back to the catalogue</a>
    </div>
  )
}
