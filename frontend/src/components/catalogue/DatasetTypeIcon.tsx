/**
 * DatasetTypeIcon — a small, honest marker of what KIND of data a record is.
 *
 * It replaces the former generative "satellite tile" thumbnail, which was
 * decorative: the coloured blobs carried no information and could be mistaken
 * for a real preview of the dataset. MOSAIC is a metadata network — it does
 * not hold renderable previews — so the row shows a glyph for the data type
 * (Raster / Vector / Tabular / Mixed) and nothing that looks like data.
 */

interface Props {
  type: string | null | undefined
}

const LABEL: Record<string, string> = {
  Raster: 'Raster dataset',
  Vector: 'Vector dataset',
  Tabular: 'Tabular dataset',
  Mixed: 'Mixed dataset',
}

function RasterGlyph() {
  // Pixel grid — a gridded surface.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
      <rect x="9" y="9" width="6" height="6" fill="currentColor" opacity="0.28" stroke="none" />
    </svg>
  )
}

function VectorGlyph() {
  // Polygon with vertex handles.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8.5 12 4l7 4.5-2.5 10h-9L5 8.5Z" />
      <circle cx="5" cy="8.5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="4" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="8.5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="18.5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="7.5" cy="18.5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

function TabularGlyph() {
  // Table with a header row.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 9h18M3 14.5h18M10 9v11" />
      <rect x="3" y="4" width="18" height="5" fill="currentColor" opacity="0.22" stroke="none" />
    </svg>
  )
}

function MixedGlyph() {
  // Stacked layers.
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z" />
      <path d="m3 12 9 4.5 9-4.5" />
      <path d="m3 16.5 9 4.5 9-4.5" />
    </svg>
  )
}

const GLYPH: Record<string, () => JSX.Element> = {
  Raster: RasterGlyph,
  Vector: VectorGlyph,
  Tabular: TabularGlyph,
  Mixed: MixedGlyph,
}

export function DatasetTypeIcon({ type }: Props) {
  const key = type && GLYPH[type] ? type : 'Mixed'
  const Glyph = GLYPH[key]
  return (
    <span className="ds-type-icon" title={LABEL[key]} aria-hidden="true">
      <Glyph />
    </span>
  )
}
