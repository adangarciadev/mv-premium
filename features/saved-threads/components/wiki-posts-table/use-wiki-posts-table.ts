/**
 * useWikiPostsTable Hook
 * Manages state and handlers for the wiki posts table
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useDebounce } from 'use-debounce'
import type { SortingState, RowSelectionState } from '@tanstack/react-table'
import {
	getAllPinnedPosts,
	batchUnpinPosts,
	pinPostToThread,
	type ThreadWithPinnedPosts,
} from '@/features/pinned-posts/logic/storage'
import { storage } from '#imports'
import { toast } from '@/lib/lazy-toast'
import { getSubforumInfo, ITEMS_PER_PAGE } from './utils'
import type { FlatPinnedPost, SubforumOption, DateFilter } from './types'

interface UseWikiPostsTableReturn {
	// Data
	flatPosts: FlatPinnedPost[]
	filteredPosts: FlatPinnedPost[]
	subforumsList: SubforumOption[]
	isLoading: boolean

	// Filters
	searchQuery: string
	setSearchQuery: (query: string) => void
	subforumFilter: string
	setSubforumFilter: (filter: string) => void
	dateFilter: DateFilter
	setDateFilter: (filter: DateFilter) => void

	// Table state
	sorting: SortingState
	setSorting: React.Dispatch<React.SetStateAction<SortingState>>
	rowSelection: RowSelectionState
	setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>

	// Dialog state
	showDeleteDialog: boolean
	setShowDeleteDialog: (show: boolean) => void
	postToDelete: { threadId: string; postNum: number } | null
	setPostToDelete: (post: { threadId: string; postNum: number } | null) => void

	// Handlers
	handleDeleteSelected: () => Promise<void>
	handleExport: (selectedRows: FlatPinnedPost[]) => void
	handleImport: () => void
}

export function useWikiPostsTable(): UseWikiPostsTableReturn {
	// State
	const [threadsWithPosts, setThreadsWithPosts] = useState<ThreadWithPinnedPosts[]>([])
	const [searchQuery, setSearchQuery] = useState('')
	const [debouncedSearchQuery] = useDebounce(searchQuery, 300)
	const [sorting, setSorting] = useState<SortingState>([{ id: 'timestamp', desc: true }])
	const [isLoading, setIsLoading] = useState(true)
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)
	const [postToDelete, setPostToDelete] = useState<{ threadId: string; postNum: number } | null>(null)
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

	// Filters
	const [subforumFilter, setSubforumFilter] = useState('all')
	const [dateFilter, setDateFilter] = useState<DateFilter>('all')

	// Flatten posts for table
	const flatPosts = useMemo<FlatPinnedPost[]>(() => {
		const result: FlatPinnedPost[] = []
		for (const thread of threadsWithPosts) {
			for (const post of thread.posts) {
				result.push({
					...post,
					threadId: thread.threadId,
					threadTitle: thread.threadTitle,
					subforum: thread.subforum,
				})
			}
		}
		return result
	}, [threadsWithPosts])

	// Subforums list for filter dropdown
	const subforumsList = useMemo(() => {
		const uniqueSubforums = new Set(threadsWithPosts.map(t => t.subforum).filter(Boolean))
		return Array.from(uniqueSubforums)
			.map(slug => ({
				id: slug,
				name: getSubforumInfo(slug).name,
			}))
			.sort((a, b) => a.name.localeCompare(b.name, 'es'))
	}, [threadsWithPosts])

	// Load data
	useEffect(() => {
		const load = async () => {
			setIsLoading(true)
			const data = await getAllPinnedPosts()
			setThreadsWithPosts(data)
			setIsLoading(false)
		}
		load()

		const unwatch = storage.watch<unknown>('local:mvp-pinned-', () => {
			void load()
		})
		return unwatch
	}, [])

	// Filtered posts
	const filteredPosts = useMemo(() => {
		let result = [...flatPosts]

		// Search filter
		if (debouncedSearchQuery) {
			const query = debouncedSearchQuery.toLowerCase()
			result = result.filter(
				p =>
					p.threadTitle.toLowerCase().includes(query) ||
					p.author.toLowerCase().includes(query) ||
					p.preview.toLowerCase().includes(query)
			)
		}

		// Subforum filter
		if (subforumFilter !== 'all') {
			result = result.filter(p => p.subforum === subforumFilter)
		}

		// Date filter
		if (dateFilter !== 'all') {
			const now = Date.now()
			const oneDay = 24 * 60 * 60 * 1000

			result = result.filter(p => {
				const diff = now - p.timestamp
				if (dateFilter === 'today') return diff < oneDay
				if (dateFilter === 'week') return diff < oneDay * 7
				if (dateFilter === 'month') return diff < oneDay * 30
				return true
			})
		}

		return result
	}, [flatPosts, debouncedSearchQuery, subforumFilter, dateFilter])

	// Delete handler
	const handleDeleteSelected = useCallback(async () => {
		const selectedKeys = Object.keys(rowSelection)
		const postsToDelete = postToDelete
			? [postToDelete]
			: selectedKeys.map(key => {
					const idx = parseInt(key)
					const post = filteredPosts[idx]
					return {
						threadId: post.threadId,
						postNum: post.num,
					}
			  })

		if (postsToDelete.length === 0) return

		// Optimistic UI update
		setThreadsWithPosts(prev => {
			return prev
				.map(thread => {
					const postsForThread = postsToDelete.filter(p => p.threadId === thread.threadId)
					if (postsForThread.length === 0) return thread
					const postNumsToRemove = new Set(postsForThread.map(p => p.postNum))
					return {
						...thread,
						posts: thread.posts.filter(p => !postNumsToRemove.has(p.num)),
					}
				})
				.filter(thread => thread.posts.length > 0)
		})

		await batchUnpinPosts(postsToDelete)

		if (postToDelete) {
			setPostToDelete(null)
		} else {
			setRowSelection({})
		}

		setShowDeleteDialog(false)
		toast.success(postsToDelete.length === 1 ? 'Post eliminado' : `${postsToDelete.length} posts eliminados`)
	}, [postToDelete, rowSelection, filteredPosts])

	// Export handler
	const handleExport = useCallback((selectedPosts: FlatPinnedPost[]) => {
		if (selectedPosts.length === 0) return

		// Group selected flat posts back into threads
		const groups: Record<string, ThreadWithPinnedPosts> = {}
		for (const post of selectedPosts) {
			if (!groups[post.threadId]) {
				groups[post.threadId] = {
					threadId: post.threadId,
					threadTitle: post.threadTitle,
					subforum: post.subforum,
					posts: [],
				}
			}
			const { threadId, threadTitle, subforum, ...pinnedPost } = post
			groups[post.threadId].posts.push(pinnedPost)
		}
		const dataToExport = Object.values(groups)

		const t = toast.loading(`Preparando exportación de ${selectedPosts.length} posts...`)

		setTimeout(() => {
			const data = JSON.stringify(dataToExport, null, 2)
			const blob = new Blob([data], { type: 'application/json' })
			const url = URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = `mvp-wiki-posts-${new Date().toISOString().split('T')[0]}.json`
			a.click()
			URL.revokeObjectURL(url)
			toast.success(`${selectedPosts.length} posts anclados exportados`, { id: t })
		}, 800)
	}, [])

	// Import handler
	const handleImport = useCallback(() => {
		const input = document.createElement('input')
		input.type = 'file'
		input.accept = 'application/json'
		input.onchange = async e => {
			const file = (e.target as HTMLInputElement).files?.[0]
			if (!file) return
			const reader = new FileReader()
			reader.onload = async event => {
				try {
					const content = event.target?.result as string
					const importedData = JSON.parse(content) as ThreadWithPinnedPosts[]
					for (const thread of importedData) {
						for (const post of thread.posts) {
							await pinPostToThread(thread.threadId, post)
						}
					}
					const data = await getAllPinnedPosts()
					setThreadsWithPosts(data)
					toast.success('Posts anclados importados correctamente')
				} catch {
					toast.error('Error al importar archivo')
				}
			}
			reader.readAsText(file)
		}
		input.click()
	}, [])

	return {
		// Data
		flatPosts,
		filteredPosts,
		subforumsList,
		isLoading,

		// Filters
		searchQuery,
		setSearchQuery,
		subforumFilter,
		setSubforumFilter,
		dateFilter,
		setDateFilter,

		// Table state
		sorting,
		setSorting,
		rowSelection,
		setRowSelection,

		// Dialog state
		showDeleteDialog,
		setShowDeleteDialog,
		postToDelete,
		setPostToDelete,

		// Handlers
		handleDeleteSelected,
		handleExport,
		handleImport,
	}
}
