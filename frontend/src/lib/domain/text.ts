/**
 * Text folding — the SAME rule as mosaic-api `domain/text.py`, so a search gives the same results in
 * the browser (static API) and on the server (live API). Tested with the same cases.
 *
 *  - case-insensitive (toLowerCase after handling ß → ss);
 *  - accent-insensitive (NFKD, combining marks removed; ø æ œ đ ł þ ı transliterated);
 *  - any run of spaces, punctuation or symbols is one separator;
 *  - letters and digits of any script are kept.
 */
const EXTRA: Record<string, string> = { ø: 'o', æ: 'ae', œ: 'oe', đ: 'd', ł: 'l', þ: 'th', ı: 'i', ß: 'ss' }
const COMBINING = /\p{M}+/gu
const SEPARATORS = /[^\p{L}\p{N}]+/gu

export function fold(text: string): string {
  const lower = text.toLowerCase().replace(/[øæœđłþıß]/g, (c) => EXTRA[c] ?? c)
  return lower.normalize('NFKD').replace(COMBINING, '').replace(SEPARATORS, ' ').trim()
}

/** Comparison key for codes and ids: 'CC BY 4.0' → 'cc-by-4-0', 'PER-PCL' → 'per-pcl'. */
export function key(value: string): string {
  return fold(value).replace(/ /g, '-')
}
