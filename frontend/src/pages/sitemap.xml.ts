/* The site's pages, for search engines: Home, Landscapes, Catalogue, About and one address per
   dataset record. The dataset addresses are read from mosaic-api when the site is built (a sitemap
   is a file, so it is the one place where the catalogue is read at build time); if the API cannot
   be reached the sitemap still lists the main pages. The redirect pages and the placeholder
   /analytics carry noindex and are left out. */
/// <reference types="astro/client" />
// (the line above gives `import.meta.env` its type when `tsc` runs before Astro
// has generated its own types, as it does in CI)
import type { APIRoute } from 'astro'
import { catalogue } from '../lib/catalog'
import { datasetHref } from '../lib/domain/present'
import { emptyQuery } from '../lib/domain/query'

const PAGE = 100

async function datasetIds(): Promise<string[]> {
  const repo = catalogue()
  const ids: string[] = []
  try {
    for (let page = 1; ; page++) {
      const { items, total } = await repo.search({ ...emptyQuery(), page, pageSize: PAGE })
      ids.push(...items.map((i) => i.id))
      if (items.length === 0 || ids.length >= total) break
    }
  } catch {
    /* API unreachable at build time: main pages only */
  }
  return ids
}

export const GET: APIRoute = async ({ site }) => {
  const base = import.meta.env.BASE_URL
  const pages = ['/', '/landscapes/', '/catalogue/', '/about/'].map((p) => `${base}${p}`)
  const datasets = (await datasetIds()).map((id) => datasetHref(base, id))
  const urls = [...pages, ...datasets]
    .map((p) => `  <url><loc>${new URL(p, site).href.replace(/&/g, '&amp;')}</loc></url>`)
    .join('\n')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
