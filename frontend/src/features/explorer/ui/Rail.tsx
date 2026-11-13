/** The layer rail: groups of toggles, panels and overlays, the terrain control and About & sources. */
import type { RailItem } from '../application/explorer'

interface Props {
  groups: { group: string; items: RailItem[] }[]
  tagline?: string
  open: boolean
  terrain: { min: number; max: number; step: number; value: number } | null
  onItem: (item: RailItem) => void
  onTerrain: (v: number) => void
  onAbout: () => void
}

export function Rail({ groups, tagline, open, terrain, onItem, onTerrain, onAbout }: Props) {
  return (
    <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Layers and information">
      {tagline && <p className="finding">{tagline}</p>}
      <nav className="rail" aria-label="Layers">
        {groups.map((g) => (
          <div className="group" key={g.group}>
            <div className="group-label">{g.group}</div>
            {g.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`item${item.unavailable ? ' unavailable' : ''}`}
                aria-pressed={item.pressed}
                aria-disabled={!!item.unavailable}
                onClick={() => !item.unavailable && onItem(item)}
              >
                <span className="swatch" style={{ background: item.swatch }} />
                <span className="label">{item.title}</span>
                {item.unavailable && <span className="pill">{item.unavailable}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="rail-bottom">
        {terrain && (
          <div className="exag">
            <label htmlFor="lvx-exag">
              Terrain height <span className="num">×{terrain.value.toFixed(1)}</span>
            </label>
            <input
              id="lvx-exag"
              type="range"
              min={terrain.min}
              max={terrain.max}
              step={terrain.step}
              value={terrain.value}
              onChange={(e) => onTerrain(Number(e.target.value))}
            />
          </div>
        )}
        <button className="btn-text" type="button" onClick={onAbout}>
          About &amp; sources
        </button>
      </div>
    </aside>
  )
}
