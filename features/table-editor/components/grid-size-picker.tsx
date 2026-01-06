import { useState } from 'react'
import Grid3X3 from 'lucide-react/dist/esm/icons/grid-3-x-3'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import { stopKeyboardPropagation as stopPropagation, cn } from '@/lib/utils'
import { MIN_ROWS, MAX_ROWS, MIN_COLS, MAX_COLS, GRID_PICKER_SIZE, DEFAULT_ROWS, DEFAULT_COLS } from '../constants'

interface GridSizePickerProps {
	currentRows: number
	currentCols: number
	onSelect: (rows: number, cols: number) => void
	onClose: () => void
}

function GridSizePickerPopover({ currentRows, currentCols, onSelect, onClose }: GridSizePickerProps) {
	const [hoverRow, setHoverRow] = useState(0)
	const [hoverCol, setHoverCol] = useState(0)
	const [inputRows, setInputRows] = useState(String(currentRows))
	const [inputCols, setInputCols] = useState(String(currentCols))

	const displayRow = hoverRow || currentRows
	const displayCol = hoverCol || currentCols

	const handleApply = () => {
		const rows = Math.max(MIN_ROWS, Math.min(MAX_ROWS, parseInt(inputRows) || DEFAULT_ROWS))
		const cols = Math.max(MIN_COLS, Math.min(MAX_COLS, parseInt(inputCols) || DEFAULT_COLS))
		onSelect(rows, cols)
		onClose()
	}

	return (
		<div className="p-3 bg-background border border-border rounded-lg shadow-xl" onKeyDown={stopPropagation}>
			{/* Visual grid picker */}
			<div
				className="grid grid-cols-8 gap-0.5 mb-3"
				onMouseLeave={() => {
					setHoverRow(0)
					setHoverCol(0)
				}}
			>
				{Array.from({ length: GRID_PICKER_SIZE * GRID_PICKER_SIZE }).map((_, index) => {
					const row = Math.floor(index / GRID_PICKER_SIZE) + 1
					const col = (index % GRID_PICKER_SIZE) + 1
					const targetRow = hoverRow || currentRows
					const targetCol = hoverCol || currentCols
					const isHighlighted = row <= targetRow && col <= targetCol
					const isHovered = hoverRow > 0 && row <= hoverRow && col <= hoverCol

					return (
						<div
							key={index}
							className={cn(
								'w-[18px] h-[18px] rounded-[3px] border cursor-pointer transition-all duration-75',
								isHovered
									? 'bg-primary border-primary'
									: isHighlighted
									? 'bg-primary/20 border-primary/50'
									: 'bg-muted border-border'
							)}
							onMouseEnter={() => {
								setHoverRow(row)
								setHoverCol(col)
							}}
							onClick={() => {
								onSelect(row + 1, col) // +1 for header row
								onClose()
							}}
						/>
					)
				})}
			</div>

			{/* Grid size display */}
			<div className="flex items-center justify-center gap-1 py-2.5 border-t border-border">
				<span className="text-[13px] font-medium text-foreground">
					{displayRow} × {displayCol}
				</span>
			</div>

			{/* Manual input section */}
			<div className="flex items-center justify-center gap-2 pt-2.5 border-t border-border">
				<input
					type="number"
					min={MIN_ROWS}
					max={MAX_ROWS}
					value={inputRows}
					onChange={e => setInputRows(e.target.value)}
					onKeyDown={e => {
						stopPropagation(e)
						if (e.key === 'Enter') handleApply()
					}}
					className="w-[50px] h-7 px-2 bg-muted/50 border border-border rounded text-foreground text-[13px] font-medium text-center outline-none focus:border-ring focus:ring-1 focus:ring-ring"
					placeholder="Filas"
				/>
				<span className="text-muted-foreground text-sm font-medium">×</span>
				<input
					type="number"
					min={MIN_COLS}
					max={MAX_COLS}
					value={inputCols}
					onChange={e => setInputCols(e.target.value)}
					onKeyDown={e => {
						stopPropagation(e)
						if (e.key === 'Enter') handleApply()
					}}
					className="w-[50px] h-7 px-2 bg-muted/50 border border-border rounded text-foreground text-[13px] font-medium text-center outline-none focus:border-ring focus:ring-1 focus:ring-ring"
					placeholder="Cols"
				/>
				<button
					onClick={handleApply}
					className="h-7 px-2.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors cursor-pointer"
				>
					Aplicar
				</button>
			</div>
		</div>
	)
}

interface GridSizeButtonProps {
	numRows: number
	numCols: number
	onSelect: (rows: number, cols: number) => void
}

export function GridSizeButton({ numRows, numCols, onSelect }: GridSizeButtonProps) {
	const [showPicker, setShowPicker] = useState(false)

	return (
		<div className="relative">
			<button
				onClick={() => setShowPicker(!showPicker)}
				className={cn(
					'flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs font-medium transition-all cursor-pointer outline-none shadow-sm whitespace-nowrap',
					showPicker
						? 'bg-primary/10 text-primary border-primary/30 ring-2 ring-primary/20'
						: 'bg-background text-foreground border-border hover:border-primary/50 hover:bg-muted/50'
				)}
			>
				<Grid3X3 className="w-3.5 h-3.5 flex-shrink-0" />
				<span className="whitespace-nowrap leading-none">
					{numRows} × {numCols}
				</span>
				<ChevronDown
					className={cn(
						'w-3 h-3 text-muted-foreground transition-transform duration-150 flex-shrink-0',
						showPicker && 'rotate-180'
					)}
				/>
			</button>

			{showPicker && (
				<>
					<div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
					<div className="absolute top-full left-0 mt-2 z-50">
						<GridSizePickerPopover
							currentRows={numRows}
							currentCols={numCols}
							onSelect={(rows, cols) => {
								onSelect(rows, cols)
								setShowPicker(false)
							}}
							onClose={() => setShowPicker(false)}
						/>
					</div>
				</>
			)}
		</div>
	)
}
