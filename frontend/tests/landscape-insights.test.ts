import { describe, expect, it } from 'vitest'
import type { LandscapePage, LandscapeSummary } from '../src/lib/api/types'
import type { LandscapeRepository } from '../src/lib/catalog/landscapes'
import { byDatasetCount, hasMapProfile, landscapeIndex, landscapeInsights } from '../src/lib/domain/landscape-insights'
import { VOCAB_LABELS } from '../src/lib/domain/vocab-labels'
import { apiExplorerData } from '../src/lib/ui/landscape-explorer-data'

const section = (kind: string) => ({ id: kind, kind, title: null, intro: null, config: {} })
const summary = (code: string, datasets: number, kinds: string[]) =>
  ({ code, counts: { datasets }, sections: kinds.map(section) }) as unknown as LandscapeSummary
const status = { total: 4, by_theme: { climate: 2, 'decision-support-outputs': 1, 'not-a-theme': 3 }, by_access: { public: 3, restricted: 1 } }

describe('landscape insights', () => {
  it('counts the themes of the standard with data, in vocabulary order, and the public datasets', () => {
    const ins = landscapeInsights(status, VOCAB_LABELS.theme)
    expect(ins.themes).toHaveLength(16)
    expect(ins.withData).toBe(2)
    expect(ins.missing).toHaveLength(14)
    expect(ins.missing[0]).toBe('Boundaries / admin units')
    expect(ins.missing).not.toContain('Climate')
    expect(ins).toMatchObject({ count: 4, open: 3 })
  })

  it('reads no open datasets when no access is public', () => {
    expect(landscapeInsights({ total: 1, by_theme: {}, by_access: { restricted: 1 } }, VOCAB_LABELS.theme).open).toBe(0)
  })

  it('knows which landscapes have a map profile, and their dataset counts', () => {
    const idx = landscapeIndex([summary('KEN-LVB', 13, ['map-explorer', 'data-status']), summary('COL-CUM', 1, ['overview'])])
    expect(idx.get('KEN-LVB')).toEqual({ count: 13, hasMap: true })
    expect(idx.get('COL-CUM')).toEqual({ count: 1, hasMap: false })
    expect(hasMapProfile({ sections: [] })).toBe(false)
  })

  it('lists the landscapes with most datasets first, then by name', () => {
    const idx = landscapeIndex([summary('A', 2, []), summary('B', 9, []), summary('C', 2, [])])
    const items = [{ code: 'C', name: 'Charlie' }, { code: 'A', name: 'Alpha' }, { code: 'B', name: 'Bravo' }, { code: 'X', name: 'Xray' }]
    expect(byDatasetCount(items, idx).map((i) => i.code)).toEqual(['B', 'A', 'C', 'X'])
  })
})

describe('apiExplorerData', () => {
  function fakeRepo(log: string[], fail = { list: 0 }): LandscapeRepository {
    return {
      async landscapes() {
        log.push('list')
        if (fail.list-- > 0) throw new Error('offline')
        return [summary('KEN-LVB', 13, ['map-explorer'])]
      },
      async landscape(code: string) {
        log.push(code)
        return code === 'KEN-LVB' ? ({ code, data_status: status } as unknown as LandscapePage) : null
      },
    }
  }

  it('asks mosaic-api once per page for the index and once per landscape for its coverage', async () => {
    const log: string[] = []
    const data = apiExplorerData(fakeRepo(log), VOCAB_LABELS.theme)
    await data.index()
    await data.index()
    expect((await data.insights('KEN-LVB'))?.withData).toBe(2)
    await data.insights('KEN-LVB')
    expect(await data.insights('NOPE')).toBeNull()
    expect(log).toEqual(['list', 'KEN-LVB', 'NOPE'])
  })

  it('forgets a failed request so the next call tries again', async () => {
    const log: string[] = []
    const data = apiExplorerData(fakeRepo(log, { list: 1 }), VOCAB_LABELS.theme)
    await expect(data.index()).rejects.toThrow('offline')
    expect((await data.index()).get('KEN-LVB')?.hasMap).toBe(true)
    expect(log).toEqual(['list', 'list'])
  })
})
