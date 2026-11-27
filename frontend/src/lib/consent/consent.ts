/**
 * Cookie consent, pure logic (2026-11-26). No I/O here: the banner script
 * (components/layout/CookieConsent.astro) reads and writes the browser and calls these.
 *
 * Rules (EU ePrivacy Art. 5(3) as the strictest standard; Google "basic" consent mode):
 * - Google Analytics never loads before the visitor accepts the "analytics" category.
 * - No choice stored, or a choice made under an older CONSENT_VERSION, means: ask again.
 * - Every choice, including a withdrawal, is appended to a local history with the version,
 *   the time (ISO 8601, UTC) and how it was made, so the visitor's own browser holds the
 *   evidence. A static site has no server to keep a central register.
 */

/** GA4 measurement ID (public by design). Empty = analytics off: no banner, nothing loads. */
export const GA_MEASUREMENT_ID = ''

/** Bump with every privacy-notice version that changes cookies; visitors are asked again. */
export const CONSENT_VERSION = '1.1'

export const CONSENT_STORAGE_KEY = 'mosaic.consent'

export type ConsentMethod = 'banner-accept' | 'banner-reject' | 'settings-save'

export interface ConsentDecision {
  version: string
  analytics: boolean
  /** ISO 8601 with time zone (UTC, "Z") */
  at: string
  method: ConsentMethod
  /** page path where the choice was made */
  page: string
}

export interface ConsentState {
  current: ConsentDecision
  history: ConsentDecision[]
}

export const HISTORY_LIMIT = 50

/** Measurement IDs look like G-XXXXXXXXXX; anything else keeps analytics off. */
export function isMeasurementId(id: string): boolean {
  return /^G-[A-Z0-9]{4,16}$/.test(id)
}

function isDecision(v: unknown): v is ConsentDecision {
  if (!v || typeof v !== 'object') return false
  const d = v as Record<string, unknown>
  return typeof d.version === 'string' && typeof d.analytics === 'boolean'
    && typeof d.at === 'string' && typeof d.method === 'string' && typeof d.page === 'string'
}

/** Stored text -> state; anything unreadable counts as "no choice yet". */
export function parseConsent(raw: string | null): ConsentState | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as { current?: unknown; history?: unknown }
    if (!isDecision(v.current)) return null
    const history = Array.isArray(v.history) ? v.history.filter(isDecision) : []
    return { current: v.current, history }
  } catch {
    return null
  }
}

/** Ask when there is no valid choice for the current version. */
export function needsPrompt(state: ConsentState | null, version = CONSENT_VERSION): boolean {
  return !state || state.current.version !== version
}

/** Analytics may load only with an explicit yes under the current version. */
export function analyticsAllowed(state: ConsentState | null, version = CONSENT_VERSION): boolean {
  return !!state && state.current.version === version && state.current.analytics
}

/** New state after a choice; the history keeps every choice (newest last), capped. */
export function recordDecision(
  prev: ConsentState | null,
  choice: { analytics: boolean; method: ConsentMethod; page: string },
  now: Date = new Date(),
  version = CONSENT_VERSION,
): ConsentState {
  const current: ConsentDecision = { version, analytics: choice.analytics, at: now.toISOString(), method: choice.method, page: choice.page }
  const history = [...(prev?.history ?? []), current].slice(-HISTORY_LIMIT)
  return { current, history }
}

/** True when this choice takes back an earlier yes: GA cookies must then be deleted. */
export function isWithdrawal(prev: ConsentState | null, next: ConsentState): boolean {
  return !!prev?.current.analytics && !next.current.analytics
}

/** Names of the GA4 cookies to delete on withdrawal (_ga and _ga_<container id>). */
export function gaCookieNames(cookieHeader: string): string[] {
  return cookieHeader
    .split(';')
    .map((c) => c.split('=')[0].trim())
    .filter((n) => n === '_ga' || n.startsWith('_ga_'))
}
