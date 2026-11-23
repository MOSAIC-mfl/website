// Sentences the site says in more than one place. They are written once here so the copies cannot
// drift apart (the access level once had three wordings).

/** What a living landscape is: the Home section "What is a living landscape?" and the first FAQ entry. */
export const LIVING_LANDSCAPE_IS =
  'a place such as a river basin, a mountain range or a coastal delta, where farms, forests, water and the people who depend on them are looked at together, not one at a time.'

export const sentence = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** Who MOSAIC is for. Home ("Who is MOSAIC for?") lists the first six; About ("Who it serves") sorts
    them into data users and data contributors and adds the focal points. One set of names for both. */
export const AUDIENCE = {
  researchers: 'Researchers',
  institutions: 'Institutions',
  landscapeTeams: 'Landscape teams',
  decisionMakers: 'Decision-makers',
  dataStewards: 'Data stewards',
  funders: 'Funders and partners',
  focalPoints: 'Center focal points',
} as const
