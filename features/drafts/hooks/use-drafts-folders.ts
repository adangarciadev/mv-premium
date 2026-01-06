/**
 * useDraftsFolders - Hook for folder-related logic and computed values
 */
import { useMemo } from 'react'
import type { Draft } from '@/features/drafts/storage'
import type { FolderWithCount } from '@/features/drafts/components/folder-item'

// ============================================================================
// Types
// ============================================================================

export interface UseDraftsFoldersOptions {
	/** All folders */
	folders: FolderWithCount[]
	/** Drafts filtered by type (for counting) */
	typeFilteredDrafts: Draft[]
}

export interface UseDraftsFoldersReturn {
	/** Folders with recalculated counts based on type-filtered drafts */
	foldersWithTypeCounts: FolderWithCount[]
}

// ============================================================================
// Hook
// ============================================================================

export function useDraftsFolders({ folders, typeFilteredDrafts }: UseDraftsFoldersOptions): UseDraftsFoldersReturn {
	// Recalculate folder counts based on filtered type
	const foldersWithTypeCounts = useMemo(() => {
		return folders.map(folder => ({
			...folder,
			count: typeFilteredDrafts.filter(d => d.folderId === folder.id).length,
		}))
	}, [folders, typeFilteredDrafts])

	return {
		foldersWithTypeCounts,
	}
}
