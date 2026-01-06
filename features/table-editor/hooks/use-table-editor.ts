import { useState, useCallback, useRef } from 'react'
import type { ColumnAlignment, TableState, TableActions } from '../types'
import { MIN_ROWS, MAX_ROWS, MIN_COLS, MAX_COLS, DEFAULT_ROWS, DEFAULT_COLS } from '../constants'

function createEmptyGrid(rows: number, cols: number): string[][] {
	return Array(rows)
		.fill(null)
		.map((_, rowIndex) =>
			Array(cols)
				.fill(null)
				.map((_, colIndex) => (rowIndex === 0 ? `Col ${colIndex + 1}` : ''))
		)
}

export interface UseTableEditorOptions {
	initialCells?: string[][]
	initialAlignments?: ColumnAlignment[]
}

export interface UseTableEditorReturn extends TableState, TableActions {
	numRows: number
	numCols: number
	inputRefs: React.MutableRefObject<Map<string, HTMLInputElement>>
	handleKeyDown: (e: React.KeyboardEvent, row: number, col: number) => void
}

export function useTableEditor(options?: UseTableEditorOptions): UseTableEditorReturn {
	const [cells, setCells] = useState<string[][]>(
		() => options?.initialCells ?? createEmptyGrid(DEFAULT_ROWS, DEFAULT_COLS)
	)
	const [alignments, setAlignments] = useState<ColumnAlignment[]>(
		() => options?.initialAlignments ?? Array(DEFAULT_COLS).fill('left')
	)
	const [selectedCol, setSelectedCol] = useState<number | null>(null)
	const [selectedRow, setSelectedRow] = useState<number | null>(null)
	const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

	const numRows = cells.length
	const numCols = cells[0]?.length || DEFAULT_COLS

	// Cell operations
	const updateCell = useCallback((row: number, col: number, value: string) => {
		setCells(prev => {
			const newCells = prev.map(r => [...r])
			newCells[row][col] = value
			return newCells
		})
	}, [])

	// Table size operations
	const setTableSize = useCallback(
		(rows: number, cols: number) => {
			const clampedRows = Math.max(MIN_ROWS, Math.min(MAX_ROWS, rows))
			const clampedCols = Math.max(MIN_COLS, Math.min(MAX_COLS, cols))
			setCells(prev => {
				const newCells: string[][] = []
				for (let r = 0; r < clampedRows; r++) {
					const newRow: string[] = []
					for (let c = 0; c < clampedCols; c++) {
						if (prev[r] && prev[r][c] !== undefined) {
							newRow.push(prev[r][c])
						} else {
							newRow.push(r === 0 ? `Col ${c + 1}` : '')
						}
					}
					newCells.push(newRow)
				}
				return newCells
			})
			setAlignments(prev => {
				const newAlignments = [...prev]
				while (newAlignments.length < clampedCols) {
					newAlignments.push('left')
				}
				return newAlignments.slice(0, clampedCols)
			})
			if (selectedCol !== null && selectedCol >= clampedCols) {
				setSelectedCol(null)
			}
			if (selectedRow !== null && selectedRow >= clampedRows) {
				setSelectedRow(null)
			}
		},
		[selectedCol, selectedRow]
	)

	// Row operations
	const addRow = useCallback(() => {
		if (numRows < MAX_ROWS) {
			setCells(prev => [...prev, Array(numCols).fill('')])
		}
	}, [numRows, numCols])

	const removeRow = useCallback(() => {
		if (numRows > MIN_ROWS) {
			setCells(prev => prev.slice(0, -1))
		}
	}, [numRows])

	const insertRowAbove = useCallback(
		(row: number) => {
			if (numRows >= MAX_ROWS || row < 0) return
			setCells(prev => {
				const newCells = [...prev]
				newCells.splice(row, 0, Array(numCols).fill(''))
				return newCells
			})
		},
		[numRows, numCols]
	)

	const insertRowBelow = useCallback(
		(row: number) => {
			if (numRows >= MAX_ROWS || row < 0) return
			setCells(prev => {
				const newCells = [...prev]
				newCells.splice(row + 1, 0, Array(numCols).fill(''))
				return newCells
			})
		},
		[numRows, numCols]
	)

	const deleteRow = useCallback(
		(row: number) => {
			if (numRows <= MIN_ROWS || row < 0 || row >= numRows) return
			setCells(prev => prev.filter((_, i) => i !== row))
			if (selectedRow === row) {
				setSelectedRow(null)
			} else if (selectedRow !== null && selectedRow > row) {
				setSelectedRow(selectedRow - 1)
			}
		},
		[numRows, selectedRow]
	)

	const moveRowUp = useCallback(
		(row: number) => {
			if (row <= 0 || row >= numRows) return
			setCells(prev => {
				const newCells = [...prev]
				;[newCells[row - 1], newCells[row]] = [newCells[row], newCells[row - 1]]
				return newCells
			})
			if (selectedRow === row) {
				setSelectedRow(row - 1)
			} else if (selectedRow === row - 1) {
				setSelectedRow(row)
			}
		},
		[numRows, selectedRow]
	)

	const moveRowDown = useCallback(
		(row: number) => {
			if (row < 0 || row >= numRows - 1) return
			setCells(prev => {
				const newCells = [...prev]
				;[newCells[row], newCells[row + 1]] = [newCells[row + 1], newCells[row]]
				return newCells
			})
			if (selectedRow === row) {
				setSelectedRow(row + 1)
			} else if (selectedRow === row + 1) {
				setSelectedRow(row)
			}
		},
		[numRows, selectedRow]
	)

	// Column operations
	const addColumn = useCallback(() => {
		if (numCols < MAX_COLS) {
			setCells(prev => prev.map((row, i) => [...row, i === 0 ? `Col ${numCols + 1}` : '']))
			setAlignments(prev => [...prev, 'left'])
		}
	}, [numCols])

	const removeColumn = useCallback(() => {
		if (numCols > MIN_COLS) {
			setCells(prev => prev.map(row => row.slice(0, -1)))
			setAlignments(prev => prev.slice(0, -1))
			if (selectedCol !== null && selectedCol >= numCols - 1) {
				setSelectedCol(null)
			}
		}
	}, [numCols, selectedCol])

	const insertColumnLeft = useCallback(
		(col: number) => {
			if (numCols >= MAX_COLS || col < 0) return
			setCells(prev =>
				prev.map((row, rowIndex) => {
					const newRow = [...row]
					newRow.splice(col, 0, rowIndex === 0 ? `Col ${col + 1}` : '')
					return newRow
				})
			)
			setAlignments(prev => {
				const newAlignments = [...prev]
				newAlignments.splice(col, 0, 'left')
				return newAlignments
			})
			if (selectedCol !== null && selectedCol >= col) {
				setSelectedCol(selectedCol + 1)
			}
		},
		[numCols, selectedCol]
	)

	const insertColumnRight = useCallback(
		(col: number) => {
			if (numCols >= MAX_COLS || col < 0) return
			setCells(prev =>
				prev.map((row, rowIndex) => {
					const newRow = [...row]
					newRow.splice(col + 1, 0, rowIndex === 0 ? `Col ${col + 2}` : '')
					return newRow
				})
			)
			setAlignments(prev => {
				const newAlignments = [...prev]
				newAlignments.splice(col + 1, 0, 'left')
				return newAlignments
			})
		},
		[numCols]
	)

	const deleteColumn = useCallback(
		(col: number) => {
			if (numCols <= MIN_COLS || col < 0 || col >= numCols) return
			setCells(prev => prev.map(row => row.filter((_, i) => i !== col)))
			setAlignments(prev => prev.filter((_, i) => i !== col))
			if (selectedCol === col) {
				setSelectedCol(null)
			} else if (selectedCol !== null && selectedCol > col) {
				setSelectedCol(selectedCol - 1)
			}
		},
		[numCols, selectedCol]
	)

	const moveColumnLeft = useCallback(
		(col: number) => {
			if (col <= 0 || col >= numCols) return
			setCells(prev =>
				prev.map(row => {
					const newRow = [...row]
					;[newRow[col - 1], newRow[col]] = [newRow[col], newRow[col - 1]]
					return newRow
				})
			)
			setAlignments(prev => {
				const newAlignments = [...prev]
				;[newAlignments[col - 1], newAlignments[col]] = [newAlignments[col], newAlignments[col - 1]]
				return newAlignments
			})
			if (selectedCol === col) {
				setSelectedCol(col - 1)
			} else if (selectedCol === col - 1) {
				setSelectedCol(col)
			}
		},
		[numCols, selectedCol]
	)

	const moveColumnRight = useCallback(
		(col: number) => {
			if (col < 0 || col >= numCols - 1) return
			setCells(prev =>
				prev.map(row => {
					const newRow = [...row]
					;[newRow[col], newRow[col + 1]] = [newRow[col + 1], newRow[col]]
					return newRow
				})
			)
			setAlignments(prev => {
				const newAlignments = [...prev]
				;[newAlignments[col], newAlignments[col + 1]] = [newAlignments[col + 1], newAlignments[col]]
				return newAlignments
			})
			if (selectedCol === col) {
				setSelectedCol(col + 1)
			} else if (selectedCol === col + 1) {
				setSelectedCol(col)
			}
		},
		[numCols, selectedCol]
	)

	// Table operations
	const clearTable = useCallback(() => {
		setCells(prev =>
			prev.map((row, rowIndex) => row.map((_, colIndex) => (rowIndex === 0 ? `Col ${colIndex + 1}` : '')))
		)
	}, [])

	const resetTable = useCallback(() => {
		setCells(createEmptyGrid(DEFAULT_ROWS, DEFAULT_COLS))
		setAlignments(Array(DEFAULT_COLS).fill('left'))
		setSelectedCol(null)
		setSelectedRow(null)
	}, [])

	// Alignment
	const setColumnAlignment = useCallback((col: number, alignment: ColumnAlignment) => {
		setAlignments(prev => {
			const newAlignments = [...prev]
			newAlignments[col] = alignment
			return newAlignments
		})
	}, [])

	// Keyboard navigation
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent, row: number, col: number) => {
			e.stopPropagation()

			if (e.key === 'Tab') {
				e.preventDefault()
				const nextCol = e.shiftKey ? col - 1 : col + 1
				let nextRow = e.shiftKey ? (nextCol < 0 ? row - 1 : row) : nextCol >= numCols ? row + 1 : row
				const finalCol = e.shiftKey ? (nextCol < 0 ? numCols - 1 : nextCol) : nextCol >= numCols ? 0 : nextCol

				// Auto-add row if at the end and pressing Tab forward
				if (!e.shiftKey && nextRow >= numRows && numRows < MAX_ROWS) {
					setCells(prev => [...prev, Array(numCols).fill('')])
				}

				if (nextRow >= 0 && nextRow <= numRows) {
					setTimeout(() => {
						const key = `${nextRow}-${finalCol}`
						inputRefs.current.get(key)?.focus()
					}, 0)
				}
			} else if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault()
				// Auto-add row if at the last row
				if (row >= numRows - 1 && numRows < MAX_ROWS) {
					setCells(prev => [...prev, Array(numCols).fill('')])
					setTimeout(() => {
						const key = `${row + 1}-${col}`
						inputRefs.current.get(key)?.focus()
					}, 0)
				} else if (row < numRows - 1) {
					setTimeout(() => {
						const key = `${row + 1}-${col}`
						inputRefs.current.get(key)?.focus()
					}, 0)
				}
			}
		},
		[numRows, numCols]
	)

	// Markdown generation
	const generateMarkdown = useCallback((): string => {
		const colWidths = cells[0].map((_, colIndex) => {
			const maxWidth = Math.max(...cells.map(row => row[colIndex].length), 3)
			return maxWidth
		})

		const headerRow = '| ' + cells[0].map((cell, i) => cell.padEnd(colWidths[i])).join(' | ') + ' |'

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

		const dataRows = cells
			.slice(1)
			.map(row => '| ' + row.map((cell, i) => cell.padEnd(colWidths[i])).join(' | ') + ' |')

		return [headerRow, separatorRow, ...dataRows].join('\n')
	}, [cells, alignments])

	return {
		// State
		cells,
		alignments,
		selectedCol,
		selectedRow,
		numRows,
		numCols,
		inputRefs,
		// Actions
		updateCell,
		setTableSize,
		addRow,
		removeRow,
		addColumn,
		removeColumn,
		clearTable,
		resetTable,
		setColumnAlignment,
		setSelectedCol,
		setSelectedRow,
		insertRowAbove,
		insertRowBelow,
		deleteRow,
		moveRowUp,
		moveRowDown,
		insertColumnLeft,
		insertColumnRight,
		deleteColumn,
		moveColumnLeft,
		moveColumnRight,
		generateMarkdown,
		handleKeyDown,
	}
}
