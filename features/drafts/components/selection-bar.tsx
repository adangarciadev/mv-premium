/**
 * SelectionBar - Floating action bar for bulk operations on selected drafts
 * Appears at the bottom of the screen when items are selected
 */
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Folder from 'lucide-react/dist/esm/icons/folder'
import FolderX from 'lucide-react/dist/esm/icons/folder-x'
import X from 'lucide-react/dist/esm/icons/x'
import CheckSquare from 'lucide-react/dist/esm/icons/check-square'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { FolderWithCount } from './folder-item'

// ============================================================================
// Types
// ============================================================================

export interface SelectionBarProps {
	/** Number of selected items */
	selectedCount: number
	/** Total count of items (for "select all") */
	totalCount: number
	/** Whether we're in template or draft mode */
	isTemplate?: boolean
	/** Available folders for moving */
	folders?: FolderWithCount[]
	/** Callback to move selected items to a folder */
	onMove: (folderId: string | undefined) => void
	/** Callback to delete selected items */
	onDelete: () => void
	/** Callback to clear selection */
	onDeselect: () => void
	/** Callback to select all items */
	onSelectAll?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function SelectionBar({
	selectedCount,
	totalCount,
	isTemplate = false,
	folders = [],
	onMove,
	onDelete,
	onDeselect,
	onSelectAll,
}: SelectionBarProps) {
	if (selectedCount === 0) return null

	const itemLabel = isTemplate ? 'plantilla' : 'borrador'
	const itemLabelPlural = isTemplate ? 'plantillas' : 'borradores'
	const selectedLabel = selectedCount === 1 ? itemLabel : itemLabelPlural
	const canSelectMore = totalCount > selectedCount

	return (
		<div
			className={cn(
				'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
				'flex items-center gap-3 px-4 py-3',
				'bg-card border rounded-xl shadow-lg',
				'animate-in slide-in-from-bottom-4 fade-in duration-200'
			)}
		>
			{/* Selection count */}
			<div className="flex items-center gap-2 pr-3 border-r">
				<span className="text-sm font-medium">
					{selectedCount} {selectedLabel} seleccionado{selectedCount > 1 ? 's' : ''}
				</span>
			</div>

			{/* Select all button */}
			{onSelectAll && canSelectMore && (
				<Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={onSelectAll}>
					<CheckSquare className="h-4 w-4" />
					Seleccionar todo ({totalCount - selectedCount} más)
				</Button>
			)}

			{/* Move button with dropdown */}
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" size="sm" className="h-8 gap-1.5">
						<Folder className="h-4 w-4" />
						Mover
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="center" className="w-48">
					<DropdownMenuItem onClick={() => onMove(undefined)}>
						<FolderX className="h-4 w-4 mr-2 text-muted-foreground" />
						Sin carpeta
					</DropdownMenuItem>
					{folders.length > 0 && <DropdownMenuSeparator />}
					{folders.map(folder => (
						<DropdownMenuItem key={folder.id} onClick={() => onMove(folder.id)}>
							<Folder className="h-4 w-4 mr-2 text-muted-foreground" />
							{folder.name}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Delete button */}
			<Button variant="destructive" size="sm" className="h-8 gap-1.5" onClick={onDelete}>
				<Trash2 className="h-4 w-4" />
				Eliminar
			</Button>

			{/* Deselect button */}
			<Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={onDeselect}>
				<X className="h-4 w-4" />
				Deseleccionar
			</Button>
		</div>
	)
}
