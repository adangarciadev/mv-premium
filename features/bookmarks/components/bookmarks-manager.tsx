/**
 * Bookmarks Manager Component
 * Unified component that handles both card and table views with Shadcn UI
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { logger } from '@/lib/logger'
import { toast } from '@/lib/lazy-toast'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid'
import List from 'lucide-react/dist/esm/icons/list'
import Search from 'lucide-react/dist/esm/icons/search'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShadowWrapper } from '@/components/shadow-wrapper'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { batchDeleteBookmarks, idsToBookmarkItems } from '../logic/delete-bookmarks'
import type { BookmarkData } from '../logic/bookmarks-page'
import { getUserProfileUrl } from '@/constants'

type ViewMode = 'cards' | 'table'

interface BookmarksManagerProps {
	initialBookmarks: BookmarkData[]
	initialViewMode: ViewMode
	onViewModeChange: (mode: ViewMode) => void
	nativeCardsContainer: HTMLElement
}

export function BookmarksManager({
	initialBookmarks,
	initialViewMode,
	onViewModeChange,
	nativeCardsContainer,
}: BookmarksManagerProps) {
	const [bookmarks, setBookmarks] = useState(initialBookmarks)
	const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode)
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const [isDeleting, setIsDeleting] = useState(false)
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)

	// Track last checked index for shift+click range selection
	const lastCheckedIndexRef = useRef<number>(-1)

	// Hide native cards on mount if initial mode is table
	useEffect(() => {
		if (initialViewMode === 'table') {
			const nativeCards = nativeCardsContainer.querySelectorAll<HTMLElement>('.block.cf.post')
			nativeCards.forEach(card => {
				card.style.display = 'none'
			})
		}
	}, [initialViewMode, nativeCardsContainer])

	// Filter bookmarks by search query
	const filteredBookmarks = useMemo(() => {
		if (!searchQuery.trim()) return bookmarks
		const query = searchQuery.toLowerCase()
		return bookmarks.filter(
			b =>
				b.title.toLowerCase().includes(query) ||
				b.author.toLowerCase().includes(query) ||
				b.preview.toLowerCase().includes(query)
		)
	}, [bookmarks, searchQuery])

	// Handle view mode change
	const handleViewModeChange = useCallback(
		(mode: ViewMode) => {
			setViewMode(mode)
			onViewModeChange(mode)

			// Toggle native cards visibility
			const nativeCards = nativeCardsContainer.querySelectorAll<HTMLElement>('.block.cf.post')
			nativeCards.forEach(card => {
				card.style.display = mode === 'cards' ? '' : 'none'
			})
		},
		[onViewModeChange, nativeCardsContainer]
	)

	// Handle selection toggle with shift+click support
	const handleToggleSelect = useCallback(
		(compositeId: string, index: number, event: React.MouseEvent | React.KeyboardEvent) => {
			const isChecked = !selectedIds.has(compositeId)

			// Handle Shift+Click range selection
			if (
				'shiftKey' in event &&
				event.shiftKey &&
				lastCheckedIndexRef.current !== -1 &&
				lastCheckedIndexRef.current !== index
			) {
				const start = Math.min(lastCheckedIndexRef.current, index)
				const end = Math.max(lastCheckedIndexRef.current, index)

				setSelectedIds(prev => {
					const next = new Set(prev)
					for (let i = start; i <= end; i++) {
						const id = filteredBookmarks[i]?.compositeId
						if (id) {
							if (isChecked) {
								next.add(id)
							} else {
								next.delete(id)
							}
						}
					}
					return next
				})
			} else {
				// Normal click - toggle single item
				setSelectedIds(prev => {
					const next = new Set(prev)
					if (next.has(compositeId)) {
						next.delete(compositeId)
					} else {
						next.add(compositeId)
					}
					return next
				})
			}

			// Update last checked index
			lastCheckedIndexRef.current = index
		},
		[selectedIds, filteredBookmarks]
	)

	// Handle select all
	const handleSelectAll = useCallback(
		(checked: boolean) => {
			if (checked) {
				setSelectedIds(new Set(filteredBookmarks.map(b => b.compositeId)))
			} else {
				setSelectedIds(new Set())
			}
			// Reset shift+click anchor
			lastCheckedIndexRef.current = -1
		},
		[filteredBookmarks]
	)

	// Handle delete
	const handleDelete = useCallback(async () => {
		if (selectedIds.size === 0) return

		setIsDeleting(true)
		setShowDeleteDialog(false)

		try {
			const idsToDelete = Array.from(selectedIds)
			const bookmarkItems = idsToBookmarkItems(idsToDelete)
			const results = await batchDeleteBookmarks(bookmarkItems)

			// Remove deleted bookmarks from state
			setBookmarks(prev => prev.filter(b => !results.success.includes(b.compositeId)))

			// Remove from DOM (native cards)
			results.success.forEach(compositeId => {
				const [tid, pid] = compositeId.split('-')
				const card = nativeCardsContainer.querySelector(`#post-${pid}`)
				if (card) card.remove()
			})

			// Clear selection
			setSelectedIds(new Set())

			if (results.success.length > 0) {
				toast.success(
					`${results.success.length} marcador${results.success.length > 1 ? 'es' : ''} eliminado${
						results.success.length > 1 ? 's' : ''
					}`
				)
			}
			if (results.failed.length > 0) {
				toast.error(`Error al eliminar ${results.failed.length} marcador${results.failed.length > 1 ? 'es' : ''}`)
			}
		} catch (error) {
			logger.error('Bookmarks delete error:', error)
			toast.error('Error al eliminar marcadores')
		} finally {
			setIsDeleting(false)
		}
	}, [selectedIds, nativeCardsContainer])

	const handleDeleteClick = () => {
		if (selectedIds.size >= 2) {
			setShowDeleteDialog(true)
		} else {
			handleDelete()
		}
	}

	const allSelected = filteredBookmarks.length > 0 && selectedIds.size === filteredBookmarks.length
	const someSelected = selectedIds.size > 0 && selectedIds.size < filteredBookmarks.length

	return (
		<ShadowWrapper className="mb-4 w-full">
			<div className="space-y-4">
				{/* Action Bar - Sticky */}
				<div className="sticky top-[52px] z-50 flex items-center justify-between gap-4 flex-wrap p-4 bg-sidebar border border-border rounded-lg shadow-xl outline outline-1 outline-black/50">
					<div className="flex items-center gap-3">
						<div className="relative">
							<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
							<Input
								type="text"
								placeholder="Buscar marcadores..."
								value={searchQuery}
								onChange={e => setSearchQuery(e.target.value)}
								className="pl-8 w-64 h-8"
							/>
						</div>
						<span className="text-sm text-muted-foreground">
							{bookmarks.length} marcador{bookmarks.length !== 1 ? 'es' : ''}
						</span>
					</div>

					<div className="flex items-center gap-2">
						{/* View Mode Toggle */}
						<div className="flex items-center border border-border rounded-md overflow-hidden">
							<Button
								variant={viewMode === 'cards' ? 'default' : 'ghost'}
								size="sm"
								onClick={() => handleViewModeChange('cards')}
								className="rounded-none"
							>
								<LayoutGrid className="w-4 h-4" />
							</Button>
							<Button
								variant={viewMode === 'table' ? 'default' : 'ghost'}
								size="sm"
								onClick={() => handleViewModeChange('table')}
								className="rounded-none"
							>
								<List className="w-4 h-4" />
							</Button>
						</div>

						{/* Delete Button */}
						<Button
							variant={selectedIds.size > 0 ? 'destructive' : 'outline'}
							size="sm"
							onClick={handleDeleteClick}
							disabled={selectedIds.size === 0 || isDeleting}
							className="focus-visible:ring-0 focus-visible:ring-offset-0 hover:opacity-80 transition-opacity"
						>
							{isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
							Eliminar ({selectedIds.size})
						</Button>
					</div>
				</div>

				{/* Table View */}
				{viewMode === 'table' && (
					<div className="rounded-lg border border-border overflow-hidden">
						<Table className="w-full table-auto">
							<TableHeader>
								<TableRow className="border-border bg-[#272d30]">
									<TableHead className="w-[5%]">
										<Checkbox
											checked={allSelected ? true : someSelected ? 'indeterminate' : false}
											onCheckedChange={handleSelectAll}
										/>
									</TableHead>
									<TableHead className="w-[30%]">
										<span className="text-sm text-muted-foreground font-normal">Tema</span>
									</TableHead>
									<TableHead className="w-[45%]">
										<span className="text-sm text-muted-foreground font-normal">Post</span>
									</TableHead>
									<TableHead className="w-[12%]">
										<span className="text-sm text-muted-foreground font-normal">Usuario</span>
									</TableHead>
									<TableHead className="w-[8%] text-center">
										<span className="text-sm text-muted-foreground font-normal">Fecha</span>
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredBookmarks.length === 0 ? (
									<TableRow>
										<TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
											No se encontraron marcadores.
										</TableCell>
									</TableRow>
								) : (
									filteredBookmarks.map((bookmark, index) => (
										<TableRow
											key={bookmark.compositeId}
											data-state={selectedIds.has(bookmark.compositeId) ? 'selected' : undefined}
											className={cn(
												'bg-[#39464c] border-t border-[#30353a] hover:bg-muted/30',
												selectedIds.has(bookmark.compositeId) && 'bg-muted/50'
											)}
										>
											<TableCell>
												<Checkbox
													checked={selectedIds.has(bookmark.compositeId)}
													onClick={e => handleToggleSelect(bookmark.compositeId, index, e)}
												/>
											</TableCell>
											<TableCell>
												<a href={bookmark.url} className="text-[#ff5912] truncate block">
													{bookmark.title}
												</a>
											</TableCell>
											<TableCell>
												<p className="text-sm text-muted-foreground line-clamp-2">{bookmark.preview}</p>
											</TableCell>
											<TableCell>
												<a
													href={getUserProfileUrl(bookmark.author)}
													className="text-sm text-[#b3c3d3] font-medium hover:opacity-80 transition-opacity"
												>
													{bookmark.author}
												</a>
											</TableCell>
											<TableCell className="text-center">
												<span className="text-xs text-muted-foreground" title={bookmark.timeTitle}>
													{bookmark.timeText}
												</span>
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>
				)}
			</div>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>¿Eliminar {selectedIds.size} marcadores?</AlertDialogTitle>
						<AlertDialogDescription>
							Esta acción no se puede deshacer. Los marcadores seleccionados serán eliminados permanentemente.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
							Eliminar
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</ShadowWrapper>
	)
}
