/// <reference types="astro/client" />

// The website's own build variables (see .env.example).
interface ImportMetaEnv {
  readonly PUBLIC_MOSAIC_API_URL?: string
  readonly PUBLIC_MOSAIC_PROFILE_DATA?: string
  readonly PUBLIC_MOSAIC_API_MODE?: string
}
