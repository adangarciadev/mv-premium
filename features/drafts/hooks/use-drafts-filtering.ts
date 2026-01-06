/**
 * useDraftsFiltering - Hook for filtering and sorting drafts
 * Extracts filtering logic from DraftsView for reusability
 */
import { useState, useMemo, useCallback } from 'react'
import type { Draft } from '@/features/drafts/storage'
import type { SortOrder } from '@/features/drafts/components/drafts-toolbar'

// ============================================================================
// Types
// ============================================================================

export interface UseDraftsFilteringOptions {
	/** All drafts to filter */
	drafts: Draft[]
	/** Filter by document type (draft/template) */
	filterType?: 'draft' | 'template'
}

export interface UseDraftsFilteringReturn {
	// State
	searchQuery: string
	selectedFolder: string | null
	subforumFilter: string
	sortOrder: SortOrder

	// Setters
	setSearchQuery: (query: string) => void
	setSelectedFolder: (folderId: string | null) => void
	setSubforumFilter: (subforum: string) => void
	setSortOrder: (order: SortOrder) => void

	// Computed
	filteredDrafts: Draft[]
	typeFilteredDrafts: Draft[]
	hasActiveFilters: boolean

	// Actions
	clearFilters: () => void
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useDraftsFiltering hook - Manages state and logic for sorting and searching drafts.
 * Used primarily in the Dashboard's drafts and templates views.
 */
export function useDraftsFiltering({ drafts, filterType }: UseDraftsFilteringOptions): UseDraftsFilteringReturn {
	// Filter state
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
	const [subforumFilter, setSubforumFilter] = useState('all')
	const [sortOrder, setSortOrder] = useState<SortOrder>('newest')

	// Items filtered by type only (for sidebar count)
	const typeFilteredDrafts = useMemo(() => {
		if (!filterType) return drafts
		return drafts.filter(d => d.type === filterType)
	}, [drafts, filterType])

	// Filter and sort drafts
	const filteredDrafts = useMemo(() => {
		let result = [...drafts]

		// Filter by document type (draft vs template)
		if (filterType) {
			result = result.filter(d => d.type === filterType)
		}

		// Filter by folder
		if (selectedFolder) {
			result = result.filter(d => d.folderId === selectedFolder)
		}

		// Filter by subforum
		if (subforumFilter !== 'all') {
			result = result.filter(d => d.subforum === subforumFilter)
		}

		// Filter by search
		if (searchQuery) {
			const query = searchQuery.toLowerCase()
			result = result.filter(d => d.title.toLowerCase().includes(query) || d.content.toLowerCase().includes(query))
		}

		// Sort
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

	// Check if any filter is active
	const hasActiveFilters = searchQuery !== '' || selectedFolder !== null || subforumFilter !== 'all'

	// Clear all filters
	const clearFilters = useCallback(() => {
		setSearchQuery('')
		setSelectedFolder(null)
		setSubforumFilter('all')
	}, [])

	return {
		// State
		searchQuery,
		selectedFolder,
		subforumFilter,
		sortOrder,

		// Setters
		setSearchQuery,
		setSelectedFolder,
		setSubforumFilter,
		setSortOrder,

		// Computed
		filteredDrafts,
		typeFilteredDrafts,
		hasActiveFilters,

		// Actions
		clearFilters,
	}
}
