/** Port: reading an explorer's data files (wherever AssetRouter says they live). */

export interface RasterFile {
  width: number
  height: number
  /** top-left corner in the file's CRS */
  origin: [number, number]
  /** pixel size (y negative for north-up) */
  resolution: [number, number]
  /** one array per sample (band) for the window [x0, y0, x1, y1) */
  read(window: [number, number, number, number], samples?: number[]): Promise<ArrayLike<number>[]>
}

/** A small GeoTIFF read whole (climate stacks): one array per band. */
export interface GridStack {
  width: number
  height: number
  bands: ArrayLike<number>[]
}

export interface DataSource {
  url(path: string): string
  json<T = unknown>(path: string): Promise<T>
  /** HTTP range read: `length` bytes from `offset` */
  bytes(path: string, offset: number, length: number): Promise<ArrayBuffer>
  /** windowed reads of a cloud-optimized GeoTIFF (one HTTP range per window) */
  raster(path: string): Promise<RasterFile>
  grid(path: string): Promise<GridStack>
}
