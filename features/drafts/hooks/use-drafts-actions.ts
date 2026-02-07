/**
 * useDraftsActions - Hook for draft CRUD operations and actions
 * Provides handlers for create, edit, duplicate, delete, move operations
 */
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/lib/lazy-toast'
import { type Draft, deleteDrafts, duplicateDraft, moveDraftToFolder, createFolder } from '@/features/drafts/storage'
import type { FolderWithCount } from '@/features/drafts/components/folder-item'

// ============================================================================
// Types
// ============================================================================

export interface UseDraftsActionsOptions {
	/** Document type for navigation paths */
	filterType: 'draft' | 'template'
	/** All folders (for finding folder names on drag/drop) */
	folders: FolderWithCount[]
}

export interface DraftActionsDialogState<T> {
	open: boolean
	data: T | null
}

export interface DeleteDialogState {
	open: boolean
	drafts: Draft[]
}

export interface MoveDialogState {
	open: boolean
	draft: Draft | null
}

export interface DeleteFolderDialogState {
	open: boolean
	folder: FolderWithCount | null
}

export interface UseDraftsActionsReturn {
	/** Navigate to create new draft/template */
	handleCreateDraft: () => void
	/** Navigate to edit a draft/template */
	handleEditDraft: (id: string) => void
	/** Duplicate a draft */
	handleDuplicateDraft: (draft: Draft) => Promise<void>
	/** Delete drafts from dialog state */
	handleDeleteDrafts: (drafts: Draft[]) => Promise<void>
	/** Move draft to folder */
	handleMoveDraft: (draftId: string, folderId: string | undefined) => Promise<void>
	/** Handle drag and drop to folder */
	handleDragDrop: (draftId: string, folderId: string | undefined) => Promise<void>
	/** Create a new folder */
	handleCreateFolder: (name: string, icon: string, type: 'draft' | 'template') => Promise<void>
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useDraftsActions hook - Encapsulates logic for complex draft/template operations.
 * Handles duplicate, move, and CRUD actions with integrated toast notifications.
 */
export function useDraftsActions({ filterType, folders }: UseDraftsActionsOptions): UseDraftsActionsReturn {
	const navigate = useNavigate()

	// Navigate to create new draft/template
	const handleCreateDraft = useCallback(() => {
		const basePath = filterType === 'template' ? '/templates' : '/drafts'
		navigate(`${basePath}/new`)
	}, [filterType, navigate])

	// Navigate to edit a draft/template
	const handleEditDraft = useCallback(
		(id: string) => {
			const basePath = filterType === 'template' ? '/templates' : '/drafts'
			navigate(`${basePath}/edit/${encodeURIComponent(id)}`)
		},
		[filterType, navigate]
	)

	// Duplicate a draft
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

	// Delete drafts
	const handleDeleteDrafts = useCallback(async (drafts: Draft[]) => {
		if (drafts.length === 0) return

		try {
			await deleteDrafts(drafts.map(d => d.id))
			const count = drafts.length
			toast.success(count === 1 ? 'Borrador eliminado' : `${count} borradores eliminados`)
		} catch {
			toast.error('Error al eliminar')
		}
	}, [])

	// Move draft to folder
	const handleMoveDraft = useCallback(async (draftId: string, folderId: string | undefined) => {
		try {
			await moveDraftToFolder(draftId, folderId)
			toast.success('Borrador movido')
		} catch {
			toast.error('Error al mover')
		}
	}, [])

	// Handle drag and drop to folder
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

	// Create a new folder
	const handleCreateFolder = useCallback(async (name: string, icon: string, type: 'draft' | 'template') => {
		try {
			await createFolder({ name, icon, type })
			toast.success('Carpeta creada', { description: name })
		} catch {
			toast.error('Error al crear carpeta')
		}
	}, [])

	return {
		handleCreateDraft,
		handleEditDraft,
		handleDuplicateDraft,
		handleDeleteDrafts,
		handleMoveDraft,
		handleDragDrop,
		handleCreateFolder,
	}
}
