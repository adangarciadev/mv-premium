/**
 * useDraftsView Hook
 * Manages state and handlers for the drafts view
 */

import { useState, useMemo, useEffect, useCallback } from 'react'
import { logger } from '@/lib/logger'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
	type Draft,
	getDrafts,
	getFoldersWithCounts,
	deleteDraft,
	duplicateDraft,
	moveDraftToFolder,
	createFolder,
	deleteFolder,
	convertDraftType,
	onDraftsChanged,
} from '@/features/drafts/storage'
import type { FolderWithCount } from '@/features/drafts/components/folder-item'
import type { SortOrder } from '@/features/drafts/components/drafts-toolbar'

interface UseDraftsViewOptions {
	filterType?: 'draft' | 'template'
}

interface DialogState {
	delete: { open: boolean; drafts: Draft[] }
	move: { open: boolean; draft: Draft | null }
	deleteFolder: { open: boolean; folder: FolderWithCount | null }
	createFolder: boolean
}

interface UseDraftsViewReturn {
	// Data
	drafts: Draft[]
	folders: FolderWithCount[]
	filteredDrafts: Draft[]
	typeFilteredDrafts: Draft[]
	foldersWithTypeCounts: FolderWithCount[]
	isLoading: boolean

	// Filters
	searchQuery: string
	setSearchQuery: (query: string) => void
	selectedFolder: string | null
	setSelectedFolder: (id: string | null) => void
	subforumFilter: string
	setSubforumFilter: (subforum: string) => void
	sortOrder: SortOrder
	setSortOrder: (order: SortOrder) => void
	hasActiveFilters: boolean
	clearFilters: () => void

	// Selection
	selectedIds: Set<string>
	setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>
	lastClickedId: string | null
	setLastClickedId: (id: string | null) => void
	clearSelection: () => void
	selectAll: () => void

	// Dialogs
	dialogs: DialogState
	openDeleteDialog: (drafts: Draft[]) => void
	closeDeleteDialog: () => void
	openMoveDialog: (draft: Draft) => void
	closeMoveDialog: () => void
	openDeleteFolderDialog: (folder: FolderWithCount) => void
	closeDeleteFolderDialog: () => void
	openCreateFolderDialog: () => void
	closeCreateFolderDialog: () => void

	// Handlers
	handleCreateDraft: () => void
	handleEditDraft: (id: string) => void
	handleDuplicateDraft: (draft: Draft) => Promise<void>
	handleDeleteDraft: () => Promise<void>
	handleDeleteSelected: () => Promise<void>
	handleMoveSelected: (folderId: string | undefined) => Promise<void>
	handleMoveDraft: (folderId: string | undefined) => Promise<void>
	handleConvertDraft: (draft: Draft) => Promise<void>
	handleCreateFolder: (name: string, icon: string, type: 'draft' | 'template') => Promise<void>
	handleDragDrop: (draftId: string, folderId: string | undefined) => Promise<void>
	handleDeleteFolderConfirm: () => Promise<void>
}

export function useDraftsView({ filterType }: UseDraftsViewOptions): UseDraftsViewReturn {
	const navigate = useNavigate()

	// Data state
	const [drafts, setDrafts] = useState<Draft[]>([])
	const [folders, setFolders] = useState<FolderWithCount[]>([])
	const [isLoading, setIsLoading] = useState(true)

	// Filter state
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
	const [subforumFilter, setSubforumFilter] = useState<string>('all')
	const [sortOrder, setSortOrder] = useState<SortOrder>('newest')

	// Selection state
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const [lastClickedId, setLastClickedId] = useState<string | null>(null)

	// Dialog state
	const [dialogs, setDialogs] = useState<DialogState>({
		delete: { open: false, drafts: [] },
		move: { open: false, draft: null },
		deleteFolder: { open: false, folder: null },
		createFolder: false,
	})

	// Load data
	const loadData = useCallback(async () => {
		try {
			const [draftsData, foldersData] = await Promise.all([getDrafts(), getFoldersWithCounts(filterType)])
			setDrafts(draftsData)
			setFolders(foldersData)
		} catch (error) {
			logger.error('Error loading drafts data:', error)
			toast.error('Error al cargar borradores')
		} finally {
			setIsLoading(false)
		}
	}, [filterType])

	useEffect(() => {
		void loadData()

		const unsubscribeDrafts = onDraftsChanged(() => {
			void loadData()
		})

		return () => {
			unsubscribeDrafts()
		}
	}, [loadData])

	// Filter and sort drafts
	const filteredDrafts = useMemo(() => {
		let result = [...drafts]

		if (filterType) {
			result = result.filter(d => d.type === filterType)
		}

		if (selectedFolder) {
			result = result.filter(d => d.folderId === selectedFolder)
		}

		if (subforumFilter !== 'all') {
			result = result.filter(d => d.subforum === subforumFilter)
		}

		if (searchQuery) {
			const query = searchQuery.toLowerCase()
			result = result.filter(d => d.title.toLowerCase().includes(query) || d.content.toLowerCase().includes(query))
		}

		switch (sortOrder) {
			case 'newest':
				result.sort((a, b) => b.createdAt - a.createdAt)
				break
			case 'oldest':
				result.sort((a, b) => a.createdAt - b.createdAt)
				break
			case 'alpha':
				result.sort((a, b) => a.title.localeCompare(b.title))
				break
			case 'updated':
				result.sort((a, b) => b.updatedAt - a.updatedAt)
				break
		}

		return result
	}, [drafts, searchQuery, selectedFolder, subforumFilter, sortOrder, filterType])

	// Items filtered by type only (for sidebar count)
	const typeFilteredDrafts = useMemo(() => {
		if (!filterType) return drafts
		return drafts.filter(d => d.type === filterType)
	}, [drafts, filterType])

	// Recalculate folder counts based on filtered type
	const foldersWithTypeCounts = useMemo(() => {
		return folders.map(folder => ({
			...folder,
			count: typeFilteredDrafts.filter(d => d.folderId === folder.id).length,
		}))
	}, [folders, typeFilteredDrafts])

	const hasActiveFilters = searchQuery !== '' || selectedFolder !== null || subforumFilter !== 'all'

	const clearFilters = useCallback(() => {
		setSearchQuery('')
		setSelectedFolder(null)
		setSubforumFilter('all')
	}, [])

	// Selection helpers
	const clearSelection = useCallback(() => {
		setSelectedIds(new Set())
		setLastClickedId(null)
	}, [])

	const selectAll = useCallback(() => {
		setSelectedIds(new Set(filteredDrafts.map(d => d.id)))
	}, [filteredDrafts])

	// Clear selection when filters change
	useEffect(() => {
		clearSelection()
	}, [searchQuery, selectedFolder, subforumFilter, filterType, clearSelection])

	// Dialog helpers
	const openDeleteDialog = useCallback((drafts: Draft[]) => {
		setDialogs(prev => ({ ...prev, delete: { open: true, drafts } }))
	}, [])

	const closeDeleteDialog = useCallback(() => {
		setDialogs(prev => ({ ...prev, delete: { open: false, drafts: [] } }))
	}, [])

	const openMoveDialog = useCallback((draft: Draft) => {
		setDialogs(prev => ({ ...prev, move: { open: true, draft } }))
	}, [])

	const closeMoveDialog = useCallback(() => {
		setDialogs(prev => ({ ...prev, move: { open: false, draft: null } }))
	}, [])

	const openDeleteFolderDialog = useCallback((folder: FolderWithCount) => {
		setDialogs(prev => ({ ...prev, deleteFolder: { open: true, folder } }))
	}, [])

	const closeDeleteFolderDialog = useCallback(() => {
		setDialogs(prev => ({ ...prev, deleteFolder: { open: false, folder: null } }))
	}, [])

	const openCreateFolderDialog = useCallback(() => {
		setDialogs(prev => ({ ...prev, createFolder: true }))
	}, [])

	const closeCreateFolderDialog = useCallback(() => {
		setDialogs(prev => ({ ...prev, createFolder: false }))
	}, [])

	// Handlers
	const handleCreateDraft = useCallback(() => {
		const basePath = filterType === 'template' ? '/templates' : '/drafts'
		navigate(`${basePath}/new`)
	}, [filterType, navigate])

	const handleEditDraft = useCallback(
		(id: string) => {
			const basePath = filterType === 'template' ? '/templates' : '/drafts'
			navigate(`${basePath}/edit/${encodeURIComponent(id)}`)
		},
		[filterType, navigate]
	)

	const handleDuplicateDraft = useCallback(async (draft: Draft) => {
		try {
			const newDraft = await duplicateDraft(draft.id)
			if (newDraft) {
				toast.success('Borrador duplicado', { description: newDraft.title })
			}
		} catch {
			toast.error('Error al duplicar')
		}
	}, [])

	const handleDeleteDraft = useCallback(async () => {
		if (dialogs.delete.drafts.length === 0) return

		try {
			await Promise.all(dialogs.delete.drafts.map(d => deleteDraft(d.id)))
			const count = dialogs.delete.drafts.length
			toast.success(count === 1 ? 'Borrador eliminado' : `${count} borradores eliminados`)
			closeDeleteDialog()
			clearSelection()
		} catch {
			toast.error('Error al eliminar')
		}
	}, [dialogs.delete.drafts, closeDeleteDialog, clearSelection])

	const handleDeleteSelected = useCallback(async () => {
		if (selectedIds.size === 0) return

		const selectedDrafts = drafts.filter(d => selectedIds.has(d.id))
		openDeleteDialog(selectedDrafts)
	}, [selectedIds, drafts, openDeleteDialog])

	const handleMoveSelected = useCallback(
		async (folderId: string | undefined) => {
			if (selectedIds.size === 0) return

			try {
				await Promise.all(Array.from(selectedIds).map(id => moveDraftToFolder(id, folderId)))
				const folderName = folderId ? folders.find(f => f.id === folderId)?.name || 'carpeta' : 'Sin carpeta'
				toast.success(`${selectedIds.size} elementos movidos a ${folderName}`)
				clearSelection()
			} catch {
				toast.error('Error al mover')
			}
		},
		[selectedIds, folders, clearSelection]
	)

	const handleMoveDraft = useCallback(
		async (folderId: string | undefined) => {
			if (!dialogs.move.draft) return

			try {
				await moveDraftToFolder(dialogs.move.draft.id, folderId)
				toast.success('Borrador movido')
				closeMoveDialog()
			} catch {
				toast.error('Error al mover')
			}
		},
		[dialogs.move.draft, closeMoveDialog]
	)

	const handleConvertDraft = useCallback(
		async (draft: Draft) => {
			try {
				const converted = await convertDraftType(draft.id)
				if (converted) {
					const newType = converted.type === 'template' ? 'plantilla' : 'borrador'
					toast.success(`Convertido a ${newType}`, { description: converted.title })

					const basePath = converted.type === 'template' ? '/templates' : '/drafts'
					navigate(`${basePath}/edit/${encodeURIComponent(converted.id)}`)
				}
			} catch {
				toast.error('Error al convertir')
			}
		},
		[navigate]
	)

	const handleCreateFolder = useCallback(async (name: string, icon: string, type: 'draft' | 'template') => {
		try {
			await createFolder({ name, icon, type })
			toast.success('Carpeta creada', { description: name })
		} catch {
			toast.error('Error al crear carpeta')
		}
	}, [])

	const handleDragDrop = useCallback(
		async (draftId: string, folderId: string | undefined) => {
			try {
				await moveDraftToFolder(draftId, folderId)
				const folderName = folderId ? folders.find(f => f.id === folderId)?.name || 'carpeta' : 'Sin carpeta'
				toast.success(`Movido a ${folderName}`)
			} catch {
				toast.error('Error al mover')
			}
		},
		[folders]
	)

	const handleDeleteFolderConfirm = useCallback(async () => {
		if (!dialogs.deleteFolder.folder) return

		try {
			await deleteFolder(dialogs.deleteFolder.folder.id)
			if (selectedFolder === dialogs.deleteFolder.folder.id) {
				setSelectedFolder(null)
			}
			toast.success('Carpeta eliminada', { description: dialogs.deleteFolder.folder.name })
			closeDeleteFolderDialog()
		} catch {
			toast.error('Error al eliminar carpeta')
		}
	}, [dialogs.deleteFolder.folder, selectedFolder, closeDeleteFolderDialog])

	return {
		// Data
		drafts,
		folders,
		filteredDrafts,
		typeFilteredDrafts,
		foldersWithTypeCounts,
		isLoading,
		// Filters
		searchQuery,
		setSearchQuery,
		selectedFolder,
		setSelectedFolder,
		subforumFilter,
		setSubforumFilter,
		sortOrder,
		setSortOrder,
		hasActiveFilters,
		clearFilters,
		// Selection
		selectedIds,
		setSelectedIds,
		lastClickedId,
		setLastClickedId,
		clearSelection,
		selectAll,
		// Dialogs
		dialogs,
		openDeleteDialog,
		closeDeleteDialog,
		openMoveDialog,
		closeMoveDialog,
		openDeleteFolderDialog,
		closeDeleteFolderDialog,
		openCreateFolderDialog,
		closeCreateFolderDialog,

		// Handlers
		handleCreateDraft,
		handleEditDraft,
		handleDuplicateDraft,
		handleDeleteDraft,
		handleDeleteSelected,
		handleMoveSelected,
		handleMoveDraft,
		handleConvertDraft,
		handleCreateFolder,
		handleDragDrop,
		handleDeleteFolderConfirm,
	}
}
