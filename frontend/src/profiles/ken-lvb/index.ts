/**
 * Plugin of the Lake Victoria Basin profile: the modules only this profile needs. Everything else in
 * its explorer is configuration (mosaic-catalog: landscapes/KEN-LVB/explorer.yaml) drawn by the core
 * modules.
 */
import type { ProfilePlugin } from '@/features/explorer/plugins'
import { floodQuery } from './flood-query'

const plugin: ProfilePlugin = (registry) => {
  registry.registerInspector('flood-query', floodQuery)
}

export default plugin
