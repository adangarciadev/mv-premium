/**
 * useDraftsSearch - Hook for fast full-text search using FlexSearch
 * Indexes drafts by title and content for performant searching
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { Draft } from '@/features/drafts/storage'
import { DEBOUNCE } from '@/constants'

// ============================================================================
// Types
// ============================================================================

export interface UseDraftsSearchOptions {
	/** All drafts to index */
	drafts: Draft[]
	/** Debounce delay in ms (default: DEBOUNCE.INPUT) */
	debounceMs?: number
}

export interface UseDraftsSearchReturn {
	/** Current search query */
	searchQuery: string
	/** Set search query (debounced internally) */
	setSearchQuery: (query: string) => void
	/** IDs of drafts matching the search */
	matchingIds: Set<string>
	/** Whether a search is active */
	isSearching: boolean
	/** Check if a draft matches current search */
	matchesDraft: (draftId: string) => boolean
}

// Simple encoder for Spanish text
function encodeText(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '') // Remove accents
}

// ============================================================================
// Hook
// ============================================================================

export function useDraftsSearch({ drafts, debounceMs = DEBOUNCE.INPUT }: UseDraftsSearchOptions): UseDraftsSearchReturn {
	const [searchQuery, setSearchQueryRaw] = useState('')
	const [debouncedQuery, setDebouncedQuery] = useState('')
	const [matchingIds, setMatchingIds] = useState<Set<string>>(new Set())

	// Index map: draftId -> searchable text
	const indexMapRef = useRef<Map<string, string>>(new Map())

	// Build index when drafts change
	useEffect(() => {
		const indexMap = new Map<string, string>()

		for (const draft of drafts) {
			// Combine title and content for searching
			const searchableText = encodeText(`${draft.title} ${draft.content}`)
			indexMap.set(draft.id, searchableText)
		}

		indexMapRef.current = indexMap

		// Re-search with current query if any
		if (debouncedQuery) {
			performSearch(debouncedQuery)
		}
	}, [drafts])

	// Debounce search query
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(searchQuery)
		}, debounceMs)

		return () => clearTimeout(timer)
	}, [searchQuery, debounceMs])

	// Perform search
	const performSearch = useCallback((query: string) => {
		if (!query.trim()) {
			setMatchingIds(new Set())
			return
		}

		const indexMap = indexMapRef.current
		const encodedQuery = encodeText(query.trim())
		const queryTerms = encodedQuery.split(/\s+/).filter(Boolean)

		const ids = new Set<string>()

		// Match drafts that contain ALL query terms (AND logic)
		for (const [draftId, searchableText] of indexMap) {
			const allTermsMatch = queryTerms.every(term => searchableText.includes(term))
			if (allTermsMatch) {
				ids.add(draftId)
			}
		}

		setMatchingIds(ids)
	}, [])

	// Trigger search when debounced query changes
	useEffect(() => {
		performSearch(debouncedQuery)
	}, [debouncedQuery, performSearch])

	// Check if a draft matches
	const matchesDraft = useCallback(
		(draftId: string): boolean => {
			if (!debouncedQuery.trim()) return true // No search = all match
			return matchingIds.has(draftId)
		},
		[debouncedQuery, matchingIds]
	)

	// Whether search is active
	const isSearching = debouncedQuery.trim() !== ''

	return {
		searchQuery,
		setSearchQuery: setSearchQueryRaw,
		matchingIds,
		isSearching,
		matchesDraft,
	}
}
