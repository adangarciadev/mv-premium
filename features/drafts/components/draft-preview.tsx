/**
 * Draft Preview Component
 * Renders the content of the selected draft and handles title editing
 */
import { useEffect, useRef, useState } from 'react'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Upload from 'lucide-react/dist/esm/icons/upload'
import Edit2 from 'lucide-react/dist/esm/icons/edit-2'
import Check from 'lucide-react/dist/esm/icons/check'
import X from 'lucide-react/dist/esm/icons/x'
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left'
import Clock from 'lucide-react/dist/esm/icons/clock'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Tag from 'lucide-react/dist/esm/icons/tag'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, stopKeyboardPropagation as stopPropagation } from '@/lib/utils'
import type { Draft } from '@/features/drafts/storage'
import { MVPreview } from '@/components/preview-system'

interface DraftPreviewProps {
	draft: Draft
	editingId: string | null
	editValue: string
	copiedId: string | null
	onBack: () => void
	onEditStart: (draft: Draft) => void
	onEditCancel: () => void
	onEditSave: (id: string) => void
	onEditChange: (value: string) => void
	onDelete: (id: string) => void
	onRestore: (draft: Draft) => void
	onCopy: (content: string, id: string) => void
}

export function DraftPreview({
	draft,
	editingId,
	editValue,
	copiedId,
	onBack,
	onEditStart,
	onEditCancel,
	onEditSave,
	onEditChange,
	onDelete,
	onRestore,
	onCopy,
}: DraftPreviewProps) {
	// State to handle focus on mount
	const contentRef = useRef<HTMLDivElement>(null)
	
	// Focus content area when draft changes
	// The provided snippet for useEffect was incomplete and syntactically incorrect.
	// Assuming the intent was to add the useState for the alert.
	// If a useEffect for focusing is needed, it should be provided in a complete form.

	const isEditing = editingId === draft.id

	return (
		<div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-card relative">
			{/* Preview Header */}
			<div className="px-4 py-3 shrink-0 flex items-center justify-between gap-3 border-b border-border bg-card">
				{isEditing ? (
					/* Editing Mode */
					<div className="flex items-center gap-2 flex-1">
						<Input
							value={editValue}
							onChange={e => onEditChange(e.target.value)}
							onKeyDown={e => {
								stopPropagation(e)
								if (e.key === 'Enter') onEditSave(draft.id)
								if (e.key === 'Escape') onEditCancel()
							}}
							className="flex-1 h-8 text-sm font-medium"
							autoFocus
							maxLength={72}
							placeholder="Título del borrador..."
						/>
						<Button
							size="icon"
							variant="ghost"
							onClick={() => onEditSave(draft.id)}
							className="h-8 w-8 text-primary hover:bg-primary/10"
						>
							<Check className="w-4 h-4" />
						</Button>
						<Button
							size="icon"
							variant="ghost"
							onClick={onEditCancel}
							className="h-8 w-8 text-muted-foreground hover:text-foreground"
						>
							<X className="w-4 h-4" />
						</Button>
					</div>
				) : (
					/* Viewing Mode */
					<>
						<div className="flex items-center gap-3 w-full overflow-hidden">
							<Button
								variant="ghost"
								size="icon"
								onClick={onBack}
								className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
							>
								<ChevronLeft className="w-4 h-4" />
							</Button>

							<div className="flex-1 min-w-0 grid gap-1">
								{/* Title */}
								<h3 
									className="text-sm font-medium truncate cursor-pointer select-none hover:text-primary transition-colors" 
									onDoubleClick={() => onEditStart(draft)}
									title={draft.title}
								>
									{draft.title || <span className="italic text-muted-foreground">Sin título</span>}
								</h3>

								<div className="flex items-center gap-2 overflow-hidden">
									{/* Category Badge (optional) */}
									{draft.categoryLabel && (
										<span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-background text-foreground border border-border shadow-sm whitespace-nowrap flex items-center gap-1">
											<Tag className="w-3 h-3 text-muted-foreground" />
											{draft.categoryLabel}
										</span>
									)}
									
									<div className="text-xs text-muted-foreground flex items-center gap-2 truncate">
										<Clock className="w-3 h-3 shrink-0" />
										<span className="truncate">
											{new Date(draft.updatedAt).toLocaleString('es-ES', {
												day: 'numeric',
												month: 'short',
												hour: '2-digit',
												minute: '2-digit'
											})}
										</span>
										<span className="text-muted-foreground/50 shrink-0">•</span>
										<span className="shrink-0">{draft.content.length} chars</span>
									</div>
								</div>
							</div>

							{/* Actions */}
							<div className="flex items-center gap-1 shrink-0 ml-2">
								<Button
									size="icon"
									variant="ghost"
									onClick={() => onCopy(draft.content, draft.id)}
									className={cn(
										'h-8 w-8',
										copiedId === draft.id
											? 'text-primary'
											: 'text-muted-foreground hover:text-foreground'
									)}
								>
									{copiedId === draft.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
								</Button>
								<Button
									size="icon"
									variant="ghost"
									onClick={() => onEditStart(draft)}
									className="h-8 w-8 text-muted-foreground hover:text-foreground"
								>
									<Edit2 className="w-4 h-4" />
								</Button>
							</div>
						</div>
					</>
				)}
			</div>

			{/* Draft Content View */}
			<ScrollArea className="flex-1 min-h-0" onWheel={e => e.stopPropagation()}>
				<div className="p-4 max-w-none w-full break-words">
					<MVPreview 
						content={draft.content} 
						className="text-sm leading-relaxed"
					/>
				</div>
			</ScrollArea>

			{/* Bottom Actions */}
			<div className="shrink-0 border-t border-border bg-card">
				<div className="p-3 px-4 flex justify-between items-center gap-4">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => onDelete(draft.id)}
						className="h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
					>
						<Trash2 className="w-4 h-4 mr-1.5" />
						Eliminar
					</Button>
					<Button size="sm" onClick={() => onRestore(draft)} className="h-8 shrink-0">
						<Upload className="w-4 h-4 mr-1.5" />
						Cargar en editor
					</Button>
				</div>
			</div>
		</div>
	)
}
