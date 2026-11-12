/**
 * Mounts the map profile into a plain DOM element. The Landscapes explorer is not a React island;
 * its controller loads this module (and React, MapLibre) only when "Map visualization" is opened.
 */
import { createRoot } from 'react-dom/client'
import { ProfileMap } from './ProfileMap'

/** Returns a function that unmounts the profile. */
export function mountProfileMap(el: HTMLElement, code: string, base: string): () => void {
  const root = createRoot(el)
  root.render(<ProfileMap code={code} base={base} />)
  return () => root.unmount()
}
