/** Same markup as components/ui/Breadcrumb.astro (its styles are global). */
export function Breadcrumb({ crumbs }: { crumbs: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      <ol className="breadcrumb-list">
        {crumbs.map((c, i) => (
          <li key={i} className="breadcrumb-item">
            {c.href && i < crumbs.length - 1 ? (
              <a href={c.href} className="breadcrumb-link">{c.label}</a>
            ) : (
              <span aria-current="page" className="breadcrumb-current">{c.label}</span>
            )}
            {i < crumbs.length - 1 && (
              <svg aria-hidden="true" focusable="false" width="12" height="12" viewBox="0 0 12 12" fill="none" className="breadcrumb-sep">
                <path d="M4.5 2.5 7.5 6l-3 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
