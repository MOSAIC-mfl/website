import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { webUrl } from '../src/features/explorer/domain/links'

describe('webUrl — only web addresses become links', () => {
  it('keeps http and https addresses', () => {
    expect(webUrl('https://github.com/MOSAIC-mfl')).toBe('https://github.com/MOSAIC-mfl')
    expect(webUrl('  HTTP://example.org/a ')).toBe('HTTP://example.org/a')
  })

  it('drops every other scheme and anything that is not text', () => {
    for (const bad of ['javascript:alert(1)', ' JavaScript:void(0)', 'data:text/html,x', 'mailto:a@b.org', '//example.org', '/local', 'example.org', ''])
      expect(webUrl(bad)).toBeUndefined()
    expect(webUrl(undefined)).toBeUndefined()
    expect(webUrl(null)).toBeUndefined()
    expect(webUrl({ href: 'https://example.org' })).toBeUndefined()
  })
})

describe('charts — text from data files is never written as HTML', () => {
  it('svg-charts.js only uses innerHTML to empty an element', () => {
    const source = readFileSync(new URL('../src/features/explorer/charts/svg-charts.js', import.meta.url), 'utf8')
    const writes = source.match(/\.innerHTML\s*\+?=\s*[^;]+/g) ?? []
    expect(writes.length).toBeGreaterThan(0)
    for (const write of writes) expect(write).toMatch(/\.innerHTML\s*=\s*''$/)
  })
})
