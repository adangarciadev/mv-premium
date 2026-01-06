import { useState, useRef, useEffect } from 'react'
import Columns3 from 'lucide-react/dist/esm/icons/columns-3'
import Rows3 from 'lucide-react/dist/esm/icons/rows-3'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
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

interface MenuItemProps {
	icon: React.ReactNode
	label: string
	onClick: () => void
	disabled?: boolean
	hasSubmenu?: boolean
	danger?: boolean
}

function MenuItem({ icon, label, onClick, disabled, hasSubmenu, danger }: MenuItemProps) {
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
				'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
				disabled
					? 'opacity-40 cursor-not-allowed text-muted-foreground'
					: danger
					? 'text-destructive hover:bg-destructive/10 cursor-pointer'
					: 'text-foreground hover:bg-muted cursor-pointer'
			)}
		>
			<span className="w-4 h-4 flex items-center justify-center flex-shrink-0">{icon}</span>
			<span className="flex-1 text-left">{label}</span>
			{hasSubmenu && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
		</button>
	)
}

interface AlignSubmenuProps {
	currentAlignment: ColumnAlignment
	onSelect: (alignment: ColumnAlignment) => void
}

function AlignSubmenu({ currentAlignment, onSelect }: AlignSubmenuProps) {
	const alignments: { value: ColumnAlignment; label: string; icon: React.ReactNode }[] = [
		{ value: 'left', label: 'Izquierda', icon: <AlignLeft className="w-4 h-4" /> },
		{ value: 'center', label: 'Centro', icon: <AlignCenter className="w-4 h-4" /> },
		{ value: 'right', label: 'Derecha', icon: <AlignRight className="w-4 h-4" /> },
	]

	const handleClick = (e: React.MouseEvent, value: ColumnAlignment) => {
		e.preventDefault()
		e.stopPropagation()
		onSelect(value)
	}

	return (
		<div className="absolute left-full top-0 ml-1">
			<div className="bg-background border border-border rounded-lg shadow-xl py-1 min-w-[140px]">
			{alignments.map(align => (
				<button
					key={align.value}
					onMouseDown={e => e.stopPropagation()}
					onClick={e => handleClick(e, align.value)}
					className={cn(
						'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors cursor-pointer',
						currentAlignment === align.value
							? 'bg-primary/10 text-primary'
							: 'text-foreground hover:bg-muted'
					)}
				>
					{align.icon}
					<span>{align.label}</span>
					{currentAlignment === align.value && (
						<span className="ml-auto text-primary">✓</span>
					)}
				</button>
			))}
			</div>
		</div>
	)
}

interface ColumnMenuProps {
	editor: UseTableEditorReturn
}

export function ColumnMenu({ editor }: ColumnMenuProps) {
	const [isOpen, setIsOpen] = useState(false)
	const [showAlignSubmenu, setShowAlignSubmenu] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)

	const { selectedCol, numCols, alignments, setColumnAlignment, insertColumnLeft, insertColumnRight, deleteColumn, moveColumnLeft, moveColumnRight } = editor

	const hasSelection = selectedCol !== null
	const canMoveLeft = hasSelection && selectedCol > 0
	const canMoveRight = hasSelection && selectedCol < numCols - 1
	const canDelete = numCols > MIN_COLS

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setIsOpen(false)
				setShowAlignSubmenu(false)
			}
		}
		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside)
		}
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [isOpen])

	const handleAction = (action: () => void) => {
		action()
		setIsOpen(false)
		setShowAlignSubmenu(false)
	}

	return (
		<div ref={menuRef} className="relative">
			<button
				onClick={() => setIsOpen(!isOpen)}
				className={cn(
					'flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-medium transition-all cursor-pointer',
					isOpen
						? 'bg-primary/10 text-primary border-primary/30'
						: 'bg-transparent text-muted-foreground border-border hover:bg-muted hover:text-foreground'
				)}
			>
				<Columns3 className="w-3.5 h-3.5" />
				<span>Columna</span>
				<ChevronDown className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
			</button>

			{isOpen && (
				<div className="absolute top-full left-0 mt-1 z-50 bg-background border border-border rounded-lg shadow-xl py-1 min-w-[180px]">
				{/* Align submenu */}
					<div
						className="relative"
						onMouseEnter={() => setShowAlignSubmenu(true)}
						onMouseLeave={() => setShowAlignSubmenu(false)}
					>
						{/* Invisible bridge to prevent menu closing when moving to submenu */}
						{showAlignSubmenu && (
							<div className="absolute top-0 -right-4 bottom-0 w-8 bg-transparent z-40" />
						)}
						<MenuItem
							icon={<AlignLeft className="w-4 h-4" />}
							label="Alineación de texto"
							onClick={() => {}}
							disabled={!hasSelection}
							hasSubmenu
						/>
						{showAlignSubmenu && hasSelection && (
							<AlignSubmenu
								currentAlignment={alignments[selectedCol!]}
								onSelect={alignment => handleAction(() => setColumnAlignment(selectedCol!, alignment))}
							/>
						)}
					</div>

					<div className="h-px bg-border my-1" />

					<MenuItem
						icon={<Plus className="w-4 h-4" />}
						label="Insertar a la izquierda"
						onClick={() => handleAction(() => insertColumnLeft(selectedCol ?? 0))}
						disabled={!hasSelection}
					/>
					<MenuItem
						icon={<Plus className="w-4 h-4" />}
						label="Insertar a la derecha"
						onClick={() => handleAction(() => insertColumnRight(selectedCol ?? numCols - 1))}
						disabled={!hasSelection}
					/>

					<div className="h-px bg-border my-1" />

					<MenuItem
						icon={<Trash2 className="w-4 h-4" />}
						label="Eliminar"
						onClick={() => handleAction(() => deleteColumn(selectedCol!))}
						disabled={!hasSelection || !canDelete}
						danger
					/>

					<div className="h-px bg-border my-1" />

					<MenuItem
						icon={<ArrowLeft className="w-4 h-4" />}
						label="Mover a la izquierda"
						onClick={() => handleAction(() => moveColumnLeft(selectedCol!))}
						disabled={!canMoveLeft}
					/>
					<MenuItem
						icon={<ArrowRight className="w-4 h-4" />}
						label="Mover a la derecha"
						onClick={() => handleAction(() => moveColumnRight(selectedCol!))}
						disabled={!canMoveRight}
					/>
				</div>
			)}
		</div>
	)
}

interface RowMenuProps {
	editor: UseTableEditorReturn
}

export function RowMenu({ editor }: RowMenuProps) {
	const [isOpen, setIsOpen] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)

	const { selectedRow, numRows, insertRowAbove, insertRowBelow, deleteRow, moveRowUp, moveRowDown } = editor

	const hasSelection = selectedRow !== null
	// Cannot move header row (row 0)
	const canMoveUp = hasSelection && selectedRow > 1
	const canMoveDown = hasSelection && selectedRow < numRows - 1 && selectedRow > 0
	const canDelete = numRows > MIN_ROWS && hasSelection && selectedRow > 0 // Cannot delete header row

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setIsOpen(false)
			}
		}
		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside)
		}
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [isOpen])

	const handleAction = (action: () => void) => {
		action()
		setIsOpen(false)
	}

	return (
		<div ref={menuRef} className="relative">
			<button
				onClick={() => setIsOpen(!isOpen)}
				className={cn(
					'flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-medium transition-all cursor-pointer',
					isOpen
						? 'bg-primary/10 text-primary border-primary/30'
						: 'bg-transparent text-muted-foreground border-border hover:bg-muted hover:text-foreground'
				)}
			>
				<Rows3 className="w-3.5 h-3.5" />
				<span>Fila</span>
				<ChevronDown className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
			</button>

			{isOpen && (
				<div className="absolute top-full left-0 mt-1 z-50 bg-background border border-border rounded-lg shadow-xl py-1 min-w-[160px]">
					<MenuItem
						icon={<Plus className="w-4 h-4" />}
						label="Insertar arriba"
						onClick={() => handleAction(() => insertRowAbove(selectedRow ?? 1))}
						disabled={!hasSelection || selectedRow === 0}
					/>
					<MenuItem
						icon={<Plus className="w-4 h-4" />}
						label="Insertar abajo"
						onClick={() => handleAction(() => insertRowBelow(selectedRow ?? numRows - 1))}
						disabled={!hasSelection}
					/>

					<div className="h-px bg-border my-1" />

					<MenuItem
						icon={<Trash2 className="w-4 h-4" />}
						label="Eliminar"
						onClick={() => handleAction(() => deleteRow(selectedRow!))}
						disabled={!canDelete}
						danger
					/>

					<div className="h-px bg-border my-1" />

					<MenuItem
						icon={<ArrowUp className="w-4 h-4" />}
						label="Mover arriba"
						onClick={() => handleAction(() => moveRowUp(selectedRow!))}
						disabled={!canMoveUp}
					/>
					<MenuItem
						icon={<ArrowDown className="w-4 h-4" />}
						label="Mover abajo"
						onClick={() => handleAction(() => moveRowDown(selectedRow!))}
						disabled={!canMoveDown}
					/>
				</div>
			)}
		</div>
	)
}
