/** Colour ramps: a value in [0, 1] -> an interpolated colour (as the explorer's climate.js). */
type RGB = [number, number, number]

const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]

export function rampColor(ramp: readonly string[], t: number): RGB {
  const x = Math.min(Math.max(t, 0), 1) * (ramp.length - 1)
  const i = Math.floor(x)
  const f = x - i
  const [r1, g1, b1] = hex(ramp[Math.min(i, ramp.length - 1)])
  const [r2, g2, b2] = hex(ramp[Math.min(i + 1, ramp.length - 1)])
  return [r1 + (r2 - r1) * f, g1 + (g2 - g1) * f, b1 + (b2 - b1) * f]
}

export const css = ([r, g, b]: RGB, alpha = 1): string =>
  alpha === 1 ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${alpha})`

/** n swatches along a ramp, for a continuous legend. */
export const rampSteps = (ramp: readonly string[], n = 24): string[] =>
  Array.from({ length: n }, (_, i) => css(rampColor(ramp, i / (n - 1))))
