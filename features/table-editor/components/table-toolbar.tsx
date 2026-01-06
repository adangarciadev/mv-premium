import AlignLeft from 'lucide-react/dist/esm/icons/align-left'
import AlignCenter from 'lucide-react/dist/esm/icons/align-center'
import AlignRight from 'lucide-react/dist/esm/icons/align-right'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Minus from 'lucide-react/dist/esm/icons/minus'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import { cn } from '@/lib/utils'
import type { ColumnAlignment } from '../types'
import type { UseTableEditorReturn } from '../hooks/use-table-editor'
import { MIN_ROWS, MAX_ROWS, MIN_COLS, MAX_COLS } from '../constants'
import { IconButton } from './icon-button'
import { GridSizeButton } from './grid-size-picker'
import { ColumnMenu, RowMenu } from './table-menus'

interface TableToolbarProps {
	editor: UseTableEditorReturn
}

export function TableToolbar({ editor }: TableToolbarProps) {
	const {
		numRows,
		numCols,
		alignments,
		selectedCol,
		setTableSize,
		addRow,
		removeRow,
		addColumn,
		removeColumn,
		setColumnAlignment,
	} = editor

	return (
		<div className="p-3 px-4 border-b border-border flex flex-wrap items-center gap-3 bg-muted/5">
			{/* Size Picker Group */}
			<div className="flex items-center gap-2">
				<span className="text-[11px] font-bold tracking-wide text-primary/70 whitespace-nowrap leading-none">
					Formato
				</span>
				<GridSizeButton numRows={numRows} numCols={numCols} onSelect={setTableSize} />
			</div>

			<div className="w-px h-6 bg-border/40" />

			{/* Row Controls */}
			<div className="flex items-center gap-2">
				<span className="text-[11px] font-bold tracking-wide text-primary/70 whitespace-nowrap leading-none">
					Filas
				</span>
				<div className="flex items-center gap-1 bg-background/50 p-0.5 rounded-lg border border-border/50">
					<IconButton onClick={removeRow} disabled={numRows <= MIN_ROWS} title="Quitar fila">
						<Minus className="w-3.5 h-3.5" />
					</IconButton>
					<span className="text-[13px] text-foreground w-6 text-center font-bold whitespace-nowrap leading-none">
						{numRows}
					</span>
					<IconButton onClick={addRow} disabled={numRows >= MAX_ROWS} title="Añadir fila">
						<Plus className="w-3.5 h-3.5" />
					</IconButton>
				</div>
			</div>

			{/* Col Controls */}
			<div className="flex items-center gap-2">
				<span className="text-[11px] font-bold tracking-wide text-primary/70 whitespace-nowrap leading-none">
					Cols
				</span>
				<div className="flex items-center gap-1 bg-background/50 p-0.5 rounded-lg border border-border/50">
					<IconButton onClick={removeColumn} disabled={numCols <= MIN_COLS} title="Quitar columna">
						<Minus className="w-3.5 h-3.5" />
					</IconButton>
					<span className="text-[13px] text-foreground w-6 text-center font-bold whitespace-nowrap leading-none">
						{numCols}
					</span>
					<IconButton onClick={addColumn} disabled={numCols >= MAX_COLS} title="Añadir columna">
						<Plus className="w-3.5 h-3.5" />
					</IconButton>
				</div>
			</div>

			<div className="w-px h-6 bg-border/40" />

			{/* Column/Row Menus */}
			<div className="flex items-center gap-2">
				<ColumnMenu editor={editor} />
				<RowMenu editor={editor} />
			</div>

			<div className="w-px h-6 bg-border/40" />

			<div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5 border border-border/50 shadow-inner">
				{(['left', 'center', 'right'] as ColumnAlignment[]).map(align => {
					const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight
					const isActive = selectedCol !== null && alignments[selectedCol] === align
					const isDisabled = selectedCol === null

					return (
						<button
							key={align}
							onClick={() => selectedCol !== null && setColumnAlignment(selectedCol, align)}
							disabled={isDisabled}
							className={cn(
								'w-7 h-6 flex items-center justify-center rounded-md border-none transition-all',
								isActive
									? 'bg-primary text-primary-foreground shadow-md'
									: 'bg-transparent text-muted-foreground hover:text-foreground hover:bg-background/50',
								isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer active:scale-95'
							)}
							title={`Alinear ${align === 'left' ? 'izquierda' : align === 'center' ? 'centro' : 'derecha'}${
								isDisabled ? ' (selecciona una columna)' : ''
							}`}
						>
							<Icon className="w-3.5 h-3.5" />
						</button>
					)
				})}
			</div>


		</div>
	)
}

interface SecondaryToolbarProps {
	editor: UseTableEditorReturn
}

export function SecondaryToolbar({ editor }: SecondaryToolbarProps) {
	const { selectedCol, selectedRow, clearTable, resetTable } = editor

	const hasSelection = selectedCol !== null || selectedRow !== null

	return (
		<div className="p-2 px-4 border-b border-border flex items-center gap-2 bg-muted/5">
			<button
				onClick={clearTable}
				className="flex items-center justify-center gap-1.5 h-7 px-2.5 rounded-md border border-border text-xs text-muted-foreground bg-transparent hover:bg-muted hover:text-foreground transition-all cursor-pointer"
				title="Limpiar contenido de las celdas"
			>
				<Trash2 className="w-3 h-3" />
				<span>Limpiar celdas</span>
			</button>
			<button
				onClick={resetTable}
				className="flex items-center justify-center gap-1.5 h-7 px-2.5 rounded-md border border-border text-xs text-muted-foreground bg-transparent hover:bg-muted hover:text-foreground transition-all cursor-pointer"
				title="Reiniciar a tabla 3×3"
			>
				<RotateCcw className="w-3 h-3" />
				<span>Reiniciar (3×3)</span>
			</button>

			{!hasSelection && (
				<span className="ml-auto text-[11px] text-muted-foreground/70 italic">
					💡 Clic en celda para seleccionar
				</span>
			)}
		</div>
	)
}
