/**
 * Adapter: DataSource over HTTP. JSON and whole small GeoTIFFs are memoized per page; COG windows
 * and binary cells are fetched with range requests (the files stay where their authors serve them).
 */
import { fromArrayBuffer, fromUrl, type GeoTIFFImage } from 'geotiff'
import type { AssetRouter } from '../domain/assets'
import type { DataSource, GridStack, RasterFile } from '../ports/data'

export class DataError extends Error {
  constructor(
    readonly path: string,
    readonly status: number | null,
    message: string,
  ) {
    super(message)
    this.name = 'DataError'
  }
}

export class HttpDataSource implements DataSource {
  private readonly cache = new Map<string, Promise<unknown>>()

  constructor(
    private readonly assets: AssetRouter,
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  url(path: string): string {
    return this.assets.url(path)
  }

  private memo<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (!this.cache.has(key)) {
      const p = load()
      p.catch(() => this.cache.delete(key)) // a failed read can be retried
      this.cache.set(key, p)
    }
    return this.cache.get(key) as Promise<T>
  }

  private async get(path: string, init?: RequestInit): Promise<Response> {
    if (this.assets.isWithheld(path)) throw new DataError(path, null, `${path} is not published`)
    let res: Response
    try {
      res = await this.fetchImpl(this.url(path), init)
    } catch (err) {
      throw new DataError(path, null, `could not read ${path} (${String(err)})`)
    }
    if (!res.ok) throw new DataError(path, res.status, `could not read ${path} (HTTP ${res.status})`)
    return res
  }

  json<T>(path: string): Promise<T> {
    return this.memo(`json:${path}`, async () => (await this.get(path)).json() as Promise<T>)
  }

  async bytes(path: string, offset: number, length: number): Promise<ArrayBuffer> {
    const res = await this.get(path, { headers: { Range: `bytes=${offset}-${offset + length - 1}` } })
    const buf = await res.arrayBuffer()
    // a server that ignores Range sends the whole file: cut the slice out
    return res.status === 206 || buf.byteLength === length ? buf : buf.slice(offset, offset + length)
  }

  raster(path: string): Promise<RasterFile> {
    return this.memo(`cog:${path}`, async () => {
      if (this.assets.isWithheld(path)) throw new DataError(path, null, `${path} is not published`)
      const tiff = await fromUrl(this.url(path), { allowFullFile: false })
      return toRaster(await tiff.getImage())
    })
  }

  grid(path: string): Promise<GridStack> {
    return this.memo(`grid:${path}`, async () => {
      const tiff = await fromArrayBuffer(await (await this.get(path)).arrayBuffer())
      const img = await tiff.getImage()
      const bands = (await img.readRasters()) as unknown as ArrayLike<number>[]
      return { width: img.getWidth(), height: img.getHeight(), bands: Array.from(bands) }
    })
  }
}

function toRaster(img: GeoTIFFImage): RasterFile {
  const [ox, oy] = img.getOrigin()
  const [rx, ry] = img.getResolution()
  return {
    width: img.getWidth(),
    height: img.getHeight(),
    origin: [ox, oy],
    resolution: [rx, ry],
    async read(window, samples) {
      const r = await img.readRasters({ window, ...(samples ? { samples } : {}) })
      return Array.from(r as unknown as ArrayLike<number>[])
    },
  }
}
