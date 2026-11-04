/** Pixel of a raster under a map point (rasters in EPSG:4326 or UTM). */
import { epsgOf, toUtm } from '../domain/geo'
import type { LngLat } from '../domain/format'
import type { RasterFile } from '../ports/data'

export function pixelAt(img: RasterFile, lngLat: LngLat, crs?: string): { col: number; row: number } | null {
  const epsg = epsgOf(crs)
  const [x, y] = epsg === 4326 ? [lngLat.lng, lngLat.lat] : toUtm(epsg, lngLat)
  const [ox, oy] = img.origin
  const [rx, ry] = img.resolution
  const col = Math.floor((x - ox) / rx)
  const row = Math.floor((y - oy) / ry)
  return col < 0 || row < 0 || col >= img.width || row >= img.height ? null : { col, row }
}
