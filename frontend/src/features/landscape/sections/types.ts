/**
 * A landscape page is an ordered list of sections. Each section kind is a module registered in
 * registry.ts; a profile names the kinds it wants (mosaic-catalog: landscapes/<CODE>/profile.yaml).
 */
import type { ComponentType } from 'react'
import type { LandscapePage, LandscapeSection } from '../../../lib/api/types'

export interface SectionProps {
  page: LandscapePage
  section: LandscapeSection
  base: string
}

export type SectionModule = ComponentType<SectionProps>
