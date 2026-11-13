/**
 * The explorer's application service: the one place that changes what the map shows. Components call
 * its commands (select an overlay, move the time bar, click the map, open the story) and read its
 * state; renderers, inspectors and panels do the work for their own kind.
 *
 * It replaces the explorer's app.js wiring (window.* hooks, panels closing each other through the DOM)
 * with explicit state: one floating panel at a time, one active overlay, one time state per renderer.
 */
import type { StyleSpecification } from 'maplibre-gl'
import type { Inspection, PanelContent } from '../domain/blocks'
import type { Camera, Chapter, ChapterStep, ExplorerConfig, StudyCard } from '../domain/config'
import { fmtCoord, type LngLat } from '../domain/format'
import { formatHash, parseHash } from '../domain/hash'
import type { LegendModel } from '../domain/legend'
import type { AssetRouter } from '../domain/assets'
import type { DataSource } from '../ports/data'
import type { MapClick, MapEngine, Padding, ScreenPoint } from '../ports/map-engine'
import type { SidePanel } from '../panels/core'
import type { ModuleRegistry } from '../renderers/registry'
import type { ExplorerContext, OverlayRenderer, TimeControl, TimeInput } from '../renderers/types'
import { Store } from './store'

export type Floating = 'none' | 'popover' | 'cell' | 'about' | 'stories' | `panel:${string}`

export interface ExplorerState {
  ready: boolean
  /** overlay id -> available (absent while checking) */
  available: Record<string, boolean>
  overlay: string | null
  variants: Record<string, string>
  times: Record<string, unknown>
  toggles: Record<string, boolean>
  floating: Floating
  inspection: Inspection | null
  inspecting: boolean
  popoverAt: ScreenPoint | null
  panels: Record<string, { content?: PanelContent; error?: string }>
  storyTab: 'story' | 'studies'
  chapter: string | null
  exaggeration: number
  menuOpen: boolean
  comparing: boolean
  notices: string[]
}

export interface RailItem {
  id: string
  title: string
  swatch: string
  role: 'toggle' | 'panel' | 'overlay'
  pressed: boolean
  unavailable?: string
}

export interface Scene {
  layers?: string[]
  time?: Record<string, string | number>
  camera?: Camera
  show?: string[]
  compare?: { overlay: string; left_label?: string; right_label?: string }
  openPanel?: string
  /** the feature highlighted by story.map.focus (null: none) */
  focus?: string | null
}

const STORY_WIDE_PADDING = 424 // the drawer (400 px) and its margin, as in the explorer
const NO_PADDING: Padding = { top: 0, bottom: 0, left: 0, right: 0 }

export interface ExplorerDeps {
  config: ExplorerConfig
  registry: ModuleRegistry
  engine: MapEngine
  assets: AssetRouter
  data: DataSource
  /** sync the URL hash (off in tests) */
  location?: { hash: string; replace(hash: string): void }
  isNarrow?: () => boolean
}

export class ExplorerController {
  readonly store: Store<ExplorerState>
  readonly ctx: ExplorerContext
  readonly renderers: Map<string, OverlayRenderer>
  readonly panels: Map<string, SidePanel>
  private readonly config: ExplorerConfig
  private readonly engine: MapEngine
  private lastClick: LngLat | null = null
  private sceneTicket = 0
  private readonly shared = new Map<string, unknown>()
  private storyMode = false

  constructor(private readonly deps: ExplorerDeps) {
    const { config, registry, engine, assets, data } = deps
    this.config = config
    this.engine = engine
    this.ctx = {
      engine,
      assets,
      data,
      place: (ll) => this.place(ll),
      shared: <T>(key: string, make: () => T): T => {
        if (!this.shared.has(key)) this.shared.set(key, make())
        return this.shared.get(key) as T
      },
    }
    this.renderers = new Map()
    for (const o of config.overlays) {
      const r = registry.renderer(o)
      if (r) this.renderers.set(o.id, r)
      else console.warn(`explorer: no renderer for kind '${o.kind}' (overlay ${o.id})`)
    }
    this.panels = new Map()
    for (const p of config.panels) {
      const f = registry.panel(p.kind)
      if (f) this.panels.set(p.id, f(p))
    }
    const times: Record<string, unknown> = {}
    for (const r of this.renderers.values()) if (r.timeKey && !(r.timeKey in times)) times[r.timeKey] = r.initialTime()
    this.store = new Store<ExplorerState>({
      ready: false,
      available: {},
      overlay: null,
      variants: {},
      times,
      toggles: Object.fromEntries(config.toggles.map((t) => [t.id, t.default ?? false])),
      floating: 'none',
      inspection: null,
      inspecting: false,
      popoverAt: null,
      panels: {},
      storyTab: 'story',
      chapter: null,
      exaggeration: config.map.terrain?.exaggeration ?? 1,
      menuOpen: false,
      comparing: false,
      notices: [],
    })
  }

  // ---- start ---------------------------------------------------------------------------------------
  /** The base style (sources resolved to URLs); overlays are added after load by their renderers. */
  static baseStyle(config: ExplorerConfig, assets: AssetRouter): StyleSpecification {
    const m = config.map
    return {
      version: 8,
      sources: assets.sources(m.sources),
      layers: m.layers,
      ...(m.sky ? { sky: m.sky } : {}),
      ...(m.glyphs ? { glyphs: assets.glyphs(m.glyphs) } : {}),
    } as unknown as StyleSpecification
  }

  async start(): Promise<void> {
    await this.engine.ready
    const story = this.config.story?.map
    if (story) {
      for (const [id, spec] of Object.entries(this.deps.assets.sources(story.sources ?? {}))) this.engine.addSource(id, spec)
      for (const layer of story.layers ?? []) this.engine.addLayer(layer)
    }
    for (const r of this.renderers.values()) r.register(this.ctx)
    for (const t of this.config.toggles) for (const id of t.layers) this.engine.setVisible(id, this.store.get().toggles[t.id])
    for (const p of this.config.panels) {
      if (p.open_on_click) this.engine.onLayerClick(p.open_on_click, () => this.openPanel(p.id))
    }
    this.engine.onClick((e) => void this.click(e))
    this.store.set({ ready: true })
    void this.checkAvailability()
    await this.applyHash()
  }

  private async checkAvailability(): Promise<void> {
    await Promise.all(
      [...this.renderers.entries()].map(async ([id, r]) => {
        const ok = await r.available(this.ctx).catch(() => false)
        this.store.set((s) => ({ available: { ...s.available, [id]: ok } }))
      }),
    )
  }

  private async applyHash(): Promise<void> {
    if (!this.deps.location) return
    const h = parseHash(this.deps.location.hash, [...this.panels.keys()])
    if (h.camera) this.engine.jumpTo(h.camera)
    if (h.panel) void this.openPanel(h.panel)
    if (h.layer && this.renderers.has(h.layer)) {
      await this.renderers.get(h.layer)!.available(this.ctx)
      this.presetTime(h.layer, h.time)
      await this.selectOverlay(h.layer)
      if (h.cell) await this.inspectAt(h.cell, null)
    }
  }

  private writeHash(): void {
    if (!this.deps.location) return
    const s = this.store.get()
    const r = s.overlay ? this.renderers.get(s.overlay) : null
    const time = r && r.timeKey ? r.timeParams(s.times[r.timeKey]) : {}
    const panel = s.floating.startsWith('panel:') ? s.floating.slice(6) : undefined
    const cell = s.floating === 'cell' && this.lastClick ? this.lastClick : undefined
    this.deps.location.replace(formatHash({ layer: s.overlay ?? undefined, time, cell, panel }))
  }

  // ---- reading -------------------------------------------------------------------------------------
  private view(id: string) {
    const s = this.store.get()
    const r = this.renderers.get(id)!
    return { time: r.timeKey ? s.times[r.timeKey] : null, variant: s.variants[id] ?? null }
  }

  legend(): LegendModel | null {
    const id = this.store.get().overlay
    return id && this.renderers.has(id) ? this.renderers.get(id)!.legend(this.view(id)) : null
  }

  timeControl(): TimeControl | null {
    const id = this.store.get().overlay
    return id && this.renderers.has(id) ? this.renderers.get(id)!.timeControl(this.view(id)) : null
  }

  attribution(): string {
    const s = this.store.get()
    const parts = [this.config.map.attribution ?? '']
    const r = s.overlay ? this.renderers.get(s.overlay) : null
    const a = r?.attribution()
    if (a) parts.push(a)
    for (const t of this.config.toggles) if (s.toggles[t.id] && t.attribution) parts.push(t.attribution)
    return parts.filter(Boolean).join(' · ')
  }

  rail(): { group: string; items: RailItem[] }[] {
    const s = this.store.get()
    const items: (RailItem & { group: string })[] = []
    for (const t of this.config.toggles) {
      items.push({ group: t.group, id: t.id, title: t.title, swatch: t.swatch ?? '#999', role: 'toggle', pressed: s.toggles[t.id] })
    }
    for (const p of this.config.panels) {
      items.push({
        group: p.group,
        id: p.id,
        title: p.title,
        swatch: p.swatch ?? '#999',
        role: 'panel',
        pressed: s.floating === `panel:${p.id}`,
        unavailable: this.panels.has(p.id) ? undefined : 'not available',
      })
    }
    for (const o of this.config.overlays) {
      if ((o as { rail?: boolean }).rail === false) continue
      const ok = this.renderers.has(o.id) && s.available[o.id] !== false
      const legend = o.legend ?? o.variants?.[0]?.legend
      const colors = legend?.kind === 'steps' ? legend.colors : []
      items.push({
        group: o.group,
        id: o.id,
        title: o.title,
        swatch: o.swatch ?? colors[Math.floor(colors.length / 2)] ?? '#999',
        role: 'overlay',
        pressed: s.overlay === o.id,
        unavailable: ok ? undefined : /grid/.test(o.kind) ? 'preparing data' : 'not built',
      })
    }
    return this.config.groups
      .map((g) => ({ group: g, items: items.filter((i) => i.group === g) }))
      .filter((g) => g.items.length > 0)
  }

  /** "0.12° S, 34.50° E · Kisumu, Kenya" when the admin layer is shown */
  place(lngLat: LngLat): string {
    const a = this.adminAt(lngLat)
    return fmtCoord(lngLat) + (a ? ` · ${[a.adm2 || a.adm1, a.country].filter(Boolean).join(', ')}` : '')
  }

  private adminAt(lngLat: LngLat): { adm1?: string; adm2?: string; country?: string; iso?: string } | null {
    const admin = this.config.click.admin
    if (!admin) return null
    const gate = admin.visible_layer ?? admin.layers[0]
    if (!this.engine.isVisible(gate)) return null
    const hits = this.engine.queryAt(this.engine.project(lngLat), admin.layers)
    const [l2, l1] = admin.layers
    const a2 = hits.find((h) => h.layer === l2)?.properties
    const a1 = hits.find((h) => h.layer === l1)?.properties
    if (!a1 && !a2) return null
    const p = (a2 ?? a1)!
    const [f2, f1] = admin.name_fields ?? ['name', 'name']
    const text = (v: unknown) => (v == null ? undefined : String(v))
    return {
      adm1: text(a1?.[f1]),
      adm2: text(a2?.[f2]),
      country: text(p.country) ?? admin.country,
      iso: text(p.iso) ?? admin.iso,
    }
  }

  // ---- commands ------------------------------------------------------------------------------------
  async selectOverlay(id: string | null): Promise<void> {
    const s = this.store.get()
    if (id && this.engine.isComparing()) this.engine.closeCompare(false)
    if (s.overlay && s.overlay !== id) this.renderers.get(s.overlay)?.hide(this.ctx)
    const closeCell = s.floating === 'popover' || s.floating === 'cell'
    this.store.set({ overlay: id, popoverAt: null, ...(closeCell ? { floating: 'none', inspection: null } : {}) })
    if (id) {
      const r = this.renderers.get(id)
      if (!r) return
      try {
        await r.show(this.ctx, this.view(id))
      } catch (err) {
        this.notice(`${r.config.title}: ${err instanceof Error ? err.message : String(err)}`)
      }
      this.store.set({}) // the legend and time bar depend on data loaded by show()
    }
    this.writeHash()
  }

  async toggleOverlay(id: string): Promise<void> {
    await this.selectOverlay(this.store.get().overlay === id ? null : id)
  }

  async setVariant(variant: string): Promise<void> {
    const id = this.store.get().overlay
    if (!id) return
    this.store.set((s) => ({ variants: { ...s.variants, [id]: variant } }))
    await this.renderers.get(id)?.show(this.ctx, this.view(id))
    this.store.set({})
  }

  async time(input: TimeInput): Promise<void> {
    const id = this.store.get().overlay
    const r = id ? this.renderers.get(id) : null
    if (!r || !r.timeKey) return
    const key = r.timeKey
    this.store.set((s) => ({ times: { ...s.times, [key]: r.applyTime(s.times[key], input) } }))
    await r.show(this.ctx, this.view(id!))
    this.store.set({})
    if (this.store.get().floating === 'cell' && this.lastClick) await this.inspectAt(this.lastClick, null, false)
    this.writeHash()
  }

  private presetTime(overlay: string, params: Record<string, string | number>): void {
    const r = this.renderers.get(overlay)
    if (!r?.timeKey || !Object.keys(params).length) return
    const key = r.timeKey
    this.store.set((s) => ({ times: { ...s.times, [key]: r.presetTime(s.times[key], params) } }))
  }

  toggle(id: string): void {
    const t = this.config.toggles.find((x) => x.id === id)
    if (!t) return
    const on = !this.store.get().toggles[id]
    for (const layer of t.layers) this.engine.setVisible(layer, on)
    this.store.set((s) => ({ toggles: { ...s.toggles, [id]: on } }))
  }

  setExaggeration(v: number): void {
    this.engine.setTerrainExaggeration(v)
    this.store.set({ exaggeration: v })
  }

  setMenu(open: boolean): void {
    this.store.set({ menuOpen: open })
  }

  /** One floating panel at a time (popover, cell panel, a side panel, About, Uses & studies). */
  setFloating(f: Floating): void {
    const was = this.store.get().floating
    this.store.set({ floating: f, ...(f !== 'popover' && f !== 'cell' ? { inspection: null, popoverAt: null } : {}) })
    if ((was === 'stories') !== (f === 'stories')) this.syncStoryMode()
    this.writeHash()
  }

  closeFloating(): void {
    this.setFloating('none')
  }

  async openPanel(id: string, toggle = false): Promise<void> {
    const key = `panel:${id}` as const
    if (toggle && this.store.get().floating === key) return this.closeFloating()
    this.setFloating(key)
    const panel = this.panels.get(id)
    if (!panel || this.store.get().panels[id]?.content) return
    try {
      const content = await panel.load(this.ctx)
      this.store.set((s) => ({ panels: { ...s.panels, [id]: { content } } }))
    } catch (err) {
      this.store.set((s) => ({ panels: { ...s.panels, [id]: { error: err instanceof Error ? err.message : String(err) } } }))
    }
  }

  setStoryTab(tab: 'story' | 'studies'): void {
    this.store.set({ storyTab: tab })
    this.syncStoryMode()
  }

  // ---- clicks --------------------------------------------------------------------------------------
  private async click(e: MapClick): Promise<void> {
    this.setMenu(false)
    const hitPanel = this.config.panels.find((p) => p.open_on_click && this.engine.queryAt(e.point, [p.open_on_click]).length)
    if (hitPanel) return
    await this.inspectAt(e.lngLat, e.point)
  }

  private async inspectAt(lngLat: LngLat, point: ScreenPoint | null, open = true): Promise<void> {
    this.lastClick = lngLat
    const s = this.store.get()
    const r = s.overlay ? this.renderers.get(s.overlay) : null
    this.store.set({ inspecting: true })
    let result: Inspection | null = null
    try {
      result = r ? await r.inspect(this.ctx, lngLat, this.view(s.overlay!)) : null
      if (!result && (!r || !this.hasInspector(s.overlay!))) result = this.defaultPopover(lngLat)
    } catch (err) {
      result = { target: 'popover', title: r?.config.title ?? 'Location', blocks: [{ type: 'note', text: `Not available here (${err instanceof Error ? err.message : String(err)}).` }] }
    } finally {
      this.store.set({ inspecting: false })
    }
    if (!result) return
    if (!open && this.store.get().floating !== 'cell') return
    const at = point ?? this.engine.project(lngLat)
    this.setFloating(result.target === 'popover' ? 'popover' : 'cell')
    this.store.set({ inspection: result, popoverAt: result.target === 'popover' ? at : null })
  }

  private hasInspector(overlay: string): boolean {
    const o = this.config.overlays.find((x) => x.id === overlay)
    return !!o?.inspect || /grid/.test(o?.kind ?? '')
  }

  /** a click with no overlay: the place and its administrative units */
  private defaultPopover(lngLat: LngLat): Inspection {
    const c = this.config.click
    const rows: [string, string][] = [['Place', fmtCoord(lngLat)]]
    const a = this.adminAt(lngLat)
    if (a) {
      const [u1, u2] = (a.iso && c.admin?.units?.[a.iso]) || ['Admin 1', 'Admin 2']
      if (a.adm2) rows.push([u2, a.adm2])
      if (a.adm1) rows.push([u1, a.adm1])
      if (a.country) rows.push(['Country', a.country])
    }
    return { target: 'popover', title: c.title ?? 'Location', blocks: [{ type: 'rows', rows }, ...(c.source ? [{ type: 'note' as const, text: c.source }] : [])] }
  }

  // ---- story and studies ---------------------------------------------------------------------------
  storyPadding(): Padding {
    return this.deps.isNarrow?.()
      ? { ...NO_PADDING, bottom: Math.round(this.engine.containerHeight() * 0.5) }
      : { ...NO_PADDING, right: STORY_WIDE_PADDING }
  }

  private syncStoryMode(): void {
    const s = this.store.get()
    const on = s.floating === 'stories' && s.storyTab === 'story'
    if (on === this.storyMode) return
    this.storyMode = on
    const story = this.config.story?.map
    for (const id of story?.while_open ?? []) this.engine.setVisible(id, on)
    if (!on) {
      for (const ids of Object.values(story?.highlights ?? {})) for (const id of ids) this.engine.setVisible(id, false)
      for (const id of story?.focus?.layers ?? []) this.engine.setVisible(id, false)
      if (this.engine.isComparing()) this.engine.closeCompare(true)
      this.engine.setPadding(NO_PADDING)
      this.store.set({ chapter: null })
    }
  }

  overlayAvailable(id: string): boolean {
    return this.renderers.has(id) && this.store.get().available[id] !== false
  }

  /**
   * Puts the map in a chapter's or a card's state. Calls are serialised: one overtaken by a later
   * call stops at its next step (a fast scroll must not leave the map in an older chapter).
   */
  async applyScene(scene: Scene, padding: Padding | null): Promise<void> {
    const ticket = ++this.sceneTicket
    const stale = () => ticket !== this.sceneTicket
    const compare = scene.compare && this.overlayAvailable(scene.compare.overlay) ? scene.compare : null
    if (!compare && this.engine.isComparing()) this.engine.closeCompare(false)
    const layer = compare ? null : ((scene.layers ?? []).find((id) => this.overlayAvailable(id)) ?? null)
    if (layer && scene.time) this.presetTime(layer, scene.time)
    if (!layer && scene.time) for (const id of this.renderers.keys()) this.presetTime(id, scene.time)
    await this.selectOverlay(layer)
    if (stale()) return
    const highlights = this.config.story?.map?.highlights ?? {}
    for (const [name, ids] of Object.entries(highlights)) for (const id of ids) this.engine.setVisible(id, (scene.show ?? []).includes(name))
    this.setFocus(scene.focus ?? null)
    let opening: Promise<void> | null = null
    if (compare && !this.engine.isComparing()) {
      const r = this.renderers.get(compare.overlay)!
      opening = this.engine.compare({
        layers: r.layerIds(this.view(compare.overlay)),
        leftLabel: compare.left_label ?? '',
        rightLabel: compare.right_label ?? '',
        padding: padding ?? NO_PADDING,
        restorePitch: scene.camera?.pitch ?? 0,
        onClose: () => {
          this.store.set({ comparing: false })
          if (this.store.get().floating === 'stories') void this.selectOverlay(compare.overlay)
        },
      })
      this.store.set({ comparing: true })
    }
    if (scene.camera) this.engine.flyTo(scene.camera, padding ? { padding } : { duration: 1400 })
    await opening
    if (scene.openPanel) await this.openPanel(scene.openPanel)
  }

  chapterScene(ch: Chapter): Scene {
    const v = ch.visual ?? {}
    return { layers: v.layers, time: v.time, camera: v.camera, show: v.show, focus: v.focus ?? null, compare: ch.status !== 'pending' ? v.compare : undefined }
  }

  async enterChapter(ch: Chapter): Promise<void> {
    this.store.set({ chapter: ch.id })
    await this.applyScene(this.chapterScene(ch), this.storyPadding())
  }

  flyStep(camera: Camera): void {
    this.engine.flyTo(camera, { padding: this.storyPadding() })
  }

  /** a chapter's chip: its layer and time, the feature it is about, then the camera */
  async playStep(step: ChapterStep, ch: Chapter): Promise<void> {
    if (step.layer && this.overlayAvailable(step.layer)) {
      if (step.time) this.presetTime(step.layer, step.time)
      await this.selectOverlay(step.layer)
    }
    if (step.focus) {
      const v = ch.visual ?? {}
      const highlights = this.config.story?.map?.highlights ?? {}
      for (const name of v.show ?? []) for (const id of highlights[name] ?? []) this.engine.setVisible(id, true)
      this.setFocus(step.focus)
    }
    if (step.camera) this.flyStep(step.camera)
  }

  private setFocus(value: string | null): void {
    const f = this.config.story?.map?.focus
    if (!f) return
    for (const id of f.layers) {
      this.engine.setFilter(id, ['==', ['get', f.field], value ?? ''])
      this.engine.setVisible(id, value !== null && this.storyMode)
    }
  }

  /** "Show me on the map": the card's state; the drawer closes so the legend and time bar are in view */
  async showCard(card: StudyCard, layer: string | null): Promise<void> {
    await this.applyScene({ layers: layer ? [layer] : [], time: card.time, camera: card.camera, openPanel: card.open_panel }, null)
    if (!card.open_panel) this.closeFloating()
  }

  notice(text: string): void {
    this.store.set((s) => ({ notices: s.notices.includes(text) ? s.notices : [...s.notices, text] }))
  }

  destroy(): void {
    this.engine.destroy()
  }
}
