/**
 * FolderItem - Folder button for the sidebar with drag & drop support
 */
import { useState } from 'react'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal'
import Folder from 'lucide-react/dist/esm/icons/folder'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { DraftFolder } from '@/features/drafts/storage'

// ============================================================================
// Types
// ============================================================================

export interface FolderWithCount extends DraftFolder {
	count: number
}

export interface FolderItemProps {
	folder: FolderWithCount
	isSelected: boolean
	onClick: () => void
	onDrop?: (draftId: string) => void
	onDelete?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function FolderItem({ folder, isSelected, onClick, onDrop, onDelete }: FolderItemProps) {
	const [isDragOver, setIsDragOver] = useState(false)
	const [justDropped, setJustDropped] = useState(false)

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault()
		e.dataTransfer.dropEffect = 'move'
		setIsDragOver(true)
	}

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault()
		setIsDragOver(false)
	}

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault()
		setIsDragOver(false)
		const draftId = e.dataTransfer.getData('text/plain')
		if (draftId && onDrop) {
			onDrop(draftId)
			// Trigger drop animation
			setJustDropped(true)
			setTimeout(() => setJustDropped(false), 500)
		}
	}

	return (
		<div className="group flex items-center gap-1">
			<button
				onClick={onClick}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				className={cn(
					'flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all',
					'hover:bg-muted/50',
					isSelected && 'bg-accent/50 text-primary font-semibold',
					isDragOver && 'bg-primary/20 ring-2 ring-primary ring-offset-1 scale-[1.02]',
					justDropped && 'animate-pulse bg-green-500/20 ring-2 ring-green-500'
				)}
			>
				<Folder className="h-5 w-5" />
				<span className="flex-1 truncate text-sm">{folder.name}</span>
				{folder.count > 0 && (
					<Badge className="h-5 px-1.5 text-[10px] bg-primary text-primary-foreground font-bold shadow-sm">
						{folder.count}
					</Badge>
				)}
			</button>
			{onDelete && (
				<DropdownMenu modal={false}>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className={cn(
								'h-7 w-7 transition-opacity shrink-0',
								isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
							)}
							onClick={e => e.stopPropagation()}
						>
							<MoreHorizontal className="h-3.5 w-3.5" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
							<Trash2 className="h-4 w-4 mr-2" />
							Eliminar carpeta
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	)
}
