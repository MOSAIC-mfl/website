/**
 * Readiness: the standard's optional `processing_status` (raw, processed, validated), said one way
 * everywhere - the catalogue legend and badges, the dataset page and the Metadata guide. The value
 * is the one the contributor declared when registering the dataset; MOSAIC has not verified it and
 * never infers it, so a record without it (any record of a catalogue that has no such field, such
 * as the Climate Data Hub) reads "Not stated".
 */
import { NOT_SPECIFIED } from './facets'
import { VOCAB_LABELS } from './vocab-labels'

export const READINESS_FACET = 'processing_status'
export const READINESS_ORDER = ['raw', 'processed', 'validated'] as const
export type Readiness = (typeof READINESS_ORDER)[number]

export const NOT_STATED = 'Not stated'

export const READINESS_MEANING: Record<Readiness, string> = {
  raw: 'As supplied by the contributor; not processed.',
  processed: 'Cleaned, reformatted or harmonised by the contributor.',
  validated: 'The contributor reports that it has been quality-checked.',
}

export const READINESS_NOTE =
  'The status is declared by the contributor of each dataset; MOSAIC has not verified it. Records from catalogues without this field show "Not stated".'

export const isReadiness = (v: unknown): v is Readiness => (READINESS_ORDER as readonly unknown[]).includes(v)

export function readinessLabel(value: string | null | undefined): string {
  if (!isReadiness(value)) return NOT_STATED
  return VOCAB_LABELS.processing_status?.[value] ?? value
}

/** Badge class of the approved design (badges.css): raw, processed, validated; neutral when not stated. */
export function readinessBadge(value: string | null | undefined): string {
  return isReadiness(value) ? `badge badge-${value}` : 'badge badge-registered'
}

export function readinessTooltip(value: string | null | undefined): string {
  return isReadiness(value) ? READINESS_MEANING[value] : 'The contributor did not state how far the data has been processed.'
}

/** Order of the readiness filter's options: Raw, Processed, Validated, then Not stated. */
export function readinessRank(value: string): number {
  const i = (READINESS_ORDER as readonly string[]).indexOf(value)
  return i >= 0 ? i : value === NOT_SPECIFIED ? READINESS_ORDER.length : READINESS_ORDER.length + 1
}
