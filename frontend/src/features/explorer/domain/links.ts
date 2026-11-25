/**
 * Link addresses that come from a profile or a data file are only used when they are web addresses.
 * Anything else (`javascript:`, `data:`, a relative path, plain text) gives undefined, and the caller
 * shows the text without a link.
 */
export function webUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return /^https?:\/\//i.test(text) ? text : undefined
}
