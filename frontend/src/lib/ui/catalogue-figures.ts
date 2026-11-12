/**
 * Fills the catalogue figures of a static page (elements with `data-stat="resources|landscapes|countries"`)
 * from mosaic-api when the page opens. Without the API the figures keep their placeholder (a dash) and
 * the rest of the page works.
 */
import { catalogue } from '../catalog'
import { headline } from '../domain/stats'

export async function fillCatalogueFigures(root: ParentNode): Promise<void> {
  try {
    const { total, facets } = await catalogue().overview()
    const figures = headline(total, facets)
    for (const el of root.querySelectorAll<HTMLElement>('[data-stat]')) {
      const value = figures[el.dataset.stat as keyof typeof figures]
      if (value !== undefined) el.textContent = String(value)
    }
  } catch {
    /* figures stay as dashes */
  }
}
