import type { RecordDetail, RecordSummary } from '../api/types'
import { NOT_SPECIFIED } from '../domain/facets'

/**
 * As on the previous website: same landscape scores 2, same theme 1, ties in catalogue order (by id).
 * A landscape a record only covers by its bounding box (derived, e.g. a continental CDH layer) scores
 * 1, so records that name the landscape come first; records of the same catalogue come before others.
 * The resource itself is left out.
 */
export function rankRelated(detail: RecordDetail, candidates: RecordSummary[], limit: number): RecordSummary[] {
  const landscapes = new Set(detail.landscapes)
  const themes = new Set(detail.facets.theme?.filter((t) => t !== NOT_SPECIFIED) ?? [])
  const place = (r: RecordSummary) => (r.landscapes.some((l) => landscapes.has(l)) ? (r.landscapes_derived ? 1 : 2) : 0)
  return candidates
    .filter((r) => r.id !== detail.id)
    .map((r) => ({ r, score: place(r) + (r.themes.some((t) => themes.has(t)) ? 1 : 0) }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.r.source === detail.source) - Number(a.r.source === detail.source) ||
        a.r.id.localeCompare(b.r.id),
    )
    .slice(0, limit)
    .map((x) => x.r)
}
