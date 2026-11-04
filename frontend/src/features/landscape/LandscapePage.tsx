/**
 * A landscape page (container): loads the profile and data status from mosaic-api and draws its
 * sections in order, with a section navigation under the page title.
 */
import { LoadError, Loading } from '../../components/catalogue/LoadState'
import { landscapePages } from '../../lib/catalog'
import { useAsync } from '../../lib/ui/useAsync'
import { FULL_WIDTH, sectionModule } from './sections/registry'

const STATUS_NOTE: Record<string, string> = {
  draft: 'Draft profile: its content is under review and may change.',
  review: 'Profile under review.',
}

export function LandscapePage({ code, base }: { code: string; base: string }) {
  const res = useAsync(() => landscapePages().landscape(code), [code])
  if (res.status === 'loading') return <div className="container"><Loading what="the landscape profile" /></div>
  if (res.status === 'error') return <div className="container"><LoadError error={res.error} onRetry={res.retry} /></div>
  const page = res.data
  if (!page) {
    return (
      <div className="container">
        <div className="empty-state">
          <h3>No profile for this landscape yet</h3>
          <p>
            <a href={`${base}/catalogue/?landscape=${encodeURIComponent(code)}`}>Browse its datasets in the catalogue</a>.
          </p>
        </div>
      </div>
    )
  }
  const sections = page.sections.filter((s) => sectionModule(s.kind))
  return (
    <>
      {(page.summary || STATUS_NOTE[page.status]) && (
        <div className="container lp-intro">
          {page.summary && <p className="lp-summary">{page.summary}</p>}
          {STATUS_NOTE[page.status] && <span className="lp-status-note">{STATUS_NOTE[page.status]}</span>}
        </div>
      )}
      <nav className="lp-nav" aria-label="Sections of this page">
        <div className="container lp-nav-inner">
          <ul>
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title ?? s.kind}</a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      {sections.map((s) => {
        const Module = sectionModule(s.kind)!
        const full = FULL_WIDTH.has(s.kind)
        return (
          <section key={s.id} id={s.id} className={`lp-section lp-section--${s.kind}`} aria-labelledby={full ? undefined : `${s.id}-title`}>
            {full ? (
              <Module page={page} section={s} base={base} />
            ) : (
              <div className="container">
                <h2 className="lp-section-title" id={`${s.id}-title`}>
                  {s.title ?? s.kind}
                </h2>
                {s.intro && <p className="lp-section-intro">{s.intro}</p>}
                <Module page={page} section={s} base={base} />
              </div>
            )}
          </section>
        )
      })}
      {(page.credits?.length ?? 0) > 0 && (
        <div className="container lp-credits">
          <p>
            {page.credits!.map((c, i) => (
              <span key={i}>
                {i > 0 && ' · '}
                {c.url ? <a href={String(c.url)}>{String(c.name)}</a> : String(c.name)}
                {c.role ? ` — ${String(c.role)}` : ''}
              </span>
            ))}
          </p>
        </div>
      )}
    </>
  )
}
