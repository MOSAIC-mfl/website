import type { ResourceDetail, ResourceSummary } from '../api/types'
import { NOT_SPECIFIED } from '../domain/facets'

/** Same landscape scores 2, same theme 1 (as on the previous website); the resource itself is left out. */
export function rankRelated(detail: ResourceDetail, candidates: ResourceSummary[], limit: number): ResourceSummary[] {
  const landscapes = new Set(detail.landscapes)
  const themes = new Set(detail.facets.theme?.filter((t) => t !== NOT_SPECIFIED) ?? [])
  return candidates
    .filter((r) => r.id !== detail.id)
    .map((r) => ({
      r,
      score: (r.landscapes.some((l) => landscapes.has(l)) ? 2 : 0) + (r.themes.some((t) => themes.has(t)) ? 1 : 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.r.title.localeCompare(b.r.title))
    .slice(0, limit)
    .map((x) => x.r)
}
