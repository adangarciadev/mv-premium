/**
 * AllDraftsDropTarget - Drop target button for "All Drafts/Templates" in sidebar
 */
import { useState } from 'react'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export interface AllDraftsDropTargetProps {
	isSelected: boolean
	draftsCount: number
	onClick: () => void
	onDrop: (draftId: string) => void
	isTemplate?: boolean
}

// ============================================================================
// Component
// ============================================================================

export function AllDraftsDropTarget({
	isSelected,
	draftsCount,
	onClick,
	onDrop,
	isTemplate,
}: AllDraftsDropTargetProps) {
	const [isDragOver, setIsDragOver] = useState(false)

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
		if (draftId) {
			onDrop(draftId)
		}
	}

	return (
		<button
			onClick={onClick}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			className={cn(
				'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all',
				'hover:bg-muted/50',
				isSelected && 'bg-accent/50 text-primary font-semibold',
				isDragOver && 'bg-primary/20 ring-2 ring-primary ring-offset-1'
			)}
		>
			<FileText className="h-4 w-4" />
			<span className="flex-1 text-sm">{isTemplate ? 'Todas las plantillas' : 'Todos los borradores'}</span>
			<Badge className="h-5 px-1.5 text-[10px] bg-primary text-primary-foreground font-bold shadow-sm">
				{draftsCount}
			</Badge>
		</button>
	)
}
