/**
 * Controller of the Landscapes explorer (LandscapeExplorer.astro): selector, start map, locator map
 * with globe, photos, key insights and the section menu. Plain DOM, no framework island.
 *
 * The page carries the site's own landscape data (names, outlines, photos, descriptions) as JSON.
 * Figures that come from the catalogue - dataset counts, data coverage, open access - and whether a
 * landscape has a map profile are read from mosaic-api in the browser through ExplorerData.
 */
import { byDatasetCount, datasetWord, type LandscapeIndexEntry, type LandscapeInsights } from '../../../lib/domain/landscape-insights'
import type { ExplorerData } from '../../../lib/ui/landscape-explorer-data'

type Photo = { src: string; alt: string; caption?: string | null; author: string; licence: string; licence_url?: string | null; source_url: string; width?: number; height?: number }
type Item = {
  code: string; name: string; country: string; pending: boolean; area: string
  sources: { url: string; host: string; fields: string }[]
  countries: string[]; view: number[]; bbox: number[]; lon: number; lat: number; photos: Photo[]
  summary: string | null; ecosystem: string | null; livelihoods: string | null; why: string | null
  catalogue: string; boundary: { href: string; size: string } | null
  resources: Res[]
}
type Res = {
  title: string; url: string
  type?: string | null; authors?: string | null; org?: string | null
  year?: number | null; extent?: string | null; licence?: string | null; note?: string | null
}
type Labels = {
  places: (string | number)[][]
  rivers: { n: string | null; z: number; a: number[][]; d: string }[]
  lakes: { n: string | null; z: number; x: number; y: number; d: string }[]
}
type Data = { items: Item[]; globe: { iso: string; rings: number[][][] }[] }

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function animate(ms: number, step: (t: number) => void, done?: () => void) {
  if (reduce) { step(1); done?.(); return () => {} }
  let raf = 0
  const t0 = performance.now()
  const tick = (now: number) => {
    const t = Math.min(1, (now - t0) / ms)
    step(t)
    if (t < 1) raf = requestAnimationFrame(tick)
    else done?.()
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}


export function mountExplorer(root: HTMLElement, live: ExplorerData): void {
  const data: Data = JSON.parse(root.querySelector('[data-lx-data]')!.textContent || '{}')
  const byCode = new Map(data.items.map((i) => [i.code, i]))
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!
  const field = (name: string) => $(`[data-f="${name}"]`)
  const list = Array.from(root.querySelectorAll<HTMLElement>('.lx-item'))
  const svg = $<SVGSVGElement>('[data-map-svg]')
  const pin = $<SVGGElement>('[data-pin]')
  let current = data.items[0]
  let view = [...current.view]
  // "Select a landscape" start screen (set before first paint by the inline script)
  let intro = root.classList.contains('is-intro')
  const base = root.dataset.base ?? ''

  /* ---------- live figures (mosaic-api) ---------- */
  // Until the index arrives (or if it fails) counts read "–" and the map section stays hidden.
  let index: Map<string, LandscapeIndexEntry> | null = null
  const countOf = (code: string) => index?.get(code)?.count
  const hasMap = (code: string) => index?.get(code)?.hasMap === true

  /* ---------- map camera ---------- */
  // Resting view: the landscape's country (or countries), padded; never so
  // wide that the landscape itself shrinks below ~1/6 of the frame.
  function restView(it: Item) {
    const [x0, y0, x1, y1] = it.view
    const pad = Math.max(x1 - x0, y1 - y0) * 0.12 + 0.5
    return [x0 - pad, y0 - pad, x1 + pad, y1 + pad]
  }
  function setView(v: number[]) {
    view = v
    svg.setAttribute('viewBox', `${v[0]} ${v[1]} ${v[2] - v[0]} ${v[3] - v[1]}`)
    placePin()
    updateScale()
    drawGlobeView()
    queueLabels()
  }
  /* ---------- place, river and lake names ---------- */
  // Natural Earth tags every feature with the web-map zoom from which it is
  // worth showing (min_zoom). We work out the equivalent zoom of the current
  // view and show what qualifies, most important first, skipping any label
  // that would collide with one already placed.
  const labelSvg = $<SVGSVGElement>('[data-labels]')
  const SVGNS = 'http://www.w3.org/2000/svg'
  // Rivers, lakes and place names arrive in their own file the first time a
  // landscape is opened (see pages/landscapes/map-detail.json.ts). Until
  // then, and if the request fails, the map simply shows no water or names.
  let labels: Labels = { places: [], rivers: [], lakes: [] }
  let waterPaths: SVGPathElement[] = []
  let detailAsked = false
  function loadDetail() {
    if (detailAsked || !root.dataset.detailUrl) return
    detailAsked = true
    fetch(root.dataset.detailUrl)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((d: Labels) => {
        const shape = (cls: string, z: number, path: string, evenodd: boolean) => {
          const p = document.createElementNS(SVGNS, 'path')
          p.setAttribute('class', cls)
          p.dataset.z = String(z)
          p.setAttribute('d', path)
          if (evenodd) p.setAttribute('fill-rule', 'evenodd')
          p.setAttribute('vector-effect', 'non-scaling-stroke')
          return p
        }
        waterPaths = [
          ...d.lakes.map((l) => shape('lx-lake', l.z, l.d, true)),
          ...d.rivers.map((r) => shape(`lx-river ${r.z <= 3 ? 'r1' : r.z <= 5 ? 'r2' : 'r3'}`, r.z, r.d, false)),
        ]
        $<SVGGElement>('[data-water]').replaceChildren(...waterPaths)
        labels = { places: d.places, rivers: d.rivers.filter((r) => r.n), lakes: d.lakes.filter((l) => l.n) }
        queueLabels()
      })
      .catch(() => { detailAsked = false }) // try again the next time a landscape is opened
  }
  if (!intro) loadDetail() // the address already names a landscape
  let labelQueued = false
  function queueLabels() {
    if (labelQueued) return
    labelQueued = true
    requestAnimationFrame(() => { labelQueued = false; drawLabels() })
  }
  function webZoom() { return Math.log2((pxPerUnit() * 360) / 256) }
  function drawLabels() {
    const r = svg.getBoundingClientRect()
    if (!r.width) return
    const z = webZoom()
    for (const p of waterPaths) p.classList.toggle('is-off', Number(p.dataset.z) > z + 1.2)
    if (root.classList.contains('is-flying')) return
    const v = visible()
    const sx = r.width / (v[2] - v[0]), sy = r.height / (v[3] - v[1])
    const toPx = (x: number, y: number) => [(x - v[0]) * sx, (y - v[1]) * sy]
    // keep clear of the controls, the globe, the scale bar and the pin
    const taken: number[][] = [
      [0, 0, 52, 120], [r.width - 104, 0, r.width, 104], [0, r.height - 40, 130, r.height], [r.width - 40, r.height - 44, r.width, r.height],
      [r.width / 2 - 70, 0, r.width / 2 + 70, 34],
    ]
    const [pinX, pinY] = toPx(current.lon + 180, 90 - current.lat)
    taken.push([pinX - 16, pinY - 16, pinX + 16, pinY + 16])
    const free = (b: number[]) => b[0] > 2 && b[1] > 2 && b[2] < r.width - 2 && b[3] < r.height - 2 && !taken.some((t) => b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1])
    const nodes: SVGElement[] = []
    const text = (cls: string, x: number, y: number, s: string, rot = 0, anchor = 'start') => {
      const t = document.createElementNS(SVGNS, 'text')
      t.setAttribute('class', cls)
      t.setAttribute('x', x.toFixed(1)); t.setAttribute('y', y.toFixed(1))
      t.setAttribute('text-anchor', anchor)
      if (rot) t.setAttribute('transform', `rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})`)
      t.textContent = s
      nodes.push(t)
    }
    const maxPlaces = Math.round((r.width * r.height) / 9000)
    let nPlaces = 0
    // 1) places
    for (const [n, x, y, pz, cap] of labels.places as [string, number, number, number, number][]) {
      if (pz > z + 1.2 || nPlaces >= maxPlaces) continue
      if (x < v[0] || x > v[2] || y < v[1] || y > v[3]) continue
      const [px, py] = toPx(x, y)
      const big = cap === 1 || pz <= 3
      const w = n.length * (big ? 6.8 : 6) + 8, h = big ? 14 : 12
      const right = [px - 4, py - h / 2 - 1, px + w, py + h / 2 + 1]
      const left = [px - w, py - h / 2 - 1, px + 4, py + h / 2 + 1]
      const box = free(right) ? right : free(left) ? left : null
      if (!box) continue
      taken.push(box)
      const dot = document.createElementNS(SVGNS, cap === 1 ? 'rect' : 'circle')
      if (cap === 1) { dot.setAttribute('x', (px - 3.5).toFixed(1)); dot.setAttribute('y', (py - 3.5).toFixed(1)); dot.setAttribute('width', '7'); dot.setAttribute('height', '7') }
      else { dot.setAttribute('cx', px.toFixed(1)); dot.setAttribute('cy', py.toFixed(1)); dot.setAttribute('r', big ? '3' : '2.3') }
      dot.setAttribute('class', cap === 1 ? 'l-cap' : 'l-dot')
      nodes.push(dot)
      if (box === right) text(big ? 'l-place big' : 'l-place', px + 6, py + 4, n)
      else text(big ? 'l-place big' : 'l-place', px - 6, py + 4, n, 0, 'end')
      nPlaces++
    }
    // 2) lakes
    for (const l of labels.lakes) {
      if (l.z > z + 1.2 || l.x < v[0] || l.x > v[2] || l.y < v[1] || l.y > v[3]) continue
      const [px, py] = toPx(l.x, l.y)
      const w = l.n!.length * 6.2
      const b = [px - w / 2, py - 7, px + w / 2, py + 7]
      if (!free(b)) continue
      taken.push(b); text('l-water', px, py + 4, l.n!, 0, 'middle')
    }
    // 3) rivers: the anchor nearest the middle of the view that fits
    const cx = (v[0] + v[2]) / 2, cy = (v[1] + v[3]) / 2
    for (const rv of labels.rivers) {
      if (rv.z > z + 0.6) continue
      const cands = rv.a.filter(([x, y]) => x > v[0] && x < v[2] && y > v[1] && y < v[3])
        .sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy))
      for (const [x, y, ang] of cands.slice(0, 6)) {
        const [px, py] = toPx(x, y)
        const w = rv.n!.length * 5.8, rad = (ang * Math.PI) / 180
        const hw = (Math.abs(Math.cos(rad)) * w + Math.abs(Math.sin(rad)) * 12) / 2
        const hh = (Math.abs(Math.sin(rad)) * w + Math.abs(Math.cos(rad)) * 12) / 2
        const b = [px - hw, py - hh, px + hw, py + hh]
        if (!free(b)) continue
        taken.push(b); text('l-water l-river', px, py - 3, rv.n!, -ang, 'middle')
        break
      }
    }
    labelSvg.replaceChildren(...nodes)
  }

  function pxPerUnit() {
    const r = svg.getBoundingClientRect()
    return Math.min(r.width / (view[2] - view[0]), r.height / (view[3] - view[1])) || 1
  }
  function placePin() {
    const k = 1 / pxPerUnit()
    pin.setAttribute('transform', `translate(${current.lon + 180} ${90 - current.lat}) scale(${k})`)
  }
  function updateScale() {
    const kmPerPx = (111.32 * Math.cos((current.lat * Math.PI) / 180)) / pxPerUnit()
    const raw = kmPerPx * 100
    const p = Math.pow(10, Math.floor(Math.log10(raw)))
    const nice = [1, 2, 5, 10].map((m) => m * p).filter((n) => n <= raw).pop() || p
    const w = nice / kmPerPx
    const s = $('[data-scale]')
    s.querySelectorAll('line').forEach((l, i) => {
      if (i === 0) l.setAttribute('x2', String(2 + w))
      if (i === 2) { l.setAttribute('x1', String(2 + w)); l.setAttribute('x2', String(2 + w)) }
    })
    $('[data-scale-label]').textContent = `${nice.toLocaleString('en-US')} km`
  }
  // What the map really shows: the viewBox, widened on one axis by the
  // letterboxing of preserveAspectRatio="meet".
  function visible(v = view) {
    const r = svg.getBoundingClientRect()
    const k = Math.min(r.width / (v[2] - v[0]), r.height / (v[3] - v[1])) || 1
    const cx = (v[0] + v[2]) / 2, cy = (v[1] + v[3]) / 2
    const w = r.width / k / 2, h = r.height / k / 2
    return [cx - w, cy - h, cx + w, cy + h]
  }
  let stopCam = () => {}
  // Zoom limits: from a tenth of the landscape's width (detail) out to
  // twice the country view.
  const minSpan = () => Math.max(0.05, (current.bbox[2] - current.bbox[0]) / 10)
  const maxSpan = () => { const r = restView(current); return Math.min(360, Math.max(r[2] - r[0], r[3] - r[1]) * 2) }
  function zoomBy(f: number, ax?: number, ay?: number, ms = 280) {
    stopCam()
    const v = visible()
    const span = Math.max(v[2] - v[0], v[3] - v[1])
    const target = Math.min(maxSpan(), Math.max(minSpan(), span * f))
    const g = target / span
    if (Math.abs(g - 1) < 1e-3) return updateZoomButtons()
    const x = ax ?? (v[0] + v[2]) / 2, y = ay ?? (v[1] + v[3]) / 2
    const to = [x - (x - v[0]) * g, y - (y - v[1]) * g, x + (v[2] - x) * g, y + (v[3] - y) * g]
    const from = [...view]
    stopCam = animate(ms, (t) => { const e = 1 - Math.pow(1 - t, 3); setView(from.map((a, i) => lerp(a, to[i], e))) }, updateZoomButtons)
  }
  function panBy(dx: number, dy: number) {
    setView([view[0] + dx, view[1] + dy, view[2] + dx, view[3] + dy])
  }
  function updateZoomButtons() {
    const v = visible()
    const span = Math.max(v[2] - v[0], v[3] - v[1])
    ;($('[data-zoom="in"]') as HTMLButtonElement).disabled = span <= minSpan() * 1.01
    ;($('[data-zoom="out"]') as HTMLButtonElement).disabled = span >= maxSpan() * 0.99
  }
  function toUnits(e: { clientX: number; clientY: number }) {
    const r = svg.getBoundingClientRect()
    const v = visible()
    return [v[0] + ((e.clientX - r.left) / r.width) * (v[2] - v[0]), v[1] + ((e.clientY - r.top) / r.height) * (v[3] - v[1])]
  }
  function zoomIntoLandscape() {
    stopCam()
    const v = visible()
    const span = Math.max(v[2] - v[0], v[3] - v[1])
    const target = Math.max(minSpan(), span * 0.5)
    if (target >= span * 0.999) return updateZoomButtons()
    const b = current.bbox
    const lx = (b[0] + b[2]) / 2, ly = (b[1] + b[3]) / 2
    const cx = (v[0] + v[2]) / 2, cy = (v[1] + v[3]) / 2
    // move the centre most of the way to the landscape on each step
    const nx = lerp(cx, lx, 0.75), ny = lerp(cy, ly, 0.75)
    const r = svg.getBoundingClientRect()
    const hw = r.width >= r.height ? target / 2 : (target * r.width) / r.height / 2
    const hh = r.width >= r.height ? (target * r.height) / r.width / 2 : target / 2
    const to = [nx - hw, ny - hh, nx + hw, ny + hh]
    const from = [...view]
    stopCam = animate(320, (t) => { const e = 1 - Math.pow(1 - t, 3); setView(from.map((a, i) => lerp(a, to[i], e))) }, updateZoomButtons)
  }
  function fit() {
    stopCam()
    const from = [...view], to = restView(current)
    stopCam = animate(700, (t) => { const e = ease(t); setView(from.map((a, i) => lerp(a, to[i], e))) }, updateZoomButtons)
  }

  function flyTo(it: Item) {
    stopCam()
    root.classList.add('is-flying')
    const from = [...view]
    const to = restView(it)
    // Pull back to frame both views, then push in: a short "flight".
    const mid = [Math.min(from[0], to[0]), Math.min(from[1], to[1]), Math.max(from[2], to[2]), Math.max(from[3], to[3])]
    const grow = (b: number[], f: number) => {
      const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, w = (b[2] - b[0]) * f, h = (b[3] - b[1]) * f
      return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]
    }
    const peak = grow(mid, 1.15)
    stopCam = animate(1400, (t) => {
      const e = ease(t)
      // quadratic Bézier through the peak view
      const v = from.map((f, i) => (1 - e) * (1 - e) * f + 2 * (1 - e) * e * peak[i] + e * e * to[i])
      setView(v)
    }, () => { root.classList.remove('is-flying'); updateZoomButtons(); drawLabels() })
  }

  /* ---------- inset globe (orthographic, rotated to the landscape) ---------- */
  const globeLand = $<SVGGElement>('[data-globe-land]')
  const globeDot = $<SVGCircleElement>('[data-globe-dot]')
  const R = 50
  let rot = [current.lon, current.lat]
  function project(lon: number, lat: number, l0: number, p0: number): [number, number, boolean] {
    const d = Math.PI / 180
    const la = lat * d, lo = (lon - l0) * d, ph = p0 * d
    const cosc = Math.sin(ph) * Math.sin(la) + Math.cos(ph) * Math.cos(la) * Math.cos(lo)
    let x = R * Math.cos(la) * Math.sin(lo)
    let y = -R * (Math.cos(ph) * Math.sin(la) - Math.sin(ph) * Math.cos(la) * Math.cos(lo))
    if (cosc < 0) { const n = Math.hypot(x, y) || 1; x = (x / n) * R; y = (y / n) * R } // clamp to the horizon
    return [x, y, cosc >= 0]
  }
  const globePaths = data.globe.map((c) => {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    p.setAttribute('class', 'g-land')
    globeLand.appendChild(p)
    return { iso: c.iso, rings: c.rings, el: p }
  })
  function drawGlobe(l0: number, p0: number) {
    for (const g of globePaths) {
      let d = ''
      for (const ring of g.rings) {
        let any = false, s = ''
        ring.forEach(([lo, la], i) => {
          const [x, y, vis] = project(lo, la, l0, p0)
          any ||= vis
          s += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1)
        })
        if (any) d += s + 'Z'
      }
      g.el.setAttribute('d', d)
    }
    const [x, y] = project(current.lon, current.lat, l0, p0)
    globeDot.setAttribute('cx', x.toFixed(1))
    globeDot.setAttribute('cy', y.toFixed(1))
    drawGlobeView()
  }
  // Outline of what the flat map currently shows, drawn on the globe.
  const globeView = $<SVGPathElement>('[data-globe-view]')
  function drawGlobeView() {
    if (!globeView) return
    const [x0, y0, x1, y1] = visible()
    const lon = (x: number) => Math.max(-180, Math.min(180, x - 180))
    const lat = (y: number) => Math.max(-89, Math.min(89, 90 - y))
    const pts: number[][] = []
    const N = 12
    for (let i = 0; i <= N; i++) pts.push([lon(x0 + ((x1 - x0) * i) / N), lat(y0)])
    for (let i = 1; i <= N; i++) pts.push([lon(x1), lat(y0 + ((y1 - y0) * i) / N)])
    for (let i = 1; i <= N; i++) pts.push([lon(x1 - ((x1 - x0) * i) / N), lat(y1)])
    for (let i = 1; i < N; i++) pts.push([lon(x0), lat(y1 - ((y1 - y0) * i) / N)])
    const d = pts.map(([lo, la], i) => { const [x, y] = project(lo, la, rot[0], rot[1]); return (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1) }).join('') + 'Z'
    globeView.setAttribute('d', d)
  }
  let stopGlobe = () => {}
  function spinTo(it: Item) {
    stopGlobe()
    const from = [...rot]
    let dl = it.lon - from[0]
    if (dl > 180) dl -= 360
    if (dl < -180) dl += 360
    for (const g of globePaths) g.el.classList.toggle('is-home', it.countries.includes(g.iso))
    stopGlobe = animate(1400, (t) => {
      const e = ease(t)
      rot = [from[0] + dl * e, lerp(from[1], it.lat, e)]
      drawGlobe(rot[0], rot[1])
    })
  }

  /* ---------- counter ---------- */
  let stopCount = () => {}
  function countTo(n: number | undefined) {
    stopCount()
    const el = field('count')
    if (n === undefined) { el.textContent = '–'; field('count-label').textContent = 'datasets'; return }
    const from = Number(el.textContent) || 0
    field('count-label').textContent = datasetWord(n)
    const badge = el.closest('.lx-badge')!
    badge.classList.remove('is-bump'); void (badge as HTMLElement).offsetWidth; badge.classList.add('is-bump')
    stopCount = animate(900, (t) => { el.textContent = String(Math.round(lerp(from, n, 1 - Math.pow(1 - t, 3)))) })
  }

  /* ---------- photos ---------- */
  let photoIdx = 0
  let photoTimer = 0
  function showPhoto(it: Item, i: number) {
    photoIdx = i
    const imgs = root.querySelectorAll('.lx-photo-img')
    imgs.forEach((im, k) => im.classList.toggle('is-on', k === i))
    root.querySelectorAll('.lx-dot').forEach((d, k) => { d.classList.toggle('is-on', k === i); d.setAttribute('aria-selected', String(k === i)) })
    $('[data-photo-count]').textContent = `${i + 1} / ${it.photos.length}`
    setCredit(it.photos[i])
  }
  // The credit (author + licence) must always match the photo on screen, so
  // it is written synchronously, never after an animation frame.
  function setCredit(ph: Photo | undefined) {
    const credit = $('[data-credit]')
    credit.replaceChildren()
    if (!ph) return
    if (ph.caption) credit.append(`${ph.caption} · `)
    credit.append('Photo: ')
    const a = Object.assign(document.createElement('a'), { href: ph.source_url, target: '_blank', rel: 'noopener', textContent: ph.author })
    credit.append(a, ', ')
    if (ph.licence_url) credit.append(Object.assign(document.createElement('a'), { href: ph.licence_url, target: '_blank', rel: 'noopener', textContent: ph.licence }))
    else credit.append(ph.licence)
  }
  function renderPhotos(it: Item) {
    const fig = $('[data-photo]')
    fig.hidden = it.photos.length === 0
    const stack = $('[data-photo-stack]')
    const dots = $('[data-dots]')
    stack.replaceChildren(...it.photos.map((ph) => {
      const im = Object.assign(document.createElement('img'), { src: ph.src, alt: ph.alt, className: 'lx-photo-img', decoding: 'async' })
      if (ph.width) im.width = ph.width
      if (ph.height) im.height = ph.height
      return im
    }))
    dots.replaceChildren(...it.photos.map((_, k) => {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'lx-dot' })
      b.setAttribute('role', 'tab'); b.setAttribute('aria-label', `Photo ${k + 1}`)
      b.addEventListener('click', () => { showPhoto(it, k); restartAuto(it) })
      return b
    }))
    dots.hidden = it.photos.length < 2
    setCredit(it.photos[0])
    $('[data-photo-count]').textContent = `1 / ${it.photos.length}`
    for (const sel of ['[data-photo-prev]', '[data-photo-next]', '[data-photo-count]']) $(sel).hidden = it.photos.length < 2
    // let the new images paint at opacity 0 before fading the first one in
    // (skipped if another landscape was selected in the meantime)
    requestAnimationFrame(() => requestAnimationFrame(() => { if (current === it) showPhoto(it, 0) }))
    restartAuto(it)
  }
  function restartAuto(it: Item) {
    window.clearInterval(photoTimer)
    if (reduce || it.photos.length < 2) return
    photoTimer = window.setInterval(() => { if (current === it) showPhoto(it, (photoIdx + 1) % it.photos.length) }, 6000)
  }
  // wire the server-rendered dots of the first landscape
  root.querySelectorAll<HTMLButtonElement>('.lx-dot').forEach((b, k) => b.addEventListener('click', () => { showPhoto(current, k); restartAuto(current) }))
  $('[data-dots]').hidden = current.photos.length < 2
  const step = (d: number) => {
    const n = current.photos.length
    if (n < 2) return
    showPhoto(current, (photoIdx + d + n) % n)
    restartAuto(current)
  }
  $('[data-photo-prev]').addEventListener('click', () => step(-1))
  $('[data-photo-next]').addEventListener('click', () => step(1))

  /* ---------- text ---------- */
  function renderText(it: Item) {
    field('name').textContent = it.name
    field('country').textContent = it.country
    field('pending').hidden = !it.pending
    field('area').textContent = it.area
    renderInsights(it)
    renderSources(it)
    for (const [row, val] of [['ecosystem', it.ecosystem], ['livelihoods', it.livelihoods], ['why', it.why]] as const) {
      $(`[data-row="${row}"]`).hidden = !val
      field(row).textContent = val ?? ''
    }
    field('summary').textContent = it.summary ?? ''
    ;(field('catalogue') as HTMLAnchorElement).href = it.catalogue
    ;(field('catalogue-btn') as HTMLAnchorElement).href = it.catalogue
    const bl = field('boundary') as HTMLAnchorElement
    bl.href = it.boundary?.href ?? '#download'
    field('boundary-size').textContent = it.boundary?.size ?? ''
    svg.setAttribute('aria-label', `Map of ${it.name}`)
    renderResources(it)
  }

  /* ---------- data coverage + sources ---------- */
  // Asked per landscape when it is shown; an answer for a landscape no longer selected is dropped.
  function renderInsights(it: Item) {
    const code = it.code
    live.insights(code).then(
      (ins) => { if (current.code === code) paintInsights(ins) },
      () => { if (current.code === code) paintInsights(null) },
    )
  }
  function paintInsights(ins: LandscapeInsights | null) {
    const total = ins?.themes.length ?? 0
    const withData = ins?.withData ?? 0
    field('cov-arc').setAttribute('stroke-dasharray', `${total ? (withData / total) * 100 : 0} 100`)
    field('cov-n').textContent = ins ? `${withData} of ${total}` : '–'
    field('cov-with').textContent = ins ? String(withData) : '–'
    field('cov-miss').textContent = ins ? String(ins.missing.length) : '–'
    field('cov-open').hidden = !ins || ins.count === 0
    field('cov-open-n').textContent = ins ? `${ins.open} of ${ins.count}` : ''
    field('cov-open-label').textContent = `${ins?.count === 1 ? 'dataset is' : 'datasets are'} open access`
    const box = $<HTMLDetailsElement>('[data-cov-missing]')
    box.hidden = !ins || ins.missing.length === 0
    box.open = false
    field('cov-miss-n').textContent = ins ? `(${ins.missing.length})` : ''
    field('cov-missing-list').replaceChildren(...(ins?.missing ?? []).map((t) => Object.assign(document.createElement('li'), { textContent: t })))
  }
  function renderSources(it: Item) {
    const box = $<HTMLDetailsElement>('[data-src]')
    box.hidden = it.sources.length === 0
    box.open = false
    $('[data-src-n]').textContent = `(${it.sources.length})`
    $('[data-src-list]').replaceChildren(...it.sources.map((src) => {
      const li = document.createElement('li')
      const a = Object.assign(document.createElement('a'), { href: src.url, target: '_blank', rel: 'noopener', textContent: src.host })
      const what = Object.assign(document.createElement('span'), { textContent: src.fields })
      li.append(a, what)
      return li
    }))
  }

  /* ---------- other resources ---------- */
  // One panel, two states: the list for a landscape that has resources, the
  // "under construction" notice for one that does not. Rows are cloned from a
  // <template> so the icon markup lives in one place.
  const resPanel = root.querySelector<HTMLElement>('[data-panel="resources"]')
  const resTpl = resPanel?.querySelector<HTMLTemplateElement>('[data-res-tpl]') ?? null
  function renderResources(it: Item) {
    if (!resPanel || !resTpl) return
    const has = it.resources.length > 0
    resPanel.querySelector<HTMLElement>('[data-res-has]')!.hidden = !has
    resPanel.querySelector<HTMLElement>('[data-res-soon]')!.hidden = has
    const chip = root.querySelector<HTMLElement>('[data-sec-soon="resources"]')
    if (chip) chip.hidden = has
    const list = resPanel.querySelector<HTMLElement>('[data-res-list]')!
    list.textContent = ''
    for (const r of it.resources) {
      const li = resTpl.content.firstElementChild!.cloneNode(true) as HTMLElement
      const a = li.querySelector<HTMLAnchorElement>('.lx-res-link')!
      a.href = r.url
      a.textContent = r.title
      li.querySelector('.lx-res-meta')!.textContent = [r.type, r.org, r.year, r.extent].filter(Boolean).join(' \u00b7 ')
      li.querySelector('.lx-res-note')!.textContent = r.note ?? ''
      li.querySelector('.lx-res-foot')!.textContent = [r.authors, r.licence].filter(Boolean).join(' \u00b7 ')
      list.appendChild(li)
    }
  }

  /* ---------- select ---------- */
  // Scroll only the list (never the page) so the selected item is visible.
  const ul = $('.lx-list')
  function revealInList(li: HTMLElement) {
    const horizontal = ul.scrollWidth > ul.clientWidth + 1
    const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth'
    if (horizontal) {
      const left = li.offsetLeft // ul is the offsetParent (position: relative)
      if (left < ul.scrollLeft || left + li.offsetWidth > ul.scrollLeft + ul.clientWidth) ul.scrollTo({ left: left - 16, behavior })
    } else {
      const top = li.offsetTop
      if (top < ul.scrollTop || top + li.offsetHeight > ul.scrollTop + ul.clientHeight) ul.scrollTo({ top: top - 8, behavior })
    }
  }
  function markListed(code: string | null) {
    list.forEach((li) => {
      const on = li.dataset.code === code
      li.setAttribute('aria-selected', String(on))
      li.tabIndex = on ? 0 : -1
    })
  }
  // the world map's pins: the chosen landscape's is highlighted
  const worldSvg = root.querySelector<SVGSVGElement>('[data-world]')
  const worldView = (() => {
    const b = worldSvg?.viewBox.baseVal
    return b ? [b.x, b.y, b.x + b.width, b.y + b.height] : null
  })()
  function markOn(code: string | null) {
    root.querySelectorAll('[data-ip]').forEach((p) => p.classList.toggle('is-on', (p as HTMLElement).dataset.ip === code))
  }
  function enterIntro() {
    if (intro) return
    intro = true
    root.classList.add('is-intro')
    markListed(null)
    markOn(null)
    const top = root.getBoundingClientRect().top
    if (top < 0) window.scrollTo({ top: top + window.scrollY - 96, behavior: reduce ? 'auto' : 'smooth' })
  }
  // leaves the start screen; true when it was showing
  function leaveIntro() {
    if (!intro) return false
    intro = false
    root.classList.remove('is-intro')
    loadDetail()
    const b = $('.lx-body')
    if (!reduce) { b.classList.remove('is-arriving'); void b.offsetWidth; b.classList.add('is-arriving') }
    // the locator map starts from the world view and flies to the landscape
    if (worldView) setView(worldView)
    requestAnimationFrame(() => { placePin(); updateScale(); queueLabels() })
    // chosen from the list further down: bring the explorer's top back into view
    const top = root.getBoundingClientRect().top
    if (top < 0) window.scrollTo({ top: top + window.scrollY - 96, behavior: reduce ? 'auto' : 'smooth' })
    return true
  }
  function select(code: string, opts: { focus?: boolean; push?: boolean } = {}) {
    const it = byCode.get(code)
    if (!it) return
    const fromIntro = leaveIntro()
    markOn(code)
    if (it === current) {
      if (fromIntro) {
        markListed(code)
        flyTo(it)
        if (opts.push !== false) writeHash()
      }
      return
    }
    current = it
    list.forEach((li) => {
      const on = li.dataset.code === code
      li.setAttribute('aria-selected', String(on))
      li.tabIndex = on ? 0 : -1
      if (on && opts.focus) li.focus()
      if (on) revealInList(li)
    })
    // selector button, section links and the "under construction" panels
    $('[data-pick-name]').textContent = it.name
    $('[data-pick-country]').textContent = it.country
    root.querySelectorAll<HTMLAnchorElement>('[data-sec]').forEach((a) => { a.href = `#${code}/${a.dataset.sec}` })
    root.querySelectorAll('[data-soon-name]').forEach((e) => { e.textContent = it.name })
    root.querySelectorAll<HTMLAnchorElement>('[data-soon-catalogue]').forEach((a) => { a.href = it.catalogue })
    root.querySelectorAll<HTMLAnchorElement>('[data-sec-link]').forEach((a) => { a.href = `#${code}/${a.dataset.secLink}` })
    updateMapSection()
    if (opts.push !== false) writeHash()

    // map
    svg.querySelectorAll('.lx-ls').forEach((p) => p.classList.toggle('is-on', (p as SVGElement).dataset.ls === code))
    svg.querySelectorAll<SVGPathElement>('.lx-ctry').forEach((p) => p.classList.toggle('is-home', it.countries.includes(p.dataset.iso!)))
    const label = $('[data-map-label]')
    label.style.opacity = '0'
    setTimeout(() => { label.textContent = it.country; label.style.opacity = '1' }, 700)
    flyTo(it)
    spinTo(it)
    // the drop animation runs on the inner group, so it never fights the
    // translate/scale that placePin() writes on the outer one
    const body = $<SVGGElement>('[data-pin-body]')
    body.classList.remove('is-drop'); body.style.opacity = '0'
    setTimeout(() => { body.style.opacity = ''; body.classList.add('is-drop') }, reduce ? 0 : 1150)

    // counter + content
    countTo(countOf(code))
    root.classList.add('is-swapping')
    setTimeout(() => { renderText(it); root.classList.remove('is-swapping') }, reduce ? 0 : 250)
    renderPhotos(it)
  }

  /* ---------- selector dropdown ---------- */
  const pickBtn = $<HTMLButtonElement>('[data-pick-btn]')
  const pop = $('[data-pop]')
  function openPick() {
    pop.hidden = false
    pickBtn.setAttribute('aria-expanded', 'true')
    const sel = list.find((li) => li.getAttribute('aria-selected') === 'true')
    if (sel) revealInList(sel)
    $<HTMLInputElement>('#lx-search').focus()
  }
  function closePick(focusBtn = false) {
    pop.hidden = true
    pickBtn.setAttribute('aria-expanded', 'false')
    if (focusBtn) pickBtn.focus()
  }
  pickBtn.addEventListener('click', () => (pop.hidden ? openPick() : closePick()))
  document.addEventListener('click', (e) => {
    if (!pop.hidden && !(e.target as Element).closest('[data-pick]')) closePick()
  })
  $('[data-pick]').addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { e.preventDefault(); closePick(true) } })

  const choose = (code: string) => { closePick(true); select(code) }
  list.forEach((li) => {
    li.addEventListener('click', () => choose(li.dataset.code!))
    li.addEventListener('keydown', (e) => {
      const visible = list.filter((x) => !x.hidden)
      const k = visible.indexOf(li)
      let next: HTMLElement | undefined
      if (e.key === 'ArrowDown') next = visible[k + 1]
      if (e.key === 'ArrowUp') { if (k === 0) { e.preventDefault(); $<HTMLInputElement>('#lx-search').focus(); return } next = visible[k - 1] }
      if (e.key === 'Home') next = visible[0]
      if (e.key === 'End') next = visible[visible.length - 1]
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(li.dataset.code!) }
      if (next) { e.preventDefault(); next.focus() }
    })
  })

  // search
  const input = $<HTMLInputElement>('#lx-search')
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase()
    let n = 0
    list.forEach((li) => { const hit = !q || li.dataset.search!.includes(q); li.hidden = !hit; if (hit) n++ })
    $('.lx-empty').hidden = n > 0
  })
  input.addEventListener('keydown', (e) => {
    const firstVisible = list.find((x) => !x.hidden)
    if (e.key === 'ArrowDown' && firstVisible) { e.preventDefault(); firstVisible.focus() }
    if (e.key === 'Enter' && firstVisible) { e.preventDefault(); choose(firstVisible.dataset.code!) }
  })

  /* ---------- sections ---------- */
  const secIds = Array.from(root.querySelectorAll<HTMLElement>('[data-panel]')).map((p) => p.dataset.panel!)
  let section = 'overview'
  function writeHash() {
    const h = section === 'overview' ? `#${current.code}` : `#${current.code}/${section}`
    history.replaceState(null, '', h)
  }
  function showSection(id: string, opts: { push?: boolean; scroll?: boolean } = {}) {
    if (!secIds.includes(id)) id = 'overview'
    // a landscape without a map profile has no "Map visualization" (once the index says so)
    if (id === 'map' && index && !hasMap(current.code)) id = 'overview'
    const changed = id !== section
    section = id
    root.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => {
      const on = p.dataset.panel === id
      p.hidden = !on
      if (on && changed && !reduce) { p.classList.remove('is-entering'); void p.offsetWidth; p.classList.add('is-entering') }
    })
    root.querySelectorAll<HTMLAnchorElement>('[data-sec]').forEach((a) => {
      if (a.dataset.sec === id) a.setAttribute('aria-current', 'true')
      else a.removeAttribute('aria-current')
    })
    // on phones the menu is a scrolling row: keep the active chip visible
    const chip = root.querySelector<HTMLElement>(`[data-sec="${id}"]`)
    const row = chip?.closest('ul')
    if (chip && row && row.scrollWidth > row.clientWidth) row.scrollTo({ left: chip.offsetLeft - row.offsetLeft - 8, behavior: reduce ? 'auto' : 'smooth' })
    // the map was hidden: re-measure it now that it is visible again
    if (id === 'overview') { placePin(); updateScale(); queueLabels() }
    if (id === 'map') mountMap(current.code)
    else unmountMap()
    // a short panel can leave the reader looking at the footer: bring the panel's top back into view
    if (opts.scroll && changed) {
      const top = $('.lx-body').getBoundingClientRect().top
      if (top < 80) window.scrollTo({ top: top + window.scrollY - 96, behavior: reduce ? 'auto' : 'smooth' })
    }
    if (opts.push !== false) writeHash()
  }
  root.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('[data-sec], [data-sec-link]')
    if (!a) return
    e.preventDefault()
    showSection(a.dataset.sec ?? a.dataset.secLink!, { scroll: true })
  })

  /* ---------- map visualization ---------- */
  // The landscape's map profile (map, story, studies), embedded in the panel. React, MapLibre and
  // the explorer load the first time the panel opens; the map is unmounted when the panel closes or
  // another landscape is chosen, so only one WebGL map is alive at a time.
  const mapEmbed = $('[data-map-embed]')
  let mapCode: string | null = null
  let disposeMap: (() => void) | null = null
  function mountMap(code: string) {
    if (mapCode === code) return
    unmountMap()
    mapCode = code
    import('../../../features/landscape/mount').then(
      ({ mountProfileMap }) => {
        if (mapCode === code && section === 'map') disposeMap = mountProfileMap(mapEmbed, code, base)
      },
      () => { mapCode = null },
    )
  }
  function unmountMap() {
    disposeMap?.()
    disposeMap = null
    mapCode = null
  }
  // Menu entry, full-screen link and panel follow the selected landscape.
  function updateMapSection() {
    const show = hasMap(current.code)
    $('[data-sec="map"]').closest('li')!.hidden = !show
    $<HTMLAnchorElement>('[data-map-full]').href = `${base}/landscapes/${current.code.toLowerCase()}/map/`
    if (section !== 'map') return
    if (index && !show) showSection('overview', { push: false })
    else mountMap(current.code)
  }

  /* ---------- dataset counts from mosaic-api ---------- */
  function applyIndex(idx: Map<string, LandscapeIndexEntry>) {
    index = idx
    const n = (code: string) => idx.get(code)?.count ?? 0
    for (const li of list) {
      const c = n(li.dataset.code!)
      const badge = li.querySelector<HTMLElement>('.lx-item-count')!
      badge.textContent = String(c)
      badge.setAttribute('aria-label', `${c} ${datasetWord(c)}`)
    }
    for (const a of root.querySelectorAll<SVGAElement>('[data-ip]')) {
      const it = byCode.get(a.dataset.ip!)!
      const c = n(it.code)
      a.setAttribute('aria-label', `${it.name}, ${it.country} — ${c} ${datasetWord(c)}`)
    }
    // the selector lists the landscapes with most data first
    const order = byDatasetCount(data.items, idx).map((it) => it.code)
    list.sort((a, b) => order.indexOf(a.dataset.code!) - order.indexOf(b.dataset.code!))
    list[0]?.parentElement?.append(...list)
    countTo(countOf(current.code))
    updateMapSection()
  }

  // collapse / expand the section menu (remembered on this device only)
  const lxBody = $('.lx-body')
  const toggle = $<HTMLButtonElement>('[data-secnav-toggle]')
  const setCollapsed = (on: boolean) => {
    lxBody.classList.toggle('is-collapsed', on)
    toggle.setAttribute('aria-expanded', String(!on))
    toggle.setAttribute('aria-label', on ? 'Expand the section menu' : 'Collapse the section menu')
    requestAnimationFrame(() => { placePin(); updateScale(); queueLabels() })
  }
  try { if (localStorage.getItem('mosaic.lx.collapsed') === '1') setCollapsed(true) } catch { /* storage unavailable */ }
  toggle.addEventListener('click', () => {
    const on = !lxBody.classList.contains('is-collapsed')
    setCollapsed(on)
    try { localStorage.setItem('mosaic.lx.collapsed', on ? '1' : '0') } catch { /* storage unavailable */ }
  })

  /* ---------- zoom & pan ---------- */
  // The + button zooms towards the landscape itself, not the middle of the
  // country, so a few clicks always land on it.
  $('[data-zoom="in"]').addEventListener('click', () => zoomIntoLandscape())
  $('[data-zoom="out"]').addEventListener('click', () => zoomBy(2))
  $('[data-zoom="fit"]').addEventListener('click', fit)
  $('[data-reset]').addEventListener('click', fit)
  svg.addEventListener('dblclick', (e) => { const [x, y] = toUnits(e); zoomBy(e.shiftKey ? 2 : 0.5, x, y) })
  const hint = $('[data-hint]')
  let hintTimer = 0
  svg.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) {
      // plain scroll keeps scrolling the page; say how to zoom instead
      hint.classList.add('is-on'); window.clearTimeout(hintTimer)
      hintTimer = window.setTimeout(() => hint.classList.remove('is-on'), 1400)
      return
    }
    e.preventDefault()
    const [x, y] = toUnits(e)
    zoomBy(Math.exp(e.deltaY * 0.01), x, y, 120)
  }, { passive: false })
  // Mouse/pen: drag to pan. Touch: one finger scrolls the page, two fingers
  // pinch and pan the map.
  const pointers = new Map<number, { x: number; y: number }>()
  let pinch: { d: number; mx: number; my: number } | null = null
  svg.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (e.pointerType !== 'touch' || pointers.size === 2) { stopCam(); svg.setPointerCapture(e.pointerId); svg.classList.add('is-dragging') }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }
    }
  })
  svg.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId)
    if (!prev) return
    const k = 1 / pxPerUnit()
    if (pointers.size === 1 && e.pointerType !== 'touch' && svg.classList.contains('is-dragging')) {
      panBy(-(e.clientX - prev.x) * k, -(e.clientY - prev.y) * k)
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2 && pinch) {
      e.preventDefault()
      const [a, b] = [...pointers.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
      panBy(-(mx - pinch.mx) * k, -(my - pinch.my) * k)
      const [x, y] = toUnits({ clientX: mx, clientY: my })
      zoomBy(pinch.d / d, x, y, 0)
      pinch = { d, mx, my }
    }
  })
  const release = (e: PointerEvent) => {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinch = null
    if (pointers.size === 0) { svg.classList.remove('is-dragging'); updateZoomButtons() }
  }
  svg.addEventListener('pointerup', release)
  svg.addEventListener('pointercancel', release)
  svg.addEventListener('keydown', (e) => {
    const k = 40 / pxPerUnit()
    const m: Record<string, () => void> = {
      '+': zoomIntoLandscape, '=': zoomIntoLandscape, '-': () => zoomBy(2), '0': fit,
      ArrowLeft: () => panBy(-k, 0), ArrowRight: () => panBy(k, 0), ArrowUp: () => panBy(0, -k), ArrowDown: () => panBy(0, k),
    }
    if (m[e.key]) { e.preventDefault(); m[e.key]() }
  })

  // first paint
  renderResources(current)
  setView(restView(current))
  updateZoomButtons()
  for (const g of globePaths) g.el.classList.toggle('is-home', current.countries.includes(g.iso))
  drawGlobe(rot[0], rot[1])
  restartAuto(current)
  new ResizeObserver(() => { placePin(); updateScale(); queueLabels() }).observe(svg)

  // deep links: /landscapes#COL-CUM and /landscapes#COL-CUM/knowledge-hub;
  // an empty address returns to the start screen; other anchors (#download) leave it as is
  function fromHash() {
    const [c, sec] = decodeURIComponent(location.hash.slice(1)).split('/')
    if (byCode.has(c)) {
      select(c, { push: false })
      showSection(sec || 'overview', { push: false })
    } else if (!c) enterIntro()
  }
  live.index().then(applyIndex, () => { /* counts stay as dashes, the map section stays hidden */ })
  if (intro) markListed(null)
  else fromHash()
  window.addEventListener('hashchange', fromHash)

  // "See all landscapes": back to the start screen (a history entry, so Back returns)
  root.querySelector('[data-gm-all]')?.addEventListener('click', (e) => {
    e.preventDefault()
    history.pushState(null, '', location.pathname + location.search)
    enterIntro()
  })
  window.addEventListener('popstate', () => { if (!location.hash) enterIntro() })
}
