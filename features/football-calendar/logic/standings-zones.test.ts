import { describe, expect, it } from 'vitest'
import { getStandingsZone } from './standings-zones'

describe('getStandingsZone', () => {
	describe('Champions League phase', () => {
		const zoneAt = (position: number) => getStandingsZone('CL', position, 36)

		it('sends the top eight straight to the round of 16', () => {
			expect(zoneAt(1)).toBe('round-of-16')
			expect(zoneAt(8)).toBe('round-of-16')
		})

		it('puts places nine to twenty-four in the playoff', () => {
			expect(zoneAt(9)).toBe('playoff')
			expect(zoneAt(24)).toBe('playoff')
		})

		it('leaves the eliminated places unmarked', () => {
			expect(zoneAt(25)).toBeNull()
			expect(zoneAt(36)).toBeNull()
		})

		it('marks nothing while the table is still partial', () => {
			expect(getStandingsZone('CL', 1, 12)).toBeNull()
		})
	})

	describe('domestic league', () => {
		const zoneAt = (position: number) => getStandingsZone('PD', position, 20)

		it('marks the bottom three as relegation', () => {
			expect(zoneAt(18)).toBe('relegation')
			expect(zoneAt(20)).toBe('relegation')
		})

		it('marks the Champions places', () => {
			expect(zoneAt(1)).toBe('champions')
			expect(zoneAt(4)).toBe('champions')
		})

		it('marks fifth and sixth as Europa League', () => {
			expect(zoneAt(5)).toBe('europa')
			expect(zoneAt(6)).toBe('europa')
		})

		it('leaves mid-table unmarked', () => {
			expect(zoneAt(7)).toBeNull()
			expect(zoneAt(17)).toBeNull()
		})

		it('follows the table size instead of assuming twenty teams', () => {
			expect(getStandingsZone('PD', 16, 18)).toBe('relegation')
			expect(getStandingsZone('PD', 15, 18)).toBeNull()
		})

		it('marks nothing on a table too small to be a league', () => {
			expect(getStandingsZone('PD', 4, 4)).toBeNull()
		})
	})

	// The bug this replaced: the rule keyed on the payload's stage string, so an
	// unexpected wording left the Champions table with no zones at all.
	it('marks the Champions phase from the competition code, not the payload wording', () => {
		expect(getStandingsZone('CL', 1, 36)).toBe('round-of-16')
		expect(getStandingsZone('CL', 20, 36)).toBe('playoff')
	})
})
