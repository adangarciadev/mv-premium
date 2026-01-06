import { useEffect, useRef, useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogPortal, DialogOverlay } from '@/components/ui/dialog'
import Table2 from 'lucide-react/dist/esm/icons/table-2'
import X from 'lucide-react/dist/esm/icons/x'
import type { TableEditorDialogProps } from '../types'
import { DEFAULT_COLS } from '../constants'
import { useTableEditor } from '../hooks/use-table-editor'
import { TableToolbar, SecondaryToolbar } from './table-toolbar'
import { TableGrid } from './table-grid'
import { MarkdownPreview } from './markdown-preview'
import { TableContextMenu } from './table-context-menu'

interface ContextMenuState {
	isOpen: boolean
	x: number
	y: number
	rowIndex: number
	colIndex: number
}

export function TableEditorDialog({ isOpen, onClose, onInsert, initialData }: TableEditorDialogProps) {
	const editor = useTableEditor()
	const tableContainerRef = useRef<HTMLDivElement>(null)


	const [contextMenu, setContextMenu] = useState<ContextMenuState>({
		isOpen: false,
		x: 0,
		y: 0,
		rowIndex: 0,
		colIndex: 0,
	})

	const isEditing = !!initialData

	// Reset state when dialog opens
	useEffect(() => {
		if (isOpen) {
			if (initialData) {
				// Editing existing table - use provided data
				editor.setTableSize(initialData.cells.length, initialData.cells[0]?.length || DEFAULT_COLS)
				// Update cells individually
				initialData.cells.forEach((row, rowIndex) => {
					row.forEach((cell, colIndex) => {
						editor.updateCell(rowIndex, colIndex, cell)
					})
				})
				// Update alignments
				initialData.alignments.forEach((alignment, colIndex) => {
					editor.setColumnAlignment(colIndex, alignment)
				})
			} else {
				// Creating new table - reset to defaults
				editor.resetTable()
			}
			editor.setSelectedCol(null)
			editor.setSelectedRow(null)
			setContextMenu(prev => ({ ...prev, isOpen: false }))
		}
	}, [isOpen, initialData])

	const handleInsert = () => {
		const markdown = editor.generateMarkdown()
		onInsert(markdown)
		onClose()
	}

	const handleContextMenu = useCallback((e: React.MouseEvent, rowIndex: number, colIndex: number) => {
		setContextMenu({
			isOpen: true,
			x: e.clientX,
			y: e.clientY,
			rowIndex,
			colIndex,
		})
	}, [])

	const closeContextMenu = useCallback(() => {
		setContextMenu(prev => ({ ...prev, isOpen: false }))
	}, [])

	return (
		<Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
			<DialogContent
				className="p-0 gap-0 border-border rounded-xl flex flex-col w-[800px] h-[640px] max-w-[95vw] max-h-[85vh] overflow-visible"
				showCloseButton={false}
				onPointerDownOutside={e => {
					const target = e.target as HTMLElement
					if (target.closest('.mv-table-context-menu')) {
						e.preventDefault()
					}
				}}
				onInteractOutside={e => {
					const target = e.target as HTMLElement
					if (target.closest('.mv-table-context-menu')) {
						e.preventDefault()
					}
				}}
			>
				{/* Header */}
				<DialogHeader className="p-4 px-5 border-b border-border flex flex-row items-center justify-between">
					<DialogTitle className="flex items-center gap-2.5 text-foreground text-[15px] font-semibold">
						<div className="p-1.5 rounded-lg bg-primary/15 flex">
							<Table2 className="w-4 h-4 text-primary" />
						</div>
						{isEditing ? 'Editar Tabla' : 'Insertar Tabla'}
					</DialogTitle>
					<button
						onClick={onClose}
						className="flex items-center justify-center w-7 h-7 rounded-md border-none bg-transparent text-muted-foreground cursor-pointer transition-all hover:bg-muted hover:text-foreground"
						title="Cerrar"
					>
						<X className="w-[18px] h-[18px]" />
					</button>
				</DialogHeader>

				{/* Main Toolbar */}
				<TableToolbar editor={editor} />

				{/* Secondary Toolbar */}
				<SecondaryToolbar editor={editor} />

				{/* Table Container with scroll */}
				<div
					ref={tableContainerRef}
					className="flex-1 overflow-auto p-4 min-h-[200px] max-h-[350px] scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
					onWheel={e => {
						e.stopPropagation()
					}}
				>
					<TableGrid editor={editor} onContextMenu={handleContextMenu} />
				</div>

				{/* Preview Section */}
				<MarkdownPreview generateMarkdown={editor.generateMarkdown} />

				{/* Footer */}
				<DialogFooter className="p-3 px-4 border-t border-border flex justify-end gap-2 bg-muted/10">
					<button
						onClick={onClose}
						className="h-9 px-4 rounded-md border border-border bg-transparent text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
					>
						Cancelar
					</button>
					<button
						onClick={handleInsert}
						className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm cursor-pointer border-none"
					>
						{isEditing ? 'Actualizar Tabla' : 'Insertar Tabla'}
					</button>
				</DialogFooter>
			</DialogContent>

			{/* Context Menu - rendered via separate portal to escape DialogContent overflow */}
			{contextMenu.isOpen && (
				<DialogPortal>
					<TableContextMenu
						editor={editor}
						x={contextMenu.x}
						y={contextMenu.y}
						rowIndex={contextMenu.rowIndex}
						colIndex={contextMenu.colIndex}
						onClose={closeContextMenu}
					/>
				</DialogPortal>
			)}
		</Dialog>
	)
}

// Re-export types for convenience
export type { TableEditorDialogProps, TableInitialData, ColumnAlignment } from '../types'
