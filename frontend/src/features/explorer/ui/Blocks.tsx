/** Draws panel content (blocks) with the explorer's own markup and classes. */
import type { Block, Kpi } from '../domain/blocks'
import { Chart } from './Chart'

function Kpis({ items }: { items: Kpi[] }) {
  return (
    <div className="kpis">
      {items.map((k, i) => (
        <div key={i} className={k.lead ? 'lead' : undefined}>
          <div className="label">{k.label}</div>
          <div className="value num" style={k.size ? { fontSize: k.size } : undefined} title={k.value}>
            {k.value} {k.unit && <span className="unit">{k.unit}</span>}
          </div>
          {k.sub && <div className="sub">{k.sub}</div>}
        </div>
      ))}
    </div>
  )
}

export function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'kpis':
      return <Kpis items={block.items} />
    case 'chart':
      return (
        <div className="chart-block">
          {block.title && <h3>{block.title}</h3>}
          <Chart spec={block.spec} />
          {block.meta && <p className="meta">{block.meta}</p>}
        </div>
      )
    case 'multiples':
      return (
        <div className="chart-block">
          <h3>{block.title}</h3>
          <div className="mini-grid">
            {block.items.map((m) => (
              <div key={m.title} className="mini-cell">
                <div className="mini-title">
                  {m.title} <span className="num">{m.total}</span>
                </div>
                <Chart spec={m.spec} />
              </div>
            ))}
          </div>
        </div>
      )
    case 'rows':
      return (
        <>
          {block.rows.map(([k, v]) => (
            <div className="row" key={k}>
              <span>{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </>
      )
    case 'pill-note':
      return (
        <p className="p-meta">
          <span className="pill review">{block.pill}</span> {block.text}
        </p>
      )
    case 'note':
      if (block.tone === 'empty') return <div className="empty">{block.text}</div>
      if (block.tone === 'caveat') return <p className="story-caveat">{block.text}</p>
      return <p className="p-meta">{block.text}</p>
  }
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </>
  )
}
