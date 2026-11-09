import { defineConfig } from 'astro/config'
import react from '@astrojs/react'

export default defineConfig({
  site: 'https://mosaic-mfl.github.io',
  base: '/website',
  output: 'static',
  // Astro 7 defaults this to 'jsx', which removes whitespace between inline
  // elements. Pinned to the Astro 4-6 behaviour so the parity diff stays readable.
  compressHTML: true,
  integrations: [react()],
})
