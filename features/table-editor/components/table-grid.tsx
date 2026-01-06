import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { UseTableEditorReturn } from '../hooks/use-table-editor'

interface TableGridProps {
	editor: UseTableEditorReturn
	onContextMenu?: (e: React.MouseEvent, rowIndex: number, colIndex: number) => void
}

export function TableGrid({ editor, onContextMenu }: TableGridProps) {
	const { cells, alignments, selectedCol, selectedRow, numCols, inputRefs, updateCell, setSelectedCol, setSelectedRow, handleKeyDown } = editor

	const handleContextMenu = useCallback((e: React.MouseEvent, rowIndex: number, colIndex: number) => {
		e.preventDefault()
		e.stopPropagation()
		setSelectedCol(colIndex)
		setSelectedRow(rowIndex)
		onContextMenu?.(e, rowIndex, colIndex)
	}, [setSelectedCol, setSelectedRow, onContextMenu])

	const handleCellClick = useCallback((rowIndex: number, colIndex: number) => {
		setSelectedCol(colIndex)
		setSelectedRow(rowIndex)
	}, [setSelectedCol, setSelectedRow])

	const handleCellFocus = useCallback((rowIndex: number, colIndex: number) => {
		setSelectedCol(colIndex)
		setSelectedRow(rowIndex)
	}, [setSelectedCol, setSelectedRow])

	return (
		<div className="inline-block min-w-full">
			<div
				className="grid border-x border-t border-border rounded-t-lg overflow-hidden bg-background shadow-sm"
				style={{ gridTemplateColumns: `repeat(${numCols}, minmax(130px, 1fr))` }}
			>
				{cells.map((row, rowIndex) =>
					row.map((cell, colIndex) => {
						const isHeader = rowIndex === 0
						const isColSelected = selectedCol === colIndex
						const isRowSelected = selectedRow === rowIndex
						const isSelected = isColSelected || isRowSelected
						const isEvenRow = rowIndex % 2 === 0
						const cellKey = `${rowIndex}-${colIndex}`
						const isLastCol = colIndex === row.length - 1

						return (
							<div
								key={cellKey}
								className={cn(
									'flex transition-all duration-200 border-b border-r border-border ring-inset focus-within:ring-2 focus-within:ring-primary/40 focus-within:bg-primary/5',
									isSelected
										? 'bg-primary/5'
										: isHeader
										? 'bg-muted/30'
										: isEvenRow
										? 'bg-muted/10'
										: 'bg-transparent',
									isLastCol && 'border-r-0'
								)}
								onClick={() => handleCellClick(rowIndex, colIndex)}
								onContextMenu={e => handleContextMenu(e, rowIndex, colIndex)}
							>
								<input
									ref={el => {
										if (el) inputRefs.current.set(cellKey, el)
										else inputRefs.current.delete(cellKey)
									}}
									type="text"
									value={cell}
									onChange={e => updateCell(rowIndex, colIndex, e.target.value)}
									onFocus={() => handleCellFocus(rowIndex, colIndex)}
									onKeyDown={e => handleKeyDown(e, rowIndex, colIndex)}
									className={cn(
										'block w-full px-4 py-3 bg-transparent border-none outline-none text-[13px] transition-all',
										isHeader ? 'text-foreground font-bold' : 'text-muted-foreground',
										alignments[colIndex] === 'center' && 'text-center',
										alignments[colIndex] === 'right' && 'text-right',
										alignments[colIndex] === 'left' && 'text-left',
										'placeholder:text-muted-foreground/30 focus:placeholder:text-primary/30'
									)}
									placeholder={isHeader ? `Columna ${colIndex + 1}` : ''}
								/>
							</div>
						)
					})
				)}
			</div>
		</div>
	)
}
