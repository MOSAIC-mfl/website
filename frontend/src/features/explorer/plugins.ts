/**
 * Profile plugins: code a profile needs beyond the core modules (a click handler for its own data
 * format, a renderer for a new kind of layer, ...). Each plugin is loaded only on its landscape page.
 * To add one: create src/profiles/<code>/index.ts exporting a ProfilePlugin and list it here.
 */
import type { ModuleRegistry } from './renderers/registry'

export type ProfilePlugin = (registry: ModuleRegistry) => void

const PLUGINS: Record<string, () => Promise<{ default: ProfilePlugin }>> = {
  'KEN-LVB': () => import('@/profiles/ken-lvb'),
}

export async function applyPlugin(code: string, registry: ModuleRegistry): Promise<void> {
  const load = PLUGINS[code.toUpperCase()]
  if (load) (await load()).default(registry)
}
