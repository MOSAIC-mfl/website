// Sentences the site says in more than one place. They are written once here so the copies cannot
// drift apart (the access level once had three wordings).

/** What a living landscape is: the Home section "What is a living landscape?" and the first FAQ entry. */
export const LIVING_LANDSCAPE_IS =
  'a place such as a river basin, a mountain range or a coastal delta, where farms, forests, water and the people who depend on them are looked at together, not one at a time.'

export const sentence = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
