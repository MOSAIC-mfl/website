/**
 * Runtime configuration, from PUBLIC_* environment variables (see .env.example).
 *
 * PUBLIC_MOSAIC_API_URL   where the API lives
 * PUBLIC_MOSAIC_API_MODE  'static' = the files mosaic-api exports to GitHub Pages (search runs in the
 *                         browser); 'live' = a running `python -m mosaic_api serve` (search on the server)
 * PUBLIC_MOSAIC_PROFILE_DATA  (development) a local folder serving the map explorers' data files; when
 *                         set, a landscape explorer reads every file from <folder>/<CODE>/
 */
export type ApiMode = 'static' | 'live'

export interface AppConfig {
  apiUrl: string
  apiMode: ApiMode
  /** development only: serve every explorer data file from this folder (PUBLIC_MOSAIC_PROFILE_DATA) */
  profileData: string | null
}

const DEFAULT_API_URL = 'https://mosaic-mfl.github.io/mosaic-api'

export function readConfig(env: Record<string, string | undefined> = import.meta.env): AppConfig {
  const mode = (env.PUBLIC_MOSAIC_API_MODE ?? 'static').trim().toLowerCase()
  if (mode !== 'static' && mode !== 'live') {
    throw new Error(`PUBLIC_MOSAIC_API_MODE must be 'static' or 'live', got '${mode}'`)
  }
  const apiUrl = (env.PUBLIC_MOSAIC_API_URL ?? DEFAULT_API_URL).trim().replace(/\/+$/, '')
  const profileData = env.PUBLIC_MOSAIC_PROFILE_DATA?.trim() || null
  return { apiUrl, apiMode: mode, profileData }
}
