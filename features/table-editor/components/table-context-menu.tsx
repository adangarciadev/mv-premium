import { useEffect, useRef } from 'react'
import AlignLeft from 'lucide-react/dist/esm/icons/align-left'
import AlignCenter from 'lucide-react/dist/esm/icons/align-center'
import AlignRight from 'lucide-react/dist/esm/icons/align-right'
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left'
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right'
import ArrowUp from 'lucide-react/dist/esm/icons/arrow-up'
import ArrowDown from 'lucide-react/dist/esm/icons/arrow-down'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import { cn } from '@/lib/utils'
import type { ColumnAlignment } from '../types'
import type { UseTableEditorReturn } from '../hooks/use-table-editor'
import { MIN_ROWS, MIN_COLS } from '../constants'

interface ContextMenuItemProps {
	icon: React.ReactNode
	label: string
	onClick: () => void
	disabled?: boolean
	danger?: boolean
}

function ContextMenuItem({ icon, label, onClick, disabled, danger }: ContextMenuItemProps) {
	const handleClick = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		if (!disabled) {
			onClick()
		}
	}

	return (
		<button
			onMouseDown={e => e.stopPropagation()}
			onClick={handleClick}
			disabled={disabled}
			className={cn(
				'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors text-left',
				disabled
					? 'opacity-40 cursor-not-allowed text-muted-foreground'
					: danger
					? 'text-destructive hover:bg-destructive/10 cursor-pointer'
					: 'text-foreground hover:bg-muted cursor-pointer'
			)}
		>
			<span className="w-4 h-4 flex items-center justify-center flex-shrink-0">{icon}</span>
			<span className="flex-1">{label}</span>
		</button>
	)
}

interface TableContextMenuProps {
	editor: UseTableEditorReturn
	x: number
	y: number
	rowIndex: number
	colIndex: number
	onClose: () => void
}

export function TableContextMenu({ editor, x, y, rowIndex, colIndex, onClose }: TableContextMenuProps) {
	const menuRef = useRef<HTMLDivElement>(null)
	const {
		numRows,
		numCols,
		alignments,
		setColumnAlignment,
		insertColumnLeft,
		insertColumnRight,
		deleteColumn,
		moveColumnLeft,
		moveColumnRight,
		insertRowAbove,
		insertRowBelow,
		deleteRow,
		moveRowUp,
		moveRowDown,
	} = editor

	const isHeaderRow = rowIndex === 0
	const canDeleteColumn = numCols > MIN_COLS
	const canDeleteRow = numRows > MIN_ROWS && !isHeaderRow
	const canMoveColumnLeft = colIndex > 0
	const canMoveColumnRight = colIndex < numCols - 1
	const canMoveRowUp = rowIndex > 1 // Can't move header or first data row above header
	const canMoveRowDown = rowIndex > 0 && rowIndex < numRows - 1

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose()
			}
		}
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
		}
		document.addEventListener('mousedown', handleClickOutside)
		document.addEventListener('keydown', handleEscape)
		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
			document.removeEventListener('keydown', handleEscape)
		}
	}, [onClose])

	// Adjust position to keep menu in viewport
	const menuStyle: React.CSSProperties = {
		position: 'fixed',
		left: x,
		top: y,
		zIndex: 9999,
	}

	const handleAction = (action: () => void) => {
		action()
		onClose()
	}

	const currentAlignment = alignments[colIndex]

	const menuContent = (
		<div
			ref={menuRef}
			style={menuStyle}
			className="bg-background border border-border rounded-lg shadow-xl py-1 min-w-[200px] pointer-events-auto mv-table-context-menu"
			onMouseDown={e => e.stopPropagation()}
			onClick={e => e.stopPropagation()}
			onPointerDown={e => e.stopPropagation()}
		>
			{/* Column section header */}
			<div className="px-3 py-1.5 text-[10px] font-bold tracking-wide text-primary/60 uppercase">
				Columna
			</div>

			{/* Alignment */}
			<div className="px-3 py-1.5 flex items-center gap-1">
				<span className="text-[11px] text-muted-foreground mr-2">Alinear:</span>
				{(['left', 'center', 'right'] as ColumnAlignment[]).map(align => {
					const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight
					const isActive = currentAlignment === align
					return (
						<button
							key={align}
							onClick={() => setColumnAlignment(colIndex, align)}
							className={cn(
								'w-7 h-7 flex items-center justify-center rounded-md transition-colors cursor-pointer',
								isActive
									? 'bg-primary text-primary-foreground'
									: 'text-muted-foreground hover:bg-muted hover:text-foreground'
							)}
							title={align === 'left' ? 'Izquierda' : align === 'center' ? 'Centro' : 'Derecha'}
						>
							<Icon className="w-3.5 h-3.5" />
						</button>
					)
				})}
			</div>

			<div className="h-px bg-border my-1" />

			<ContextMenuItem
				icon={<Plus className="w-4 h-4" />}
				label="Insertar columna a la izquierda"
				onClick={() => handleAction(() => insertColumnLeft(colIndex))}
			/>
			<ContextMenuItem
				icon={<Plus className="w-4 h-4" />}
				label="Insertar columna a la derecha"
				onClick={() => handleAction(() => insertColumnRight(colIndex))}
			/>
			<ContextMenuItem
				icon={<Trash2 className="w-4 h-4" />}
				label="Eliminar columna"
				onClick={() => handleAction(() => deleteColumn(colIndex))}
				disabled={!canDeleteColumn}
				danger
			/>
			<ContextMenuItem
				icon={<ArrowLeft className="w-4 h-4" />}
				label="Mover columna a la izquierda"
				onClick={() => handleAction(() => moveColumnLeft(colIndex))}
				disabled={!canMoveColumnLeft}
			/>
			<ContextMenuItem
				icon={<ArrowRight className="w-4 h-4" />}
				label="Mover columna a la derecha"
				onClick={() => handleAction(() => moveColumnRight(colIndex))}
				disabled={!canMoveColumnRight}
			/>

			<div className="h-px bg-border my-1" />

			{/* Row section header */}
			<div className="px-3 py-1.5 text-[10px] font-bold tracking-wide text-primary/60 uppercase">
				Fila {isHeaderRow && <span className="text-muted-foreground normal-case font-normal">(cabecera)</span>}
			</div>

			<ContextMenuItem
				icon={<Plus className="w-4 h-4" />}
				label="Insertar fila arriba"
				onClick={() => handleAction(() => insertRowAbove(rowIndex))}
				disabled={isHeaderRow}
			/>
			<ContextMenuItem
				icon={<Plus className="w-4 h-4" />}
				label="Insertar fila abajo"
				onClick={() => handleAction(() => insertRowBelow(rowIndex))}
			/>
			<ContextMenuItem
				icon={<Trash2 className="w-4 h-4" />}
				label="Eliminar fila"
				onClick={() => handleAction(() => deleteRow(rowIndex))}
				disabled={!canDeleteRow}
				danger
			/>
			<ContextMenuItem
				icon={<ArrowUp className="w-4 h-4" />}
				label="Mover fila arriba"
				onClick={() => handleAction(() => moveRowUp(rowIndex))}
				disabled={!canMoveRowUp}
			/>
			<ContextMenuItem
				icon={<ArrowDown className="w-4 h-4" />}
				label="Mover fila abajo"
				onClick={() => handleAction(() => moveRowDown(rowIndex))}
				disabled={!canMoveRowDown}
			/>
		</div>
	)

	return menuContent
}
