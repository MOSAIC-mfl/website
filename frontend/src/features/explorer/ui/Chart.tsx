/** Draws a ChartSpec with the vendored chart module (it owns its element: it clears and redraws it). */
import { useEffect, useRef } from 'react'
import { bars, line } from '../charts/svg-charts'
import type { ChartSpec } from '../domain/blocks'

export function Chart({ spec }: { spec: ChartSpec }) {
  const mount = useRef<HTMLDivElement>(null)
  const legend = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = mount.current
    if (!el) return
    if (spec.kind === 'line') line(el, { ...spec.options, legend: spec.legend ? legend.current : null })
    else bars(el, spec.options)
  }, [spec])
  return (
    <>
      {spec.kind === 'line' && spec.legend && <div ref={legend} />}
      <div ref={mount} />
    </>
  )
}
