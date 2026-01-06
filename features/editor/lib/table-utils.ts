/**
 * Utilities for parsing and manipulating Markdown tables
 */

export type ColumnAlignment = 'left' | 'center' | 'right'

export interface ParsedTable {
	cells: string[][]
	alignments: ColumnAlignment[]
	startIndex: number
	endIndex: number
}

/**
 * Resolves Markdown separator syntax to alignment types
 * @param separator - Cell content from the separator row
 */
function parseAlignment(separator: string): ColumnAlignment {
	const trimmed = separator.trim()
	const startsWithColon = trimmed.startsWith(':')
	const endsWithColon = trimmed.endsWith(':')

	if (startsWithColon && endsWithColon) return 'center'
	if (endsWithColon) return 'right'
	return 'left'
}

/**
 * Detects if a line resembles a Markdown table separator (e.g., |:---|:---:|).
 * Verifies pipe structure and valid separator characters.
 */
function isSeparatorRow(line: string): boolean {
	const trimmed = line.trim()
	if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false

	// Remove leading/trailing pipes and split
	const cells = trimmed.slice(1, -1).split('|')

	// Each cell should be mostly dashes with optional colons
	return cells.every(cell => {
		const t = cell.trim()
		return /^:?-+:?$/.test(t)
	})
}

/**
 * Detects if a line is formatted correctly as a Markdown table row.
 */
function isTableRow(line: string): boolean {
	const trimmed = line.trim()
	return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')
}

/**
 * Parses a single Markdown table row into an array of trimmed cell contents.
 */
function parseTableRow(line: string): string[] {
	const trimmed = line.trim()
	// Remove leading and trailing pipes
	const inner = trimmed.slice(1, -1)
	// Split by | and trim each cell
	return inner.split('|').map(cell => cell.trim())
}

/**
 * Parses full table text into a structured object with cells and alignments
 */
export function parseMarkdownTable(tableText: string): ParsedTable | null {
	const lines = tableText.split('\n').filter(l => l.trim())

	if (lines.length < 2) return null

	// First line should be header
	if (!isTableRow(lines[0])) return null

	// Second line should be separator
	if (!isSeparatorRow(lines[1])) return null

	const headerCells = parseTableRow(lines[0])
	const separatorCells = lines[1].trim().slice(1, -1).split('|')
	const alignments = separatorCells.map(parseAlignment)

	const cells: string[][] = [headerCells]

	// Parse data rows
	for (let i = 2; i < lines.length; i++) {
		if (isTableRow(lines[i])) {
			const rowCells = parseTableRow(lines[i])
			// Pad row to match header length if needed
			while (rowCells.length < headerCells.length) {
				rowCells.push('')
			}
			cells.push(rowCells.slice(0, headerCells.length))
		}
	}

	return {
		cells,
		alignments,
		startIndex: 0,
		endIndex: tableText.length,
	}
}

/**
 * Find if cursor is positioned inside a table and return table bounds
 */
export function findTableAtCursor(
	text: string,
	cursorPosition: number
): { table: ParsedTable; startIndex: number; endIndex: number } | null {
	const lines = text.split('\n')
	let currentIndex = 0
	let cursorLine = -1

	// Find which line the cursor is on
	for (let i = 0; i < lines.length; i++) {
		const lineEnd = currentIndex + lines[i].length
		if (cursorPosition >= currentIndex && cursorPosition <= lineEnd) {
			cursorLine = i
			break
		}
		currentIndex = lineEnd + 1 // +1 for newline
	}

	if (cursorLine === -1) return null

	// Check if cursor line is part of a table
	if (!isTableRow(lines[cursorLine]) && !isSeparatorRow(lines[cursorLine])) {
		return null
	}

	// Find table start (search backwards)
	let tableStart = cursorLine
	while (tableStart > 0) {
		const prevLine = lines[tableStart - 1].trim()
		if (isTableRow(prevLine) || isSeparatorRow(prevLine)) {
			tableStart--
		} else {
			break
		}
	}

	// Find table end (search forwards)
	let tableEnd = cursorLine
	while (tableEnd < lines.length - 1) {
		const nextLine = lines[tableEnd + 1].trim()
		if (isTableRow(nextLine) || isSeparatorRow(nextLine)) {
			tableEnd++
		} else {
			break
		}
	}

	// Extract table text
	const tableLines = lines.slice(tableStart, tableEnd + 1)
	const tableText = tableLines.join('\n')

	// Calculate character indices
	let startCharIndex = 0
	for (let i = 0; i < tableStart; i++) {
		startCharIndex += lines[i].length + 1
	}

	let endCharIndex = startCharIndex
	for (let i = tableStart; i <= tableEnd; i++) {
		endCharIndex += lines[i].length + (i < tableEnd ? 1 : 0)
	}

	const parsed = parseMarkdownTable(tableText)
	if (!parsed) return null

	return {
		table: {
			...parsed,
			startIndex: startCharIndex,
			endIndex: endCharIndex,
		},
		startIndex: startCharIndex,
		endIndex: endCharIndex,
	}
}

/**
 * Generate Markdown table from cells and alignments
 */
export function generateMarkdownTable(cells: string[][], alignments: ColumnAlignment[]): string {
	if (cells.length === 0 || cells[0].length === 0) return ''

	const numCols = cells[0].length

	// Calculate column widths
	const colWidths = Array(numCols)
		.fill(0)
		.map((_, colIndex) => {
			const maxWidth = Math.max(...cells.map(row => (row[colIndex] || '').length), 3)
			return maxWidth
		})

	// Header row
	const headerRow = '| ' + cells[0].map((cell, i) => (cell || '').padEnd(colWidths[i])).join(' | ') + ' |'

	// Separator row
	const separatorRow =
		'|' +
		alignments
			.map((align, i) => {
				const width = colWidths[i]
				const dashes = '-'.repeat(width)
				switch (align) {
					case 'center':
						return `:${dashes}:`
					case 'right':
						return `${dashes}:`
					default:
						return `:${dashes}`
				}
			})
			.join('|') +
		'|'

	// Data rows
	const dataRows = cells
		.slice(1)
		.map(row => '| ' + row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join(' | ') + ' |')

	return [headerRow, separatorRow, ...dataRows].join('\n')
}
