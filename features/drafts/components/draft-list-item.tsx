/**
 * Draft List Item Component
 * Renders a single draft item in the list
 */
import { Button } from '@/components/ui/button'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Tag from 'lucide-react/dist/esm/icons/tag'
import { cn } from '@/lib/utils'
import type { Draft } from '@/features/drafts/storage'

interface DraftListItemProps {
	draft: Draft
	isSelected: boolean
	onSelect: (draft: Draft) => void
	onDelete: (draft: Draft) => void
	formatRelativeTime: (timestamp: number) => string
}

export function DraftListItem({ draft, isSelected, onSelect, onDelete, formatRelativeTime }: DraftListItemProps) {
	return (
		<div
			onClick={() => onSelect(draft)}
			className={cn(
				'group relative flex flex-col gap-1 p-2.5 px-3 text-sm cursor-pointer rounded-md border-l-2 transition-colors',
				isSelected
					? 'bg-accent border-l-primary'
					: 'bg-transparent border-l-transparent hover:bg-muted'
			)}
		>
			<div className="flex items-center justify-between gap-2 overflow-hidden mb-0.5">
				<div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
					<span
						className={cn(
							'font-medium truncate text-sm',
							isSelected ? 'text-foreground' : 'text-foreground/80 group-hover:text-foreground'
						)}
						title={draft.title}
					>
						{draft.title ? draft.title : <span className="italic text-muted-foreground">Sin título</span>}
					</span>
					{draft.categoryLabel && (
						<span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-background text-foreground border border-border shadow-sm whitespace-nowrap flex items-center gap-1">
							<Tag className="w-3 h-3 text-muted-foreground" />
							{draft.categoryLabel}
						</span>
					)}
				</div>
				<div className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
					{formatRelativeTime(draft.updatedAt)}
				</div>
			</div>

			<div className="text-xs line-clamp-1 text-muted-foreground group-hover:text-muted-foreground/80">
				{draft.content || <span className="italic">Sin contenido...</span>}
			</div>
		</div>
	)
}
