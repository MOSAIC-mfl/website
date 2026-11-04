import { defineConfig } from 'astro/config'
import react from '@astrojs/react'

// The site keeps the approved address (/website) unless MOSAIC_SITE_BASE says otherwise.
export default defineConfig({
  site: process.env.MOSAIC_SITE_URL ?? 'https://mosaic-mfl.github.io',
  base: process.env.MOSAIC_SITE_BASE ?? '/website',
  output: 'static',
  integrations: [react()],
})
