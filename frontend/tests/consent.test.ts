import { describe, expect, it } from 'vitest'
import {
  analyticsAllowed, gaCookieNames, HISTORY_LIMIT, isMeasurementId, isWithdrawal, needsPrompt,
  parseConsent, recordDecision,
} from '../src/lib/consent/consent'

const at = new Date('2026-11-26T15:04:05Z')

describe('cookie consent', () => {
  it('asks when nothing valid is stored', () => {
    expect(needsPrompt(parseConsent(null), '1.1')).toBe(true)
    expect(needsPrompt(parseConsent('not json'), '1.1')).toBe(true)
    expect(needsPrompt(parseConsent('{"current":{"analytics":true}}'), '1.1')).toBe(true)
  })

  it('never allows analytics without an explicit yes', () => {
    expect(analyticsAllowed(null, '1.1')).toBe(false)
    const no = recordDecision(null, { analytics: false, method: 'banner-reject', page: '/website/' }, at, '1.1')
    expect(analyticsAllowed(no, '1.1')).toBe(false)
    expect(needsPrompt(no, '1.1')).toBe(false)
  })

  it('records who-what-when-how and survives a round trip', () => {
    const yes = recordDecision(null, { analytics: true, method: 'banner-accept', page: '/website/about' }, at, '1.1')
    const back = parseConsent(JSON.stringify(yes))
    expect(back?.current).toEqual({ version: '1.1', analytics: true, at: '2026-11-26T15:04:05.000Z', method: 'banner-accept', page: '/website/about' })
    expect(analyticsAllowed(back, '1.1')).toBe(true)
  })

  it('asks again, and blocks analytics, when the notice version changes', () => {
    const yes = recordDecision(null, { analytics: true, method: 'banner-accept', page: '/' }, at, '1.1')
    expect(needsPrompt(yes, '1.2')).toBe(true)
    expect(analyticsAllowed(yes, '1.2')).toBe(false)
  })

  it('keeps withdrawals in the history and flags them', () => {
    const yes = recordDecision(null, { analytics: true, method: 'banner-accept', page: '/' }, at, '1.1')
    const no = recordDecision(yes, { analytics: false, method: 'settings-save', page: '/' }, at, '1.1')
    expect(isWithdrawal(yes, no)).toBe(true)
    expect(isWithdrawal(null, no)).toBe(false)
    expect(no.history.map((d) => d.analytics)).toEqual([true, false])
  })

  it('caps the history', () => {
    let s = recordDecision(null, { analytics: false, method: 'banner-reject', page: '/' }, at, '1.1')
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) s = recordDecision(s, { analytics: i % 2 === 0, method: 'settings-save', page: '/' }, at, '1.1')
    expect(s.history).toHaveLength(HISTORY_LIMIT)
  })

  it('finds only GA cookies and accepts only real measurement IDs', () => {
    expect(gaCookieNames('_ga=GA1.1.1; mosaic=1; _ga_ABC123=GS1; _gat=1')).toEqual(['_ga', '_ga_ABC123'])
    expect(isMeasurementId('G-AB12CD34EF')).toBe(true)
    expect(isMeasurementId('')).toBe(false)
    expect(isMeasurementId('UA-12345-1')).toBe(false)
  })
})
