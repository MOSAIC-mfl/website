/**
 * Island of the "Map visualization" panel on the Landscapes page. The explorer's controller (plain
 * DOM) says which landscape to show by setting data-code on the panel's [data-map-embed] element and
 * firing `lx:map-code` on it; an empty code unmounts the map, so only one WebGL map is alive.
 * MapLibre and the explorer still load only when a profile is first shown (MapExplorer is lazy).
 */
import { useEffect, useRef, useState } from 'react'
import { MAP_CODE_EVENT } from './map-events'
import { ProfileMap } from './ProfileMap'

export function ProfileMapPanel({ base }: { base: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [code, setCode] = useState<string | null>(null)
  useEffect(() => {
    const host = ref.current?.closest<HTMLElement>('[data-map-embed]')
    if (!host) return
    const sync = () => setCode(host.dataset.code || null)
    sync()
    host.addEventListener(MAP_CODE_EVENT, sync)
    return () => host.removeEventListener(MAP_CODE_EVENT, sync)
  }, [])
  return <div ref={ref}>{code && <ProfileMap key={code} code={code} base={base} />}</div>
}

export default ProfileMapPanel
