/**
 * The map profile of one landscape (container): reads the profile from mosaic-api and shows its map
 * explorer - map, story and studies. Used twice: inside the "Map visualization" panel of the
 * Landscapes page (embedded) and on its own page, /landscapes/<code>/map/ (full screen).
 */
import { LoadError, Loading } from '../../components/catalogue/LoadState'
import { landscapePages } from '../../lib/catalog'
import { MAP_SECTION } from '../../lib/domain/landscape-insights'
import { useAsync } from '../../lib/ui/useAsync'
import { MapExplorer } from './MapExplorer'
import '../../styles/explorer.css'
import '../../styles/profile-map.css'

export interface ProfileMapProps {
  code: string
  base: string
}

export function ProfileMap({ code, base }: ProfileMapProps) {
  const res = useAsync(() => landscapePages().landscape(code), [code])
  if (res.status === 'loading') return <Loading what="the map profile" />
  if (res.status === 'error') return <LoadError error={res.error} onRetry={res.retry} />
  const page = res.data
  const section = page?.sections.find((s) => s.kind === MAP_SECTION)
  if (!page || !section) {
    return (
      <div className="empty-state">
        <h3>No map profile for this landscape yet</h3>
        <p>
          <a href={`${base}/landscapes#${encodeURIComponent(code)}`}>Back to the landscape overview</a>
        </p>
      </div>
    )
  }
  return <MapExplorer page={page} section={section} base={base} />
}

export default ProfileMap
