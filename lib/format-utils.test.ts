/**
 * Tests for format-utils.ts
 */
import { describe, it, expect } from 'vitest'
import { formatPreciseTime, formatPreciseTimeShort, formatBytes } from './format-utils'

describe('format-utils', () => {
	describe('formatPreciseTime()', () => {
		it('formats seconds correctly', () => {
			expect(formatPreciseTime(0)).toBe('0s')
			expect(formatPreciseTime(1000)).toBe('1s')
			expect(formatPreciseTime(30000)).toBe('30s')
			expect(formatPreciseTime(59000)).toBe('59s')
		})

		it('formats minutes correctly', () => {
			expect(formatPreciseTime(60000)).toBe('1m 0s')
			expect(formatPreciseTime(90000)).toBe('1m 30s')
			expect(formatPreciseTime(3599000)).toBe('59m 59s')
		})

		it('formats hours correctly', () => {
			expect(formatPreciseTime(3600000)).toBe('1h 0m 0s')
			expect(formatPreciseTime(5400000)).toBe('1h 30m 0s')
			expect(formatPreciseTime(9000000)).toBe('2h 30m 0s')
			expect(formatPreciseTime(9015000)).toBe('2h 30m 15s')
		})

		it('handles large values', () => {
			// 24 hours
			expect(formatPreciseTime(86400000)).toBe('24h 0m 0s')
			// 100 hours
			expect(formatPreciseTime(360000000)).toBe('100h 0m 0s')
		})
	})

	describe('formatPreciseTimeShort()', () => {
		it('formats seconds correctly', () => {
			expect(formatPreciseTimeShort(0)).toBe('0s')
			expect(formatPreciseTimeShort(30000)).toBe('30s')
			expect(formatPreciseTimeShort(59000)).toBe('59s')
		})

		it('formats minutes without seconds', () => {
			expect(formatPreciseTimeShort(60000)).toBe('1m')
			expect(formatPreciseTimeShort(90000)).toBe('1m')
			expect(formatPreciseTimeShort(150000)).toBe('2m')
		})

		it('formats hours with minutes', () => {
			expect(formatPreciseTimeShort(3600000)).toBe('1h 0m')
			expect(formatPreciseTimeShort(5400000)).toBe('1h 30m')
			expect(formatPreciseTimeShort(9000000)).toBe('2h 30m')
		})
	})

	describe('formatBytes()', () => {
		it('formats zero bytes', () => {
			expect(formatBytes(0)).toBe('0 B')
		})

		it('formats bytes', () => {
			expect(formatBytes(1)).toBe('1 B')
			expect(formatBytes(500)).toBe('500 B')
			expect(formatBytes(1023)).toBe('1023 B')
		})

		it('formats kilobytes', () => {
			expect(formatBytes(1024)).toBe('1 KB')
			expect(formatBytes(1536)).toBe('1.5 KB')
			expect(formatBytes(10240)).toBe('10 KB')
		})

		it('formats megabytes', () => {
			expect(formatBytes(1048576)).toBe('1 MB')
			expect(formatBytes(1572864)).toBe('1.5 MB')
			expect(formatBytes(5242880)).toBe('5 MB')
		})

		it('formats gigabytes', () => {
			expect(formatBytes(1073741824)).toBe('1 GB')
			expect(formatBytes(1610612736)).toBe('1.5 GB')
		})

		it('handles decimal precision', () => {
			expect(formatBytes(1234567)).toBe('1.18 MB')
			expect(formatBytes(123456789)).toBe('117.74 MB')
		})
	})
})
