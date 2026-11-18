/**
 * Fills the catalogue figures of a static page (elements with `data-stat="resources|landscapes|countries"`)
 * from mosaic-api when the page opens. While loading they show a dash. If the API cannot be reached,
 * the group around them (`[data-stat-group]`) is hidden: a figure that never arrives reads as broken.
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
    for (const g of root.querySelectorAll<HTMLElement>('[data-stat-group]')) g.hidden = true
  }
}
