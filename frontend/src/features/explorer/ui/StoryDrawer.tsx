/**
 * "Uses & studies": the Story tab (scroll-driven chapters that set the map) and the Studies tab
 * (question cards with verified findings). Ported from the explorer's stories.js; the rules it
 * carried (study numbers with page, app numbers with method, pending chapters as placeholders) stay.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Block } from '../domain/blocks'
import type { Chapter, ChapterStep, ModuleOptions, StoryConfig, StoryNumber, StudiesConfig, StudyCard } from '../domain/config'
import { Blocks } from './Blocks'

export interface StoryActions {
  enterChapter(ch: Chapter): void
  playStep(step: ChapterStep, ch: Chapter): void
  exploreFrom(ch: Chapter): void
  showCard(card: StudyCard, layer: string | null): void
  overlayTitle(id: string): string | undefined
  overlayAvailable(id: string): boolean
  buildChart(cfg: ModuleOptions): Promise<Block[]>
  json<T>(path: string): Promise<T>
  assetUrl(path: string): string
  report?: string
}

interface Props {
  story: StoryConfig | null
  studies: StudiesConfig | null
  tab: 'story' | 'studies'
  activeChapter: string | null
  activeOverlay: string | null
  onTab(tab: 'story' | 'studies'): void
  onClose(): void
  actions: StoryActions
}

function Pending() {
  return <span className="pill review">pending</span>
}

function NumberRow({ n, report }: { n: StoryNumber; report?: string }) {
  const src = n.source
  return (
    <div className="story-num">
      <span className="story-num-val num">{n.value}</span>
      <div className="story-num-body">
        {n.label}
        {src?.kind === 'study' && (
          <div className="p-meta">
            {src.citation}
            {src.page ? ` · ${src.page}` : ''}
          </div>
        )}
        {src?.kind === 'app' && (
          <div className="p-meta">
            this app&apos;s analysis — {src.method}
            {report && (
              <>
                {' · '}
                <a href={report} target="_blank" rel="noopener noreferrer">
                  data report
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ChapterCharts({ charts, build }: { charts: ModuleOptions[]; build: StoryActions['buildChart'] }) {
  const [blocks, setBlocks] = useState<Block[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    Promise.all(charts.map(build))
      .then((b) => live && setBlocks(b.flat()))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [charts, build])
  if (failed) return <div className="empty">Chart data not available.</div>
  return <div className="chapter-chart">{blocks && <Blocks blocks={blocks} />}</div>
}

/** People in cells flooded in >= N years: the reader picks N and the area (prep/13_exposure.py). */
function ExposureCounter({ cfg, actions }: { cfg: Record<string, unknown>; actions: StoryActions }) {
  const [doc, setDoc] = useState<{ regions: Record<string, Record<string, number>>; method?: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const nValues = (cfg.n_values as number[]) ?? [1, 2, 3, 5]
  const [n, setN] = useState<number>((cfg.default_n as number) ?? 1)
  const [region, setRegion] = useState<string | null>(null)
  useEffect(() => {
    actions
      .json<{ regions: Record<string, Record<string, number>>; method?: string }>(String(cfg.series))
      .then(setDoc)
      .catch(() => setFailed(true))
  }, [cfg.series, actions])
  if (failed) return <div className="empty">Exposure data not available.</div>
  if (!doc) return null
  const regions = Object.keys(doc.regions)
  const r = region ?? regions[0]
  const short = (x: string) => (x === 'Lake Victoria Basin' ? 'Whole basin' : x)
  const years = (v: number) => `≥ ${v} ${v === 1 ? 'year' : 'years'}`
  const label = String(cfg.label ?? '').replace('≥ N years', years(n))
  return (
    <div className="story-exposure">
      <div className="story-actions">
        <div className="seg" role="group" aria-label="Years flooded">
          {nValues.map((v) => (
            <button key={v} type="button" aria-pressed={v === n} onClick={() => setN(v)}>
              {years(v)}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Area">
          {regions.map((x) => (
            <button key={x} type="button" aria-pressed={x === r} onClick={() => setRegion(x)}>
              {short(x)}
            </button>
          ))}
        </div>
      </div>
      <NumberRow
        n={{ value: Number(doc.regions[r][String(n)] ?? 0).toLocaleString('en-US'), label: `${short(r)}: ${label}`, source: { kind: 'app', method: doc.method ?? '' } }}
        report={actions.report}
      />
      {typeof cfg.note === 'string' && <p className="stories-note">{cfg.note}</p>}
    </div>
  )
}

function ChapterView({ ch, active, actions, onFigure }: { ch: Chapter; active: boolean; actions: StoryActions; onFigure: (src: string, alt: string) => void }) {
  const v = ch.visual ?? {}
  const ready = ch.status !== 'pending'
  return (
    <section className={`chapter${active ? ' active' : ''}`} data-id={ch.id}>
      <h3 className="chapter-title">
        {ch.title} {ch.status === 'pending' && <Pending />}
        {ch.status === 'provisional' && <span className="pill review">provisional</span>}
      </h3>
      <p className="chapter-text">{ch.text}</p>
      {!ready && ch.placeholder && <div className="story-placeholder">{ch.placeholder}</div>}
      {ready && v.figure && (
        <img
          className="chapter-figure"
          src={actions.assetUrl(v.figure)}
          alt={v.alt ?? ch.title}
          loading="lazy"
          title="Click to enlarge"
          onClick={() => onFigure(actions.assetUrl(v.figure!), v.alt ?? ch.title)}
        />
      )}
      {ready && v.charts && <ChapterCharts charts={v.charts} build={actions.buildChart} />}
      {ready && v.steps?.length ? (
        <div className="story-actions">
          {v.steps.map((s) => (
            <button key={s.label} type="button" className="story-chip" onClick={() => actions.playStep(s, ch)}>
              {s.label}
            </button>
          ))}
        </div>
      ) : null}
      {v.note && <p className="stories-note">{v.note}</p>}
      {v.pending_note && <p className="stories-note">{v.pending_note}</p>}
      {ready && v.exposure && <ExposureCounter cfg={v.exposure} actions={actions} />}
      {(ch.numbers ?? []).map((n, i) => (
        <NumberRow key={i} n={n} report={actions.report} />
      ))}
      {ch.sources?.length ? (
        <details className="sources">
          <summary>Sources</summary>
          {ch.sources.map((s, i) => (
            <p key={i}>{s}</p>
          ))}
        </details>
      ) : null}
      {v.action === 'explore' && (
        <div className="story-actions">
          <button type="button" className="story-show" onClick={() => actions.exploreFrom(ch)}>
            Open the explorer at this view
          </button>
        </div>
      )}
    </section>
  )
}

function StoryTab({ story, active, actions, bodyRef, onFigure }: { story: StoryConfig; active: string | null; actions: StoryActions; bodyRef: React.RefObject<HTMLDivElement>; onFigure: (s: string, a: string) => void }) {
  const current = useRef<string | null>(null)
  useEffect(() => {
    const root = bodyRef.current
    if (!root) return
    // a chapter is applied when it reaches a thin band near the top third of the drawer
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          const id = (en.target as HTMLElement).dataset.id ?? null
          if (en.isIntersecting && id && id !== current.current) {
            current.current = id
            // IO callbacks run inside the browser's rendering steps (and MapLibre's frame): defer
            setTimeout(() => {
              const ch = story.chapters.find((c) => c.id === id)
              if (ch && current.current === id) actions.enterChapter(ch)
            }, 0)
          }
        }
      },
      { root, rootMargin: '-30% 0px -62% 0px', threshold: 0 },
    )
    root.querySelectorAll('.chapter').forEach((c) => io.observe(c))
    // the first chapter is the opening state, before any scroll
    current.current = story.chapters[0].id
    setTimeout(() => current.current === story.chapters[0].id && actions.enterChapter(story.chapters[0]), 0)
    return () => io.disconnect()
  }, [story, actions, bodyRef])
  return (
    <>
      {story.chapters.map((ch) => (
        <ChapterView key={ch.id} ch={ch} active={ch.id === active} actions={actions} onFigure={onFigure} />
      ))}
      {story.note && <p className="stories-note">{story.note}</p>}
      <div className="story-spacer" />
    </>
  )
}

function StudiesTab({ studies, activeOverlay, actions }: { studies: StudiesConfig; activeOverlay: string | null; actions: StoryActions }) {
  const [open, setOpen] = useState<string | null>(null)
  const hit = (c: StudyCard) => !!activeOverlay && (c.layers ?? []).includes(activeOverlay)
  const cards = [...studies.cards.filter(hit), ...studies.cards.filter((c) => !hit(c))]
  const activeTitle = activeOverlay ? actions.overlayTitle(activeOverlay) : undefined
  return (
    <>
      {activeTitle && studies.cards.some(hit) && (
        <p className="stories-note">
          Cards about <strong>{activeTitle}</strong> first.
        </p>
      )}
      {cards.map((c) => {
        const expanded = open === c.id
        const layers = (c.layers ?? []).filter((id) => actions.overlayAvailable(id))
        const missing = (c.layers ?? []).filter((id) => !actions.overlayAvailable(id))
        return (
          <article className="story-card" data-kind={c.kind} key={c.id}>
            <button type="button" className="story-head" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : c.id)}>
              <span className="story-q">{c.question}</span>
              <span className={`pill${c.kind === 'published' ? ' validated' : ''}`}>{c.kind === 'published' ? 'study' : 'explore'}</span>
              {c.steps || c.map_note || c.data_note ? (
                <span className="pill" title={layers.length ? 'Opens a layer of this app on the map' : "No map layer: the study's data are not in this app"}>
                  {layers.length ? 'Map' : 'Reference'}
                </span>
              ) : null}
            </button>
            {expanded && (
              <div className="story-body">
                {c.finding && <p className="story-finding">{c.finding}</p>}
                {c.caveat && <p className="story-caveat">Caveat: {c.caveat}</p>}
                {c.citation && (
                  <p className="p-meta">
                    {c.citation}
                    {c.doi && (
                      <>
                        {' · '}
                        <a href={`https://doi.org/${c.doi}`} target="_blank" rel="noopener noreferrer">
                          doi:{c.doi}
                        </a>
                      </>
                    )}
                  </p>
                )}
                <div className="story-actions">
                  {layers.length && c.steps?.length ? (
                    c.steps
                      .filter((st) => !st.layer || actions.overlayAvailable(st.layer))
                      .map((st) => (
                        <button
                          key={st.label}
                          type="button"
                          className="story-show"
                          onClick={() => actions.showCard({ ...c, time: st.time ?? c.time, camera: st.camera ?? c.camera }, st.layer ?? layers[0])}
                        >
                          {st.label}
                        </button>
                      ))
                  ) : layers.length || c.camera || c.open_panel ? (
                    <>
                      <button type="button" className="story-show" onClick={() => actions.showCard(c, layers[0] ?? null)}>
                        Show me on the map
                      </button>
                      {layers.slice(1).map((id) => (
                        <button key={id} type="button" className="story-chip" title="Switch the map to this layer" onClick={() => actions.showCard(c, id)}>
                          {actions.overlayTitle(id) ?? id}
                        </button>
                      ))}
                    </>
                  ) : c.data_note ? null : (
                    <span className="p-meta">Not in the app yet — no layer to show.</span>
                  )}
                </div>
                {c.map_note && <p className="p-meta">{c.map_note}</p>}
                {!layers.length && c.data_note && <p className="p-meta">{c.data_note}</p>}
                {missing.length > 0 && <p className="p-meta">Layer not built in this copy: {missing.join(', ')}</p>}
              </div>
            )}
          </article>
        )
      })}
      {studies.note && <p className="stories-note">{studies.note}</p>}
    </>
  )
}

export function StoryDrawer({ story, studies, tab, activeChapter, activeOverlay, onTab, onClose, actions }: Props) {
  const body = useRef<HTMLDivElement>(null)
  const [figure, setFigure] = useState<{ src: string; alt: string } | null>(null)
  const isStory = tab === 'story' && !!story
  const index = story && activeChapter ? story.chapters.findIndex((c) => c.id === activeChapter) + 1 : 1
  return (
    <section className="rside panel" id="lvx-stories" aria-label="Uses and studies">
      <header className="rside-head">
        <div>
          <h2>{isStory ? story!.title : 'Uses & studies'}</h2>
          <p className="meta">
            {isStory
              ? `Chapter ${index} / ${story!.chapters.length} · the map follows the scroll`
              : 'Questions this app helps answer, with published findings where they exist'}
          </p>
        </div>
        <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
      </header>
      <div className="rside-body" ref={body}>
        {story && studies && (
          <div className="seg story-tabs" role="tablist">
            <button type="button" role="tab" aria-pressed={tab === 'story'} aria-selected={tab === 'story'} onClick={() => onTab('story')}>
              Story
            </button>
            <button type="button" role="tab" aria-pressed={tab === 'studies'} aria-selected={tab === 'studies'} onClick={() => onTab('studies')}>
              Studies
            </button>
          </div>
        )}
        {isStory ? (
          <StoryTab story={story!} active={activeChapter} actions={actions} bodyRef={body} onFigure={(src, alt) => setFigure({ src, alt })} />
        ) : studies ? (
          <StudiesTab studies={studies} activeOverlay={activeOverlay} actions={actions} />
        ) : (
          <div className="empty">No studies registered yet.</div>
        )}
      </div>
      {figure &&
        createPortal(
          <button type="button" className="lvx-fig-overlay" onClick={() => setFigure(null)}>
            <img src={figure.src} alt={figure.alt} />
            <span>Click anywhere to close</span>
          </button>,
          document.body,
        )}
    </section>
  )
}
