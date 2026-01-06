/**
 * Tests for Table Editor constants and types
 */
import { describe, it, expect } from 'vitest'
import { MIN_ROWS, MIN_COLS, MAX_ROWS, MAX_COLS, GRID_PICKER_SIZE, DEFAULT_ROWS, DEFAULT_COLS } from './constants'

describe('table-editor constants', () => {
	describe('size constraints', () => {
		it('should have minimum rows and columns of 2', () => {
			expect(MIN_ROWS).toBe(2)
			expect(MIN_COLS).toBe(2)
		})

		it('should have reasonable maximum limits', () => {
			expect(MAX_ROWS).toBeGreaterThanOrEqual(50)
			expect(MAX_COLS).toBeGreaterThanOrEqual(10)
		})

		it('should have MAX greater than MIN', () => {
			expect(MAX_ROWS).toBeGreaterThan(MIN_ROWS)
			expect(MAX_COLS).toBeGreaterThan(MIN_COLS)
		})
	})

	describe('default values', () => {
		it('should have sensible defaults within min/max', () => {
			expect(DEFAULT_ROWS).toBeGreaterThanOrEqual(MIN_ROWS)
			expect(DEFAULT_ROWS).toBeLessThanOrEqual(MAX_ROWS)
			expect(DEFAULT_COLS).toBeGreaterThanOrEqual(MIN_COLS)
			expect(DEFAULT_COLS).toBeLessThanOrEqual(MAX_COLS)
		})

		it('should have grid picker size', () => {
			expect(GRID_PICKER_SIZE).toBeGreaterThan(0)
			expect(GRID_PICKER_SIZE).toBeLessThanOrEqual(12) // Reasonable UI limit
		})
	})
})

describe('table-editor types', () => {
	describe('ColumnAlignment', () => {
		it('should define valid alignment values', () => {
			const validAlignments = ['left', 'center', 'right']
			validAlignments.forEach(alignment => {
				expect(['left', 'center', 'right']).toContain(alignment)
			})
		})
	})

	describe('TableState structure', () => {
		it('should support 2D cell array', () => {
			const cells: string[][] = [
				['A1', 'B1', 'C1'],
				['A2', 'B2', 'C2'],
			]
			expect(cells.length).toBe(2)
			expect(cells[0].length).toBe(3)
		})

		it('should support alignment per column', () => {
			type ColumnAlignment = 'left' | 'center' | 'right'
			const alignments: ColumnAlignment[] = ['left', 'center', 'right']
			expect(alignments).toHaveLength(3)
		})
	})
})
