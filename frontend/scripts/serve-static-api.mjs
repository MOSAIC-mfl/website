// Serves a folder over HTTP with CORS and byte ranges, for local development:
//   npm run api:static                          the static API exported by mosaic-api (mosaic-api/site, cloned
//                                               next to the website repo) on :8001
//   PORT=8002 node scripts/serve-static-api.mjs <folder>   e.g. map explorer data (PUBLIC_MOSAIC_PROFILE_DATA)
// GitHub Pages and Hugging Face send the same CORS and range headers.
import { createReadStream, existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

// website/frontend/ -> ../../mosaic-api/site; a standalone checkout of the frontend -> ../mosaic-api/site
const defaultRoot = ['../../mosaic-api/site', '../mosaic-api/site'].find((p) => existsSync(p)) ?? '../../mosaic-api/site'
const root = resolve(process.argv[2] ?? defaultRoot)
const port = Number(process.env.PORT ?? 8001)
const types = {
  '.json': 'application/json',
  '.jsonld': 'application/ld+json',
  '.geojson': 'application/geo+json',
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.tif': 'image/tiff',
}
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Range',
  'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end()
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^([/\\])+/, '')
  let file = join(root, path)
  if (!file.startsWith(root)) return res.writeHead(403, cors).end()
  try {
    let info = await stat(file)
    if (info.isDirectory()) {
      file = join(file, 'index.html')
      info = await stat(file)
    }
    const headers = { ...cors, 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Accept-Ranges': 'bytes' }
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
    if (range) {
      const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]))
      const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1
      if (start > end || start >= info.size) return res.writeHead(416, { ...cors, 'Content-Range': `bytes */${info.size}` }).end()
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${info.size}`, 'Content-Length': end - start + 1 })
      return createReadStream(file, { start, end }).pipe(res)
    }
    res.writeHead(200, { ...headers, 'Content-Length': info.size })
    createReadStream(file).pipe(res)
  } catch {
    res.writeHead(404, cors).end('not found')
  }
}).listen(port, '127.0.0.1', () => console.log(`${root} on http://127.0.0.1:${port}`))
