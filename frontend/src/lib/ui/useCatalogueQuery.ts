import { useEffect, useState } from 'react'
import { emptyQuery, fromSearchParams, toSearchParams, type CatalogueQuery } from '../domain/query'

export const QS_STORAGE_KEY = 'mosaic:catalogue:qs'

/**
 * The catalogue's search state, mirrored in the page URL (shareable, Back button works) and in
 * sessionStorage (the dataset page's "Back to catalogue" restores the same view).
 *
 * The static HTML is rendered without a query, so the first client render also starts empty
 * (no hydration mismatch); the URL state is applied right after, in an effect.
 */
export function useCatalogueQuery(): [CatalogueQuery, (q: CatalogueQuery) => void, boolean] {
  const [query, setQuery] = useState<CatalogueQuery>(emptyQuery)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setQuery(fromSearchParams(new URLSearchParams(window.location.search)))
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    const qs = toSearchParams(query).toString()
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
    try {
      sessionStorage.setItem(QS_STORAGE_KEY, qs)
    } catch {
      /* storage unavailable */
    }
  }, [query, ready])

  return [query, setQuery, ready]
}
