/**
 * Tests for date-utils.ts
 *
 * Pure utility functions - easy to test without mocks
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getTodayKey, formatDateKey, parseDateKey, formatDate, formatRelativeDate } from './date-utils'

describe('date-utils', () => {
	describe('formatDateKey()', () => {
		it('should format date as DD-MM-YYYY', () => {
			const date = new Date(2025, 5, 15) // June 15, 2025 (month is 0-indexed)
			expect(formatDateKey(date)).toBe('15-06-2025')
		})

		it('should pad single digit day and month with zeros', () => {
			const date = new Date(2025, 0, 5) // January 5, 2025
			expect(formatDateKey(date)).toBe('05-01-2025')
		})

		it('should handle end of year dates', () => {
			const date = new Date(2025, 11, 31) // December 31, 2025
			expect(formatDateKey(date)).toBe('31-12-2025')
		})

		it('should handle beginning of year dates', () => {
			const date = new Date(2025, 0, 1) // January 1, 2025
			expect(formatDateKey(date)).toBe('01-01-2025')
		})
	})

	describe('parseDateKey()', () => {
		it('should parse DD-MM-YYYY format correctly', () => {
			const result = parseDateKey('15-06-2025')
			expect(result).toBeInstanceOf(Date)
			expect(result?.getDate()).toBe(15)
			expect(result?.getMonth()).toBe(5) // 0-indexed
			expect(result?.getFullYear()).toBe(2025)
		})

		it('should return null for invalid format', () => {
			// Note: parseDateKey splits by '-' so wrong separators fail
			expect(parseDateKey('15/06/2025')).toBeNull() // Wrong separator
			expect(parseDateKey('15-06')).toBeNull() // Missing year
			expect(parseDateKey('')).toBeNull() // Empty string
		})

		it('should return null for non-numeric values', () => {
			expect(parseDateKey('aa-bb-cccc')).toBeNull() // Non-numeric
		})

		it('should be reversible with formatDateKey', () => {
			const original = new Date(2025, 5, 15)
			const key = formatDateKey(original)
			const parsed = parseDateKey(key)

			expect(parsed?.getDate()).toBe(original.getDate())
			expect(parsed?.getMonth()).toBe(original.getMonth())
			expect(parsed?.getFullYear()).toBe(original.getFullYear())
		})
	})

	describe('getTodayKey()', () => {
		beforeEach(() => {
			// Mock the current date
			vi.useFakeTimers()
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it('should return today date in DD-MM-YYYY format', () => {
			vi.setSystemTime(new Date(2025, 5, 15, 14, 30, 0)) // June 15, 2025 14:30

			expect(getTodayKey()).toBe('15-06-2025')
		})

		it('should update when date changes', () => {
			vi.setSystemTime(new Date(2025, 11, 31, 23, 59, 0)) // Dec 31, 2025 23:59
			expect(getTodayKey()).toBe('31-12-2025')

			vi.setSystemTime(new Date(2026, 0, 1, 0, 0, 0)) // Jan 1, 2026 00:00
			expect(getTodayKey()).toBe('01-01-2026')
		})
	})

	describe('formatRelativeDate()', () => {
		beforeEach(() => {
			vi.useFakeTimers()
			vi.setSystemTime(new Date(2025, 5, 15, 12, 0, 0)) // June 15, 2025 12:00
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it('should return "Ahora mismo" for very recent timestamps', () => {
			const now = Date.now()
			expect(formatRelativeDate(now)).toBe('Ahora mismo')
			expect(formatRelativeDate(now - 30000)).toBe('Ahora mismo') // 30 seconds ago
		})

		it('should return minutes for timestamps < 1 hour ago', () => {
			const now = Date.now()
			expect(formatRelativeDate(now - 60000)).toBe('Hace 1 min') // 1 minute
			expect(formatRelativeDate(now - 300000)).toBe('Hace 5 min') // 5 minutes
			expect(formatRelativeDate(now - 3540000)).toBe('Hace 59 min') // 59 minutes
		})

		it('should return hours for timestamps < 24 hours ago', () => {
			const now = Date.now()
			expect(formatRelativeDate(now - 3600000)).toBe('Hace 1h') // 1 hour
			expect(formatRelativeDate(now - 7200000)).toBe('Hace 2h') // 2 hours
			expect(formatRelativeDate(now - 82800000)).toBe('Hace 23h') // 23 hours
		})

		it('should return days for timestamps < 7 days ago', () => {
			const now = Date.now()
			expect(formatRelativeDate(now - 86400000)).toBe('Hace 1 días') // 1 day
			expect(formatRelativeDate(now - 172800000)).toBe('Hace 2 días') // 2 days
			expect(formatRelativeDate(now - 518400000)).toBe('Hace 6 días') // 6 days
		})

		it('should return formatted date for timestamps > 7 days ago', () => {
			const now = Date.now()
			const oldTimestamp = now - 604800000 // 7 days ago

			const result = formatRelativeDate(oldTimestamp)
			// Should contain date elements, not relative text
			expect(result).not.toContain('Hace')
		})
	})

	describe('formatDate()', () => {
		it('should format timestamp as localized Spanish date', () => {
			const timestamp = new Date(2025, 5, 15, 14, 30, 0).getTime()
			const result = formatDate(timestamp)

			// Check it contains expected parts (exact format may vary by locale settings)
			expect(result).toContain('15')
			expect(result).toContain('2025')
		})
	})
})
