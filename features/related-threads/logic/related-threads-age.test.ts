import { describe, expect, it } from 'vitest'
import {
	getActivityCutoff,
	getRowActivityTime,
	isRowStale,
	normalizeMaxAgeMonths,
} from './related-threads-age'

const NOW = new Date(2026, 7, 12, 12, 0, 0)

function makeRow(html: string): HTMLElement {
	const table = document.createElement('table')
	table.innerHTML = `<tbody><tr>${html}</tr></tbody>`
	return table.querySelector('tr')!
}

/** Markup copied from a real Mediavida related-threads row. */
function makeRealRow(unixSeconds: number): HTMLElement {
	return makeRow(`
		<td class="thread-count">
			<a class="m-last age"><span class="rd" data-time="${unixSeconds}" data-format="tiny">1d</span></a>
		</td>
		<td class="last-av dtc">
			<a><span class="m_date cmap-h" data-time="${unixSeconds}" data-format="tiny">1d</span></a>
		</td>
	`)
}

describe('getRowActivityTime', () => {
	it('reads the activity column timestamp as milliseconds', () => {
		expect(getRowActivityTime(makeRealRow(1565631769))).toBe(1565631769000)
	})

	it('falls back to the last-avatar column when the activity one is missing', () => {
		const row = makeRow('<td class="last-av dtc"><span class="m_date" data-time="1421868412"></span></td>')

		expect(getRowActivityTime(row)).toBe(1421868412000)
	})

	it('returns null when the row carries no timestamp', () => {
		expect(getRowActivityTime(makeRow('<td class="col-th">Un hilo</td>'))).toBeNull()
	})

	it('returns null for a malformed or zero timestamp', () => {
		expect(getRowActivityTime(makeRow('<td><span data-time="nope"></span></td>'))).toBeNull()
		expect(getRowActivityTime(makeRow('<td><span data-time="0"></span></td>'))).toBeNull()
	})
})

describe('normalizeMaxAgeMonths', () => {
	it('treats zero, negatives and rubbish as no limit', () => {
		expect(normalizeMaxAgeMonths(0)).toBe(0)
		expect(normalizeMaxAgeMonths(-5)).toBe(0)
		expect(normalizeMaxAgeMonths('abc')).toBe(0)
		expect(normalizeMaxAgeMonths(undefined)).toBe(0)
		expect(normalizeMaxAgeMonths(Number.NaN)).toBe(0)
	})

	it('accepts numeric strings, floors decimals and caps at 300 months', () => {
		expect(normalizeMaxAgeMonths('12')).toBe(12)
		expect(normalizeMaxAgeMonths(12.9)).toBe(12)
		expect(normalizeMaxAgeMonths(99999)).toBe(300)
	})
})

describe('getActivityCutoff', () => {
	it('has no cutoff without a limit', () => {
		expect(getActivityCutoff(0, NOW)).toBeNull()
	})

	it('counts calendar months back from now', () => {
		expect(getActivityCutoff(12, NOW)).toBe(new Date(2025, 7, 12, 12, 0, 0).getTime())
		expect(getActivityCutoff(6, NOW)).toBe(new Date(2026, 1, 12, 12, 0, 0).getTime())
	})
})

describe('isRowStale', () => {
	const cutoff = getActivityCutoff(12, NOW)
	const lastYear = Math.floor(new Date(2025, 0, 1).getTime() / 1000)
	const lastWeek = Math.floor(new Date(2026, 7, 5).getTime() / 1000)

	it('hides a thread whose last message predates the cutoff', () => {
		expect(isRowStale(makeRealRow(lastYear), cutoff)).toBe(true)
	})

	it('keeps a thread that was replied to recently', () => {
		expect(isRowStale(makeRealRow(lastWeek), cutoff)).toBe(false)
	})

	it('keeps everything when there is no limit', () => {
		expect(isRowStale(makeRealRow(lastYear), null)).toBe(false)
	})

	it('never hides a row it cannot date, so a markup change costs the filter and not the thread', () => {
		expect(isRowStale(makeRow('<td class="col-th">Un hilo</td>'), cutoff)).toBe(false)
	})
})