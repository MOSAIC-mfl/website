/** @maplibre/maplibre-gl-compare ships no types; this is the part the explorer uses. */
declare module '@maplibre/maplibre-gl-compare' {
  import type { Map } from 'maplibre-gl'
  export default class Compare {
    constructor(a: Map, b: Map, container: HTMLElement | string, options?: { orientation?: 'vertical' | 'horizontal'; mousemove?: boolean })
    currentPosition: number
    setSlider(x: number): void
    on(event: 'slideend', handler: () => void): this
    remove(): void
  }
}
