/** What floats over the map: legend, time bar, popover, side panel frame, notices, attribution. */
import type { ReactNode } from 'react'
import type { Inspection } from '../domain/blocks'
import type { LegendModel } from '../domain/legend'
import type { ScreenPoint } from '../ports/map-engine'
import type { TimeControl, TimeInput } from '../renderers/types'
import { Blocks } from './Blocks'

const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M2 2l8 8M10 2l-8 8" />
  </svg>
)

export function Legend({ model, onVariant }: { model: LegendModel | null; onVariant: (id: string) => void }) {
  if (!model) return null
  return (
    <div className="legend panel">
      <h3>{model.title}</h3>
      {model.switch && (
        <div className="seg" role="group" aria-label={model.switch.label}>
          {model.switch.options.map((o) => (
            <button key={o.id} type="button" aria-pressed={o.id === model.switch!.value} disabled={o.disabled} onClick={() => onVariant(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
      )}
      {model.kind === 'steps' ? (
        <>
          <div className="steps">
            {model.colors.map((c, i) => (
              <span key={i} style={{ background: c }} />
            ))}
          </div>
          <div className="axis">
            <span>{model.axis[0]}</span>
            <span>{model.axis[1]}</span>
          </div>
        </>
      ) : (
        model.rows.map((r) => (
          <div className="class-row" key={r.label}>
            <span style={{ background: r.color }} />
            <span>{r.label}</span>
          </div>
        ))
      )}
      {model.notes.map((n, i) => (
        <p className="src" key={i}>
          {n}
        </p>
      ))}
    </div>
  )
}

export function TimeBar({ control, onInput }: { control: TimeControl | null; onInput: (i: TimeInput) => void }) {
  if (!control) return <div className="timebar panel" hidden />
  return (
    <div className="timebar panel">
      {control.segments
        .filter((s) => !s.hidden)
        .map((s) => (
          <div className="seg" role="group" aria-label={s.label} key={s.id}>
            {s.options
              .filter((o) => !o.hidden)
              .map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={o.value === s.value}
                  disabled={o.disabled}
                  onClick={() => onInput({ type: 'segment', id: s.id, value: o.value })}
                >
                  {o.label}
                </button>
              ))}
          </div>
        ))}
      <div className="yearbox">
        <input
          type="range"
          aria-label="Time"
          min={control.slider.min}
          max={control.slider.max}
          step={control.slider.step}
          value={control.slider.value}
          onChange={(e) => onInput({ type: 'slider', value: Number(e.target.value) })}
        />
        <span className="num time-label">
          <strong>{control.caption.strong}</strong> · {control.caption.rest}
        </span>
      </div>
    </div>
  )
}

export function Popover({ inspection, at, size }: { inspection: Inspection; at: ScreenPoint; size: { width: number; height: number } }) {
  const left = Math.min(at.x + 12, size.width - 300)
  const top = Math.min(at.y + 12, size.height - 160)
  return (
    <div className="popover panel" style={{ left, top }} role="dialog" aria-label={inspection.title}>
      <h3>{inspection.title}</h3>
      <Blocks blocks={inspection.blocks} />
    </div>
  )
}

export function SidePanel(props: { id?: string; title: string; subtitle?: string; label: string; onClose: () => void; children: ReactNode }) {
  return (
    <section className="rside panel" id={props.id} aria-label={props.label}>
      <header className="rside-head">
        <div>
          <h2>{props.title}</h2>
          {props.subtitle && <p className="meta">{props.subtitle}</p>}
        </div>
        <button className="icon-btn" type="button" aria-label="Close" onClick={props.onClose}>
          <CloseIcon />
        </button>
      </header>
      <div className="rside-body">{props.children}</div>
    </section>
  )
}

export function Notices({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <div className="notice" role="status">
      {items.map((n) => (
        <div key={n}>{n}</div>
      ))}
    </div>
  )
}
