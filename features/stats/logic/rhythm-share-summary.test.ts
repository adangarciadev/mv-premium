import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { accumulateRhythm, createEmptyRhythm, getWeekKey, type RhythmStats } from './rhythm-model'
import { buildShareSummary } from './rhythm-share-summary'

// Fixed "now" so year/last-30/week scoping is deterministic.
const NOW = new Date(2026, 5, 16, 12, 0) // 2026-06-16 (a Tuesday)

beforeEach(() => {
	vi.useFakeTimers()
	vi.setSystemTime(NOW)
})

afterEach(() => {
	vi.useRealTimers()
})

function withTime(date: Date, ms: number, subforum?: string): (stats: RhythmStats) => RhythmStats {
	return stats => accumulateRhythm(stats, ms, date, subforum)
}

function build(...mutations: Array<(stats: RhythmStats) => RhythmStats>): RhythmStats {
	return mutations.reduce((stats, mutate) => mutate(stats), createEmptyRhythm())
}

describe('buildShareSummary', () => {
	it('scopes the year summary to current-year days only', () => {
		const stats = build(
			withTime(new Date(2026, 2, 10, 14, 0), 90 * 60_000, 'cine'), // in 2026
			withTime(new Date(2025, 2, 10, 14, 0), 90 * 60_000, 'cine') // previous year, excluded
		)

		const summary = buildShareSummary(stats, 'year', getWeekKey(NOW), 2)

		expect(summary.scope).toBe('year')
		expect(summary.mainLabel).toBe('TOTAL 2026')
		expect(summary.period).toBe('Resumen 2026')
		// Only the 2026 hour bucket should count toward the yearly total.
		expect(summary.mainValue).toBe('1h 30m')
	})

	it('uses only recent days for the last-30 summary', () => {
		const stats = build(
			withTime(new Date(2026, 5, 10, 9, 0), 60 * 60_000, 'dev'), // within 30 days
			withTime(new Date(2026, 0, 2, 9, 0), 60 * 60_000, 'dev') // older than 30 days, excluded
		)

		const summary = buildShareSummary(stats, 'last30', getWeekKey(NOW), 2)

		expect(summary.scope).toBe('last30')
		expect(summary.period).toBe('Últimos 30 días')
		expect(summary.mainLabel).toBe('TOTAL 30 DÍAS')
		expect(summary.mainValue).toBe('1h')
	})

	it('uses the selected week for the week summary', () => {
		const weekDate = new Date(2026, 5, 9, 18, 0) // Tuesday of the target week
		const stats = build(withTime(weekDate, 45 * 60_000, 'off-topic'))
		const weekKey = getWeekKey(weekDate)

		const summary = buildShareSummary(stats, 'week', weekKey, 2)

		expect(summary.scope).toBe('week')
		expect(summary.mainLabel).toBe('TOTAL SEMANAL')
		expect(summary.mainValue).toBe('45m')
		expect(summary.period.startsWith('Semana')).toBe(true)
	})

	it('uses the selected weekday for the weekday summary', () => {
		// Two Wednesdays so the weekday average is half the accumulated total.
		const stats = build(
			withTime(new Date(2026, 5, 3, 20, 0), 60 * 60_000, 'juegos'), // Wed
			withTime(new Date(2026, 5, 10, 20, 0), 60 * 60_000, 'juegos') // Wed
		)

		const summary = buildShareSummary(stats, 'weekday', getWeekKey(NOW), 3)

		expect(summary.scope).toBe('weekday')
		expect(summary.period).toBe('Media de Miércoles')
		expect(summary.mainLabel).toBe('MEDIA MIÉRCOLES')
		// 2h total across two Wednesdays -> 1h average.
		expect(summary.mainValue).toBe('1h')
	})

	it('builds a scope- and username-safe filename', () => {
		const stats = build(withTime(new Date(2026, 5, 10, 14, 0), 60 * 60_000, 'cine'))

		const summary = buildShareSummary(stats, 'year', getWeekKey(NOW), 2, 'Adán')

		expect(summary.fileName).toBe('mediavida-ritmo-resumen-2026.png')
		expect(summary.username).toBe('Adán')
	})

	it('derives top forums from the selected scope', () => {
		const stats = build(
			withTime(new Date(2026, 5, 10, 14, 0), 90 * 60_000, 'cine'),
			withTime(new Date(2026, 5, 11, 15, 0), 30 * 60_000, 'dev')
		)

		const summary = buildShareSummary(stats, 'year', getWeekKey(NOW), 2)

		expect(summary.forums.length).toBeGreaterThan(0)
		// Busiest subforum first.
		expect(summary.forums[0].label.toLowerCase()).toContain('cine')
	})
})
