/* Rivers, lakes and place names for the Landscapes page's locator map, as one
   file next to the page. The page asks for it the first time a landscape is
   opened, so the 300 KB of detail is not paid for by a visitor who only looks
   at the start screen. It is the site's own file, built with it — the one
   request the site makes after a page has loaded. Without it the map still
   works: land, countries, the landscape outline and the pin are in the page. */
import type { APIRoute } from 'astro'
import labels from '../../../data/landscape_labels.json'

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ places: labels.places, rivers: labels.rivers, lakes: labels.lakes }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
