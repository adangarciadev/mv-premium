import { useEffect, useState, useMemo } from 'react'
import {
	getDrafts,
	deleteDraft,
	updateDraft,
	type Draft,
} from '@/features/drafts/storage'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import X from 'lucide-react/dist/esm/icons/x'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open'
import Inbox from 'lucide-react/dist/esm/icons/inbox'
import Search from 'lucide-react/dist/esm/icons/search'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn, stopKeyboardPropagation as stopPropagation } from '@/lib/utils'
import { DraftListItem } from './draft-list-item'
import { DraftPreview } from './draft-preview'
import { ALL_SUBFORUMS } from '@/lib/subforums'
import { NativeFidIcon } from '@/components/native-fid-icon'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface DraftsListProps {
	isOpen: boolean
	onClose: () => void
	onRestore: (data: { content: string; title?: string; category?: string; id?: string }) => Promise<void>
}

/**
 * Groups drafts by forum slug.
 * @param drafts - Flat array of draft metadata
 * @returns Map of forum slugs to draft arrays
 */
function groupDraftsByForum(drafts: Draft[]): Map<string, Draft[]> {
	const groups = new Map<string, Draft[]>()

	drafts.forEach(draft => {
		const forum = draft.subforum || 'otros'

		if (!groups.has(forum)) {
			groups.set(forum, [])
		}
		groups.get(forum)!.push(draft)
	})

	return groups
}

/**
 * Formats a numeric timestamp into a human-readable relative string (Spanish).
 * @param timestamp - Numeric Date timestamp
 */
function formatRelativeTime(timestamp: number): string {
	const now = Date.now()
	const diff = now - timestamp
	const minutes = Math.floor(diff / 60000)
	const hours = Math.floor(diff / 3600000)
	const days = Math.floor(diff / 86400000)

	if (minutes < 1) return 'ahora'
	if (minutes < 60) return `${minutes}m`
	if (hours < 24) return `${hours}h`
	if (days < 7) return `${days}d`

	return new Date(timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

/**
 * Retrieves subforum display name and icon ID based on a slug.
 * Defaults to title-cased slug if forum isn't in global list.
 */
function getSubforumInfo(slug: string): { name: string; iconId: number | null } {
	const subforum = ALL_SUBFORUMS.find(s => s.slug === slug)
	if (subforum) {
		return { name: subforum.name, iconId: subforum.iconId }
	}
	// Fallback: capitalize slug
	return { name: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), iconId: null }
}

/**
 * DraftsList component - A management dialog for viewing, searching, and restoring
 * drafts from the dashboard.
 */
export function DraftsList({ isOpen, onClose, onRestore }: DraftsListProps) {
	// State for drafts data
	const [drafts, setDrafts] = useState<Draft[]>([])
	// State for search input
	const [searchQuery, setSearchQuery] = useState('')
	// State for the currently selected draft for preview
	const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null)
	// State for currently editing draft ID
	const [editingId, setEditingId] = useState<string | null>(null)
	// State for the temporary title being edited
	const [editValue, setEditValue] = useState('')
	// State for expanded/collapsed forum groups in the list
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
	// State for showing visual feedback on copy
	const [copiedId, setCopiedId] = useState<string | null>(null)
	// State for delete confirmation
	const [deleteConfirmState, setDeleteConfirmState] = useState<{ type: 'single' | 'all'; id?: string } | null>(null)


	// Load drafts when the dialog opens
	useEffect(() => {
		if (isOpen) {
			let cancelled = false
			const loadDrafts = async () => {
				const allDrafts = await getDrafts()
				if (cancelled) return

				// Filter to only show drafts (not templates)
				const onlyDrafts = allDrafts.filter(d => d.type === 'draft')
				setDrafts(onlyDrafts)
				setEditingId(null)
				setSearchQuery('')
				setSelectedDraft(null)

				// Groups collapsed by default (cleanup visual noise)
				setExpandedGroups(new Set())
			}

			void loadDrafts()
			return () => {
				cancelled = true
			}
		}
	}, [isOpen])

	// Handle global keyboard shortcuts within the dialog
	useEffect(() => {
		if (!isOpen) return

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				if (editingId) {
					setEditingId(null) // Cancel editing
				} else if (selectedDraft) {
					setSelectedDraft(null) // Deselect draft
				} else {
					onClose() // Close dialog
				}
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [isOpen, selectedDraft, editingId, onClose])

	// Filter drafts based on search query
	const filteredDrafts = useMemo(() => {
		if (!searchQuery.trim()) return drafts
		const query = searchQuery.toLowerCase()
		return drafts.filter(
			draft =>
				draft.content.toLowerCase().includes(query) ||
				(draft.subforum && draft.subforum.toLowerCase().includes(query)) ||
				(draft.title && draft.title.toLowerCase().includes(query))
		)
	}, [drafts, searchQuery])

	// Group filtered drafts by forum
	const groupedDrafts = useMemo(() => groupDraftsByForum(filteredDrafts), [filteredDrafts])

	// --- Event Handlers ---

	// Centralized delete request handler
	const handleDeleteRequest = (id: string, e?: React.MouseEvent) => {
		e?.stopPropagation()
		setDeleteConfirmState({ type: 'single', id })
	}

	const handleClearAllRequest = () => {
		setDeleteConfirmState({ type: 'all' })
	}

	// Actual delete execution
	const proceedWithDelete = async () => {
		if (!deleteConfirmState) return

		if (deleteConfirmState.type === 'all') {
			for (const draft of drafts) {
				await deleteDraft(draft.id)
			}
			setDrafts([])
			setSelectedDraft(null)
		} else if (deleteConfirmState.type === 'single' && deleteConfirmState.id) {
			await deleteDraft(deleteConfirmState.id)
			const updated = await getDrafts()
			const onlyDrafts = updated.filter(d => d.type === 'draft')
			setDrafts(onlyDrafts)
			if (selectedDraft?.id === deleteConfirmState.id) setSelectedDraft(null)
		}
		
		setDeleteConfirmState(null)
	}

	const handleRestore = async (data: { content: string; title?: string; category?: string; id?: string }) => {
		await onRestore(data)
		onClose()
	}

	const handleCopy = async (content: string, id: string) => {
		await navigator.clipboard.writeText(content)
		setCopiedId(id)
		setTimeout(() => setCopiedId(null), 2000)
	}

	const toggleGroup = (forum: string) => {
		const newExpanded = new Set(expandedGroups)
		if (newExpanded.has(forum)) {
			newExpanded.delete(forum)
		} else {
			newExpanded.add(forum)
		}
		setExpandedGroups(newExpanded)
	}

	const saveTitle = async (id: string) => {
		await updateDraft(id, { title: editValue })
		const updated = await getDrafts()
		const onlyDrafts = updated.filter(d => d.type === 'draft')
		setDrafts(onlyDrafts)

		// Sync the selected draft with updated data
		if (selectedDraft?.id === id) {
			const updatedDraft = onlyDrafts.find(d => d.id === id)
			if (updatedDraft) setSelectedDraft(updatedDraft)
		}
		setEditingId(null)
	}

	const startEditing = (draft: Draft) => {
		setEditingId(draft.id)
		// Use existing title or fallback to subforum
		setEditValue(draft.title || draft.subforum || 'Borrador')
	}

	return (
		<>
		<Dialog 
			open={isOpen} 
			onOpenChange={open => {
				// Prevent closing main dialog if alert is open
				if (!open && deleteConfirmState) return
				if (!open) onClose()
			}}
		>
			<DialogContent
				showCloseButton={false}
				className="w-full max-w-3xl h-[600px] p-0 gap-0 overflow-hidden flex flex-col bg-card border-border shadow-2xl"
			>
				{/* Header Section */}
				<DialogHeader className="px-4 py-3 shrink-0 flex flex-row items-center justify-between space-y-0 border-b border-border">
					<DialogTitle className="flex items-center gap-2.5 text-foreground text-base font-semibold">
						<FolderOpen className="w-4 h-4 text-muted-foreground" />
						<span>Borradores</span>
						{drafts.length > 0 && (
							<Badge
								variant="secondary"
								className="px-2 py-0 text-xs font-medium h-5 bg-muted text-muted-foreground"
							>
								{drafts.length}
							</Badge>
						)}
					</DialogTitle>
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 text-muted-foreground hover:text-foreground"
						onClick={onClose}
						title="Cerrar (Esc)"
					>
						<X className="w-4 h-4" />
					</Button>
				</DialogHeader>

				{/* Search Bar - always show if there are drafts */}
				{drafts.length > 0 && (
					<div className="px-4 py-2 border-b border-border">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
							<Input
								type="text"
								placeholder="Buscar..."
								value={searchQuery}
								onChange={e => setSearchQuery(e.target.value)}
								onKeyDown={stopPropagation}
								className="pl-9 h-9 text-sm bg-muted/50 border-transparent focus:bg-background focus:border-border"
							/>
							{searchQuery && (
								<Button
									variant="ghost"
									size="icon"
									className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
									onClick={() => setSearchQuery('')}
								>
									<X className="w-3.5 h-3.5" />
								</Button>
							)}
						</div>
					</div>
				)}

				{/* Main Content Area: Master-Detail View */}
				<div className="flex flex-1 overflow-hidden min-h-0 relative">
					{/* Left Panel: Drafts List */}
					<div
						className={cn(
							'absolute inset-0 w-full h-full transition-transform duration-300 ease-in-out z-10 bg-card flex flex-col',
							selectedDraft ? '-translate-x-full' : 'translate-x-0'
						)}
					>
						<ScrollArea className="h-full w-full" onWheel={e => e.stopPropagation()}>
						{/* Empty State */}
						{drafts.length === 0 ? (
							<div className="flex flex-col items-center justify-center h-[400px] p-8 text-center">
								<div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
									<Inbox className="w-8 h-8 text-muted-foreground" />
								</div>
								<h3 className="text-base font-medium text-foreground mb-2">Sin borradores</h3>
								<p className="text-sm text-muted-foreground max-w-[240px]">
									Los borradores que guardes aparecerán aquí.
								</p>
							</div>
						) : filteredDrafts.length === 0 ? (
							/* No Search Results State */
							<div className="flex flex-col items-center justify-center h-60 p-8 text-center text-muted-foreground">
								<Search className="w-8 h-8 mb-3 opacity-30" />
								<p className="text-sm">
									Sin resultados para <span className="font-medium text-foreground">"{searchQuery}"</span>
								</p>
							</div>
						) : (
							/* List of Draft Groups */
							<div className="p-2 space-y-2">
								{Array.from(groupedDrafts.entries()).map(([forum, forumDrafts]) => (
									<div key={forum} className="bg-card border border-border/40 rounded-lg overflow-hidden shadow-sm">
										{/* Forum Group Header */}
										<button
											type="button"
											onClick={() => toggleGroup(forum)}
											className="w-full flex items-center gap-2 h-8 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
										>
											{expandedGroups.has(forum) ? (
												<ChevronDown className="w-3.5 h-3.5" />
											) : (
												<ChevronRight className="w-3.5 h-3.5" />
											)}
											{(() => {
												const info = getSubforumInfo(forum)
												return (
													<>
														{info.iconId && <NativeFidIcon iconId={info.iconId} className="w-4 h-4" />}
														<span className="truncate">{info.name}</span>
													</>
												)
											})()}
											<Badge variant="secondary" className="ml-auto px-1.5 py-0 text-[10px] h-5 min-w-5 justify-center bg-muted text-muted-foreground font-medium">
												{forumDrafts.length}
											</Badge>
										</button>

										{/* Forum Group Items */}
										{expandedGroups.has(forum) && (
											<div className="px-1 pb-1 space-y-0.5">
												{forumDrafts.map(draft => (
													<DraftListItem
														key={draft.id}
														draft={draft}
														isSelected={selectedDraft?.id === draft.id}
														onSelect={setSelectedDraft}
														onDelete={d => handleDeleteRequest(d.id)}
														formatRelativeTime={formatRelativeTime}
													/>
												))}
											</div>
										)}
									</div>
								))}
							</div>
						)}
					</ScrollArea>
					</div>

					{/* Right Panel: Draft Preview */}
					<div 
						className={cn(
							"absolute inset-0 w-full h-full transition-transform duration-300 ease-in-out z-20 bg-card flex flex-col",
							selectedDraft ? 'translate-x-0' : 'translate-x-full'
						)}
					>
						{selectedDraft && (
							<DraftPreview
								draft={selectedDraft}
								editingId={editingId}
								editValue={editValue}
								copiedId={copiedId}
								onBack={() => setSelectedDraft(null)}
								onEditStart={startEditing}
								onEditCancel={() => setEditingId(null)}
								onEditSave={saveTitle}
								onEditChange={setEditValue}
								onDelete={id => handleDeleteRequest(id)}
								onRestore={draft =>
									handleRestore({
										content: draft.content,
										title: draft.title,
										category: draft.category,
										id: draft.id,
									})
								}
								onCopy={handleCopy}
							/>
						)}
					</div>
				</div>

				{/* Footer */}
				<DialogFooter className="px-4 py-3 border-t border-border justify-between items-center sm:justify-between bg-muted/30">
					<span className="text-xs text-muted-foreground">
						Datos privados en tu dispositivo
					</span>
					{drafts.length > 0 && (
						<Button
							variant="ghost"
							size="sm"
							onClick={handleClearAllRequest}
							className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
						>
							<Trash2 className="w-3 h-3 mr-1" />
							Eliminar todo
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>

		<AlertDialog open={!!deleteConfirmState} onOpenChange={(open) => !open && setDeleteConfirmState(null)}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{deleteConfirmState?.type === 'all' ? '¿Eliminar todo?' : '¿Eliminar borrador?'}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{deleteConfirmState?.type === 'all'
							? `Esta acción no se puede deshacer. Se eliminarán permanentemente los ${drafts.length} borradores.`
							: 'Esta acción no se puede deshacer. El borrador se perderá permanentemente.'}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancelar</AlertDialogCancel>
					<AlertDialogAction onClick={proceedWithDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
						{deleteConfirmState?.type === 'all' ? 'Eliminar todo' : 'Eliminar'}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
		</>
	)
}
