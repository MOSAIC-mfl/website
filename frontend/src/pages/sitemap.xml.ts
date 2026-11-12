/* The site's pages, for search engines: Home, Landscapes, Catalogue, About and
   one address per dataset record. Built with the site, so it follows the
   catalogue without anyone keeping a list. The redirect pages and the
   placeholder /analytics carry noindex and are left out. */
/// <reference types="astro/client" />
// (the line above gives `import.meta.env` its type when `tsc` runs before Astro
// has generated its own types, as it does in CI)
import type { APIRoute } from 'astro'
import { loadDatasets } from '../utils/loadDatasets'

export const GET: APIRoute = async ({ site }) => {
  const base = import.meta.env.BASE_URL
  const datasets = await loadDatasets()
  const paths = ['/', '/landscapes/', '/catalogue/', '/about/', ...datasets.map((d) => `/catalogue/${d.id}/`)]
  const urls = paths.map((p) => `  <url><loc>${new URL(`${base}${p}`, site).href}</loc></url>`).join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
