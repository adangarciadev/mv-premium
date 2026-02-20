/**
 * DraftCard - Card component for displaying draft/template items
 * Supports selection and drag & drop
 */
import { memo, useState } from 'react'
import Pencil from 'lucide-react/dist/esm/icons/pencil'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open'
import Clock from 'lucide-react/dist/esm/icons/clock'
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import Tag from 'lucide-react/dist/esm/icons/tag'
import Check from 'lucide-react/dist/esm/icons/check'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { formatRelativeDate } from '@/lib/date-utils'
import { ALL_SUBFORUMS } from '@/lib/subforums'
import { getCategoriesForSubforum } from '@/lib/subforum-categories'
import type { Draft } from '@/features/drafts/storage'

// ============================================================================
// Types
// ============================================================================

export interface DraftCardProps {
	draft: Draft
	/** Whether this card is selected */
	isSelected?: boolean
	/** Whether to show the checkbox (true when any card is selected) */
	showCheckbox?: boolean
	/** Callback when selection checkbox is clicked — receives draftId for stable reference */
	onSelect?: (draftId: string, event: React.MouseEvent) => void
	onEdit: (draft: Draft) => void
	onDuplicate: (draft: Draft) => void
	onDelete: (draft: Draft) => void
	onMove: (draft: Draft) => void
	/** Called when converting draft to template or vice versa */
	onConvert?: (draft: Draft) => void
}

// ============================================================================
// Component
// ============================================================================

export const DraftCard = memo(function DraftCard({
	draft,
	isSelected = false,
	showCheckbox = false,
	onSelect,
	onEdit,
	onDuplicate,
	onDelete,
	onMove,
	onConvert,
}: DraftCardProps) {
	const subforum = ALL_SUBFORUMS.find(s => s.slug === draft.subforum)
	const isTemplate = draft.type === 'template'

	// Get category name from the subforum's categories
	const categoryName =
		draft.subforum && draft.category
			? getCategoriesForSubforum(draft.subforum).find(c => c.value === draft.category)?.label
			: undefined

	const safeContent = String(draft.content || '')
	const timeAgo = formatRelativeDate(draft.updatedAt)
	const wordCount = safeContent.split(/\s+/).filter(Boolean).length
	const wordLabel = wordCount === 1 ? 'palabra' : 'palabras'

	// Drag state for visual feedback
	const [isDragging, setIsDragging] = useState(false)

	const handleDragStart = (e: React.DragEvent) => {
		e.dataTransfer.setData('text/plain', draft.id)
		e.dataTransfer.effectAllowed = 'move'
		setIsDragging(true)
	}

	const handleDragEnd = () => {
		setIsDragging(false)
	}

	// Handle checkbox click without triggering card drag
	const handleCheckboxClick = (e: React.MouseEvent) => {
		e.stopPropagation()
		e.preventDefault()
		onSelect?.(draft.id, e)
	}

	return (
		<Card
			draggable
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			className={cn(
				'group relative flex flex-col transition-all cursor-grab active:cursor-grabbing',
				'bg-card hover:shadow-md hover:border-primary/30',
				isDragging && 'opacity-50 scale-[0.98] shadow-lg ring-2 ring-primary/30',
				isTemplate && 'border-primary/30',
				isSelected && 'ring-2 ring-primary border-primary bg-primary/10'
			)}
		>
			{/* Selection Checkbox */}
			<button
				type="button"
				onClick={handleCheckboxClick}
				className={cn(
					'absolute top-2 left-2 z-10 h-5 w-5 rounded border-2 flex items-center justify-center transition-all',
					'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
					isSelected
						? 'bg-primary border-primary text-primary-foreground'
						: 'bg-background border-muted-foreground/30 hover:border-primary/50',
					// Show on hover or when any item is selected
					showCheckbox || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
				)}
			>
				{isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
			</button>

			<CardHeader className="pb-2">
				<div className="flex items-start justify-between gap-2 min-w-0">
					<div className="flex items-center gap-2 min-w-0 pl-6">
						<CardTitle className="text-sm font-semibold line-clamp-2 leading-tight wrap-break-word min-w-0">
							{draft.title || 'Sin título'}
						</CardTitle>
					</div>
					<DropdownMenu modal={false}>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
								onClick={e => e.stopPropagation()}
							>
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onSelect={() => onEdit(draft)}>
								<Pencil className="h-4 w-4 mr-2" />
								Editar
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => onMove(draft)}>
								<FolderOpen className="h-4 w-4 mr-2" />
								Mover a carpeta
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => onDuplicate(draft)}>
								<Copy className="h-4 w-4 mr-2" />
								Duplicar
							</DropdownMenuItem>
							{onConvert && (
								<DropdownMenuItem onSelect={() => onConvert(draft)}>
									<RefreshCw className="h-4 w-4 mr-2" />
									{isTemplate ? 'Convertir a borrador' : 'Convertir a plantilla'}
								</DropdownMenuItem>
							)}
							<DropdownMenuSeparator />
							<DropdownMenuItem onSelect={() => onDelete(draft)} className="text-destructive">
								<Trash2 className="h-4 w-4 mr-2" />
								Eliminar
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				{/* Badges - Type indicator, Trigger, Subforum & Category */}
				<div className="flex flex-wrap gap-1 mt-1.5 pl-6">
					{isTemplate && draft.trigger && (
						<Badge className="text-[10px] shrink-0 bg-primary/15 text-primary border-primary/30 font-mono">
							/{draft.trigger}
						</Badge>
					)}
					{subforum && (
						<Badge
							variant={isTemplate ? 'default' : 'secondary'}
							className={cn(
								'text-[9px] font-bold uppercase tracking-wider px-1.5 h-5 shrink-0',
								isTemplate && 'bg-primary text-primary-foreground'
							)}
						>
							{subforum.name}
						</Badge>
					)}
					{categoryName && (
						<Badge
							variant="outline"
							className="text-[9px] font-bold uppercase tracking-wider px-1.5 h-5 shrink-0 opacity-80 gap-1"
						>
							<Tag className="h-2.5 w-2.5" />
							{categoryName}
						</Badge>
					)}
				</div>
			</CardHeader>

			<CardContent className="flex-1 pb-3">
				<p className="text-xs text-muted-foreground line-clamp-4 leading-relaxed">
					{safeContent.replace(/\[.*?\]/g, '').trim() || 'Sin contenido'}
				</p>
			</CardContent>

			<CardFooter className="border-t pt-2.5 flex items-center justify-between text-[10px] text-muted-foreground">
				<span>
					{wordCount} {wordLabel}
				</span>
				<div className="flex items-center gap-1">
					<Clock className="h-3 w-3" />
					{timeAgo}
				</div>
			</CardFooter>
		</Card>
	)
})
