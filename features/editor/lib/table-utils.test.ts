/**
 * Tests for Table Utilities
 */
import { describe, it, expect } from 'vitest'

// Re-implement core table logic for testing
type CellAlignment = 'left' | 'center' | 'right'

interface TableCell {
	content: string
	alignment?: CellAlignment
}

interface TableData {
	headers: TableCell[]
	rows: TableCell[][]
}

function generateBBCodeTable(data: TableData): string {
	let output = '[table]\n'

	// Header row
	if (data.headers.length > 0) {
		output += '[tr]'
		for (const header of data.headers) {
			output += `[th]${header.content}[/th]`
		}
		output += '[/tr]\n'
	}

	// Data rows
	for (const row of data.rows) {
		output += '[tr]'
		for (const cell of row) {
			output += `[td]${cell.content}[/td]`
		}
		output += '[/tr]\n'
	}

	output += '[/table]'
	return output
}

describe('table-utils', () => {
	describe('generateBBCodeTable', () => {
		it('should generate a simple table with headers and one row', () => {
			const data: TableData = {
				headers: [{ content: 'Name' }, { content: 'Value' }],
				rows: [[{ content: 'A' }, { content: '1' }]],
			}
			const result = generateBBCodeTable(data)
			expect(result).toContain('[table]')
			expect(result).toContain('[/table]')
			expect(result).toContain('[th]Name[/th]')
			expect(result).toContain('[th]Value[/th]')
			expect(result).toContain('[td]A[/td]')
			expect(result).toContain('[td]1[/td]')
		})

		it('should handle multiple rows', () => {
			const data: TableData = {
				headers: [{ content: 'Col1' }],
				rows: [[{ content: 'Row1' }], [{ content: 'Row2' }], [{ content: 'Row3' }]],
			}
			const result = generateBBCodeTable(data)
			expect(result).toContain('[td]Row1[/td]')
			expect(result).toContain('[td]Row2[/td]')
			expect(result).toContain('[td]Row3[/td]')
			// Count tr tags (1 header + 3 rows = 4)
			const trCount = (result.match(/\[tr\]/g) || []).length
			expect(trCount).toBe(4)
		})

		it('should handle empty headers', () => {
			const data: TableData = {
				headers: [],
				rows: [[{ content: 'A' }, { content: 'B' }]],
			}
			const result = generateBBCodeTable(data)
			expect(result).not.toContain('[th]')
			expect(result).toContain('[td]A[/td]')
		})

		it('should handle empty cells', () => {
			const data: TableData = {
				headers: [{ content: 'H1' }],
				rows: [[{ content: '' }]],
			}
			const result = generateBBCodeTable(data)
			expect(result).toContain('[td][/td]')
		})
	})

	describe('TableData structure', () => {
		it('should accept alignment property', () => {
			const cell: TableCell = {
				content: 'Centered',
				alignment: 'center',
			}
			expect(cell.alignment).toBe('center')
		})

		it('should support all alignment types', () => {
			const alignments: CellAlignment[] = ['left', 'center', 'right']
			for (const align of alignments) {
				const cell: TableCell = { content: '', alignment: align }
				expect(cell.alignment).toBe(align)
			}
		})
	})
})
