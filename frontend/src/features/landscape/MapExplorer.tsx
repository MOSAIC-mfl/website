/** A profile's map explorer (section kind map-explorer). MapLibre and the explorer load only here. */
import { lazy, Suspense, useMemo } from 'react'
import { parseExplorerConfig } from '../explorer/domain/config'
import { readConfig } from '../../lib/config'
import { datasetHref } from '../../lib/domain/present'
import type { LandscapePage, LandscapeSection } from '../../lib/api/types'

const ExplorerApp = lazy(() => import('../explorer/ui/ExplorerApp'))

export function MapExplorer({ page, section, base }: { page: LandscapePage; section: LandscapeSection; base: string }) {
  const parsed = useMemo(() => {
    try {
      return { config: parseExplorerConfig(section.config) }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }, [section.config])
  const override = useMemo(() => {
    const root = readConfig().profileData
    return root ? `${root.replace(/\/+$/, '')}/${page.code}/` : null
  }, [page.code])
  const credits = useMemo(() => (page.credits ?? []).map((c) => ({ name: String(c.name), role: c.role as string | undefined, url: c.url as string | undefined })), [page.credits])
  const recordHref = useMemo(() => (gid: string) => datasetHref(base, gid), [base])
  if ('error' in parsed) return <p className="lp-empty">This explorer cannot be shown: {parsed.error}</p>
  return (
    <Suspense fallback={<div className="lp-explorer-loading">Loading the map…</div>}>
      <ExplorerApp config={parsed.config!} code={page.code} credits={credits} dataOverride={override} recordHref={recordHref} />
    </Suspense>
  )
}
