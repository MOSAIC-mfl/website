/* The three readiness statuses, said one way everywhere: the catalogue legend,
   the tooltip on each row, the dataset page and the Metadata guide all read
   from here. The status is the one the contributor chose when registering the
   dataset ("Processing status" on the form); MOSAIC has not verified it, and
   no page should say otherwise. */
export const READINESS_ORDER = ['Raw', 'Processed', 'Validated'] as const

export const READINESS_MEANING: Record<string, string> = {
  Raw: 'As supplied by the contributor; not processed.',
  Processed: 'Cleaned, reformatted or harmonised by the contributor.',
  Validated: 'The contributor reports that it has been quality-checked.',
}

export const READINESS_NOTE =
  'The status is declared by the contributor of each dataset; MOSAIC has not verified it.'
