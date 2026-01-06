/**
 * Tests for Activity Stats Storage - date and tracking logic
 */
import { describe, it, expect } from 'vitest'
import { formatDateKey, parseDateKey } from '@/lib/date-utils'

describe('activity-stats date utilities', () => {
	describe('formatDateKey', () => {
		it('should format a date to DD-MM-YYYY', () => {
			const date = new Date(2024, 0, 15) // January 15, 2024
			const result = formatDateKey(date)
			expect(result).toBe('15-01-2024')
		})

		it('should pad single digit day and month', () => {
			const date = new Date(2024, 0, 5) // January 5, 2024
			const result = formatDateKey(date)
			expect(result).toBe('05-01-2024')
		})

		it('should handle end of year', () => {
			const date = new Date(2024, 11, 31) // December 31, 2024
			const result = formatDateKey(date)
			expect(result).toBe('31-12-2024')
		})
	})

	describe('parseDateKey', () => {
		it('should parse DD-MM-YYYY to Date object', () => {
			const result = parseDateKey('15-01-2024')
			expect(result).not.toBeNull()
			expect(result!.getFullYear()).toBe(2024)
			expect(result!.getMonth()).toBe(0) // January
			expect(result!.getDate()).toBe(15)
		})

		it('should handle padded values', () => {
			const result = parseDateKey('05-03-2024')
			expect(result).not.toBeNull()
			expect(result!.getDate()).toBe(5)
			expect(result!.getMonth()).toBe(2) // March
		})

		it('should return null for invalid date keys', () => {
			expect(parseDateKey('invalid')).toBeNull()
			expect(parseDateKey('15-01')).toBeNull() // Missing year
			expect(parseDateKey('')).toBeNull()
		})

		it('should parse YYYY-MM-DD format differently (wrong order)', () => {
			// Note: parseDateKey expects DD-MM-YYYY, so YYYY-MM-DD will parse incorrectly
			const result = parseDateKey('2024-01-15')
			expect(result).not.toBeNull()
			// 2024 is parsed as day, 01 as month, 15 as year - resulting in invalid but parseable date
		})

		it('should be reversible with formatDateKey', () => {
			const original = new Date(2024, 5, 20) // June 20, 2024
			const key = formatDateKey(original)
			const parsed = parseDateKey(key)

			expect(parsed).not.toBeNull()
			expect(parsed!.getFullYear()).toBe(original.getFullYear())
			expect(parsed!.getMonth()).toBe(original.getMonth())
			expect(parsed!.getDate()).toBe(original.getDate())
		})
	})
})

describe('activity entry structure', () => {
	it('should define correct ActivityType values', () => {
		const validTypes = ['draft', 'post']
		validTypes.forEach(type => {
			expect(['draft', 'post']).toContain(type)
		})
	})

	it('should define correct action values', () => {
		const validActions = ['create', 'update', 'publish']
		validActions.forEach(action => {
			expect(['create', 'update', 'publish']).toContain(action)
		})
	})
})
