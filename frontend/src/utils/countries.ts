// Values of a record's `country` that are not countries: the global and regional
// entries of the catalog's country vocabulary (MOSAIC_catalog/spec/record_schema.json).
// Update both lists together when the vocabulary changes.
export const NON_COUNTRY_VALUES: ReadonlySet<string> = new Set([
  'Global',
  'Africa',
  'Asia',
  'Latin America and the Caribbean',
])

// Number of distinct countries the datasets cover, leaving out global and regional records.
export function countCountries(datasets: ReadonlyArray<{ country?: string | null }>): number {
  return new Set(datasets.map((d) => d.country).filter((c) => c && !NON_COUNTRY_VALUES.has(c))).size
}
