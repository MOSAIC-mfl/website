/**
 * The map explorer of a landscape profile (container). Builds the engine, the data source and the
 * controller from the profile's configuration, then draws the explorer's layout: its bar, the layer
 * rail, the map and what floats over it. All behaviour lives in ExplorerController.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { HttpDataSource } from '../adapters/data'
import { MapLibreEngine } from '../adapters/maplibre/engine'
import { ExplorerController, type RailItem } from '../application/explorer'
import { AssetRouter } from '../domain/assets'
import type { Chapter, ExplorerConfig, ModuleOptions, StudyCard } from '../domain/config'
import { Options } from '../domain/options'
import { applyPlugin } from '../plugins'
import { coreRegistry, type ModuleRegistry } from '../renderers/registry'
import { AboutPanel } from './AboutPanel'
import { Blocks } from './Blocks'
import { Legend, Notices, Popover, SidePanel, TimeBar } from './MapChrome'
import { Rail } from './Rail'
import { StoryDrawer, type StoryActions } from './StoryDrawer'

export interface ExplorerProps {
  config: ExplorerConfig
  /** landscape code: selects the profile plugin */
  code: string
  credits: { name: string; role?: string; url?: string }[]
  /** development: serve every data file from this folder */
  dataOverride: string | null
  recordHref: (gid: string) => string
}

const narrow = () => window.matchMedia('(max-width: 900px)').matches

function useController(props: ExplorerProps, container: React.RefObject<HTMLDivElement>) {
  const { config, code, dataOverride } = props
  const [state, setState] = useState<{ controller: ExplorerController; registry: ModuleRegistry } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let disposed = false
    let ctl: ExplorerController | null = null
    ;(async () => {
      const registry = coreRegistry()
      await applyPlugin(code, registry)
      if (disposed || !container.current) return
      const assets = new AssetRouter(config.data, dataOverride)
      const m = config.map
      const engine = new MapLibreEngine({
        container: container.current,
        style: ExplorerController.baseStyle(config, assets),
        camera: { lng: m.center[0], lat: m.center[1], zoom: m.zoom, pitch: m.pitch, bearing: m.bearing },
        minZoom: m.min_zoom,
        maxZoom: m.max_zoom,
        maxPitch: m.max_pitch,
        maxBounds: m.max_bounds,
        terrain: m.terrain ? { source: m.terrain.source, exaggeration: m.terrain.exaggeration ?? 1 } : undefined,
      })
      ctl = new ExplorerController({
        config,
        registry,
        engine,
        assets,
        data: new HttpDataSource(assets),
        isNarrow: narrow,
        location: {
          get hash() {
            return window.location.hash
          },
          replace: (hash) => window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`),
        },
      })
      setState({ controller: ctl, registry })
      await ctl.start()
    })().catch((err) => !disposed && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      disposed = true
      ctl?.destroy()
    }
  }, [config, code, dataOverride, container])
  return { ...state, error }
}

export default function ExplorerApp(props: ExplorerProps) {
  const { config } = props
  const mapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const { controller, registry, error } = useController(props, mapRef)
  const noop = useCallback(() => () => {}, [])
  const s = useSyncExternalStore(controller?.store.subscribe ?? noop, () => controller?.store.get() ?? null)

  // Escape closes the menu and the floating panels (as in the explorer)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && controller) {
        controller.setMenu(false)
        controller.closeFloating()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [controller])

  const actions: StoryActions | null = useMemo(() => {
    if (!controller || !registry) return null
    const data = controller.ctx.data
    return {
      enterChapter: (ch: Chapter) => void controller.enterChapter(ch),
      playStep: (step, ch) => void controller.playStep(step, ch),
      exploreFrom: (ch: Chapter) => void controller.applyScene(controller.chapterScene(ch), null).then(() => controller.closeFloating()),
      showCard: (card: StudyCard, layer: string | null) => void controller.showCard(card, layer),
      overlayTitle: (id: string) => config.overlays.find((o) => o.id === id)?.title,
      overlayAvailable: (id: string) => controller.overlayAvailable(id),
      buildChart: async (cfg: ModuleOptions) => {
        const b = registry.chart(String(cfg.builder))
        if (!b) throw new Error(`no chart builder '${String(cfg.builder)}'`)
        return b(new Options(cfg, 'story.chart'), data)
      },
      json: <T,>(path: string) => data.json<T>(path),
      assetUrl: (path: string) => data.url(path),
      report: config.data.report,
    }
  }, [controller, registry, config])

  const onRail = (item: RailItem) => {
    if (!controller) return
    if (item.role === 'toggle') controller.toggle(item.id)
    else if (item.role === 'panel') void controller.openPanel(item.id, true)
    else void controller.toggleOverlay(item.id)
    if (narrow() && window.matchMedia('(max-width: 480px)').matches) controller.setMenu(false)
  }

  const floating = s?.floating ?? 'none'
  const panelId = floating.startsWith('panel:') ? floating.slice(6) : null
  const panel = panelId ? controller?.panels.get(panelId) : null
  const panelState = panelId ? s?.panels[panelId] : undefined
  const storyOn = floating === 'stories' && s?.storyTab === 'story' && !!config.story
  const size = { width: canvasRef.current?.clientWidth ?? 800, height: canvasRef.current?.clientHeight ?? 600 }
  const terrain = config.map.terrain
  const hasStories = !!(config.story || config.studies)

  return (
    <div className="lvx" data-story={storyOn ? 'on' : 'off'} data-comparing={s?.comparing ? 'on' : 'off'}>
      <div className="lvx-bar">
        <button
          className="menu-btn"
          type="button"
          aria-label={s?.menuOpen ? 'Close menu' : 'Menu'}
          aria-expanded={!!s?.menuOpen}
          onClick={() => controller?.setMenu(!s?.menuOpen)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d={s?.menuOpen ? 'M3 3l10 10M13 3L3 13' : 'M2 4h12M2 8h12M2 12h12'} />
          </svg>
        </button>
        <h2>{config.title}</h2>
        <div className="lvx-bar-actions">
          {hasStories && (
            <button
              className="nav-btn"
              type="button"
              aria-expanded={floating === 'stories'}
              aria-controls="lvx-stories"
              onClick={() => controller?.setFloating(floating === 'stories' ? 'none' : 'stories')}
            >
              <span className="when-wide">Uses &amp; studies</span>
              <span className="when-narrow">Studies</span>
            </button>
          )}
          {config.data.report && (
            <a className="lvx-bar-link" href={config.data.report} target="_blank" rel="noopener noreferrer">
              Data report
            </a>
          )}
        </div>
      </div>
      <div className="shell">
        <Rail
          groups={controller && s ? controller.rail() : []}
          tagline={config.tagline}
          open={!!s?.menuOpen}
          terrain={terrain ? { min: terrain.min ?? 1, max: terrain.max ?? 4, step: terrain.step ?? 0.1, value: s?.exaggeration ?? terrain.exaggeration ?? 1 } : null}
          onItem={onRail}
          onTerrain={(v) => controller?.setExaggeration(v)}
          onAbout={() => controller?.setFloating(floating === 'about' ? 'none' : 'about')}
        />
        {/* not <main>: the page has its own, and the site's reveal-on-scroll styles hide the children of any main */}
        <div className="canvas" ref={canvasRef}>
          <div className="map" ref={mapRef} role="application" aria-label={`Map: ${config.title}`} />
          {error && <div className="notice">The explorer could not start: {error}</div>}
          {s && controller && (
            <>
              <Notices items={s.notices} />
              <TimeBar control={controller.timeControl()} onInput={(i) => void controller.time(i)} />
              <Legend model={controller.legend()} onVariant={(v) => void controller.setVariant(v)} />
              <div className="attrib">{controller.attribution()}</div>
              {floating === 'popover' && s.inspection && s.popoverAt && <Popover inspection={s.inspection} at={s.popoverAt} size={size} />}
              {floating === 'cell' && s.inspection && (
                <SidePanel title={s.inspection.title} subtitle={s.inspection.hint} label="Location details" onClose={() => controller.closeFloating()}>
                  <Blocks blocks={s.inspection.blocks} />
                </SidePanel>
              )}
              {panel && (
                <SidePanel title={panel.heading().title} subtitle={panel.heading().subtitle} label={panel.config.title} onClose={() => controller.closeFloating()}>
                  {panelState?.content ? (
                    <Blocks blocks={panelState.content.blocks} />
                  ) : panelState?.error ? (
                    <div className="empty">{String(panel.config.empty ?? 'Not available in this version.')}</div>
                  ) : (
                    <p className="p-meta">Loading…</p>
                  )}
                </SidePanel>
              )}
              {floating === 'about' && (
                <SidePanel title="About & sources" label="About and sources" onClose={() => controller.closeFloating()}>
                  <AboutPanel
                    intro={config.about.intro}
                    licence={config.about.licence}
                    sources={config.about.sources}
                    report={config.data.report}
                    credits={props.credits}
                    recordHref={props.recordHref}
                  />
                </SidePanel>
              )}
              {floating === 'stories' && actions && (
                <StoryDrawer
                  story={config.story}
                  studies={config.studies}
                  tab={config.story ? s.storyTab : 'studies'}
                  activeChapter={s.chapter}
                  activeOverlay={s.overlay}
                  onTab={(t) => controller.setStoryTab(t)}
                  onClose={() => controller.closeFloating()}
                  actions={actions}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
