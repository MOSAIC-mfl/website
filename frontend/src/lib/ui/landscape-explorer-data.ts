/**
 * Port + adapter: the live figures of the Landscapes explorer. The explorer's controller depends on
 * ExplorerData only; apiExplorerData() reads mosaic-api through the LandscapeRepository port (static
 * files or the running API, whichever the site is configured for). Answers are cached per page.
 */
import { landscapePages, type LandscapeRepository } from '../catalog'
import { landscapeIndex, landscapeInsights, type LandscapeIndexEntry, type LandscapeInsights } from '../domain/landscape-insights'
import { VOCAB_LABELS } from '../domain/vocab-labels'

export interface ExplorerData {
  /** Dataset count and map profile of every landscape. */
  index(): Promise<Map<string, LandscapeIndexEntry>>
  /** Data coverage of one landscape; null when mosaic-api does not know it. */
  insights(code: string): Promise<LandscapeInsights | null>
}

export function apiExplorerData(
  repo: LandscapeRepository = landscapePages(),
  themeLabels: Record<string, string> = VOCAB_LABELS.theme,
): ExplorerData {
  let index: Promise<Map<string, LandscapeIndexEntry>> | null = null
  const insights = new Map<string, Promise<LandscapeInsights | null>>()
  // a failed request is forgotten, so the next selection asks again
  const remember = <T>(p: Promise<T>, forget: () => void) => p.catch((err: unknown) => { forget(); throw err })
  return {
    index() {
      index ??= remember(repo.landscapes().then(landscapeIndex), () => { index = null })
      return index
    },
    insights(code) {
      let p = insights.get(code)
      if (!p) {
        p = remember(
          repo.landscape(code).then((page) => (page ? landscapeInsights(page.data_status, themeLabels) : null)),
          () => insights.delete(code),
        )
        insights.set(code, p)
      }
      return p
    },
  }
}
