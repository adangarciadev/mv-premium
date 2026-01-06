/**
 * useSavedThreadsTable Hook
 * Manages state and handlers for the saved threads table
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { SortingState, RowSelectionState } from '@tanstack/react-table'
import {
	getSavedThreads,
	unsaveThreads,
	watchSavedThreads,
	importSavedThreads,
	updateThreadNotes,
	type SavedThread,
} from '../../logic/storage'
import { toast } from '@/lib/lazy-toast'
import { getSubforumInfo, ITEMS_PER_PAGE } from './utils'
import type { DateFilter, SubforumInfo } from './types'

interface UseSavedThreadsTableReturn {
	// Data
	threads: SavedThread[]
	filteredData: SavedThread[]
	subforumsList: SubforumInfo[]
	isLoading: boolean
	isDeleting: boolean

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
	showNoteDialog: boolean
	setShowNoteDialog: (show: boolean) => void
	editingNote: string
	setEditingNote: (note: string) => void
	activeThreadId: string | null

	// Handlers
	handleOpenNoteEditor: (thread: SavedThread) => void
	handleSaveNote: () => Promise<void>
	handleDeleteSelected: (selectedIds: string[]) => Promise<void>
	handleExport: (selectedThreads: SavedThread[]) => void
	handleImport: () => void
}

export function useSavedThreadsTable(): UseSavedThreadsTableReturn {
	// State
	const [threads, setThreads] = useState<SavedThread[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [isDeleting, setIsDeleting] = useState(false)
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [subforumFilter, setSubforumFilter] = useState('all')
	const [dateFilter, setDateFilter] = useState<DateFilter>('all')
	const [sorting, setSorting] = useState<SortingState>([{ id: 'savedAt', desc: true }])
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

	// Notes Dialog State
	const [showNoteDialog, setShowNoteDialog] = useState(false)
	const [editingNote, setEditingNote] = useState('')
	const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

	// Subforums for filter
	const subforumsList = useMemo(() => {
		const uniquePaths = new Set(threads.map(t => t.subforumId))
		return Array.from(uniquePaths)
			.map(path => getSubforumInfo(path))
			.sort((a, b) => a.name.localeCompare(b.name, 'es'))
	}, [threads])

	// Load threads
	useEffect(() => {
		const load = async () => {
			setIsLoading(true)
			const data = await getSavedThreads()
			setThreads(data)
			setIsLoading(false)
		}
		load()

		// Debounce storage change handler to prevent rapid re-renders during batch operations
		let debounceTimer: ReturnType<typeof setTimeout> | null = null
		const debouncedReload = async () => {
			if (debounceTimer) clearTimeout(debounceTimer)
			debounceTimer = setTimeout(async () => {
				const data = await getSavedThreads()
				setThreads(data)
			}, 100) // 100ms debounce - allows batch operations to complete
		}

		const unwatch = watchSavedThreads(debouncedReload)

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer)
			unwatch()
		}
	}, [])

	// Filter data
	const filteredData = useMemo(() => {
		let result = threads

		if (searchQuery) {
			const q = searchQuery.toLowerCase()
			result = result.filter(t => t.title.toLowerCase().includes(q) || (t.notes && t.notes.toLowerCase().includes(q)))
		}

		if (subforumFilter !== 'all') {
			result = result.filter(t => t.subforumId === subforumFilter)
		}

		if (dateFilter !== 'all') {
			const now = Date.now()
			const oneDay = 24 * 60 * 60 * 1000
			result = result.filter(t => {
				const diff = now - t.savedAt
				if (dateFilter === 'today') return diff < oneDay
				if (dateFilter === 'week') return diff < oneDay * 7
				if (dateFilter === 'month') return diff < oneDay * 30
				return true
			})
		}

		return result
	}, [threads, searchQuery, subforumFilter, dateFilter])

	// Handlers
	const handleOpenNoteEditor = useCallback((thread: SavedThread) => {
		setActiveThreadId(thread.id)
		setEditingNote(thread.notes || '')
		setShowNoteDialog(true)
	}, [])

	const handleSaveNote = useCallback(async () => {
		if (activeThreadId) {
			await updateThreadNotes(activeThreadId, editingNote)
			setShowNoteDialog(false)
			setActiveThreadId(null)
			setEditingNote('')
			toast.success('Nota guardada')
		}
	}, [activeThreadId, editingNote])

	const handleDeleteSelected = useCallback(async (selectedIds: string[]) => {
		if (selectedIds.length === 0) return

		setIsDeleting(true)

		try {
			await unsaveThreads(selectedIds)
			setRowSelection({})
			setShowDeleteDialog(false)
			toast.success(`${selectedIds.length} hilos eliminados`)
		} catch {
			toast.error('Error al eliminar hilos')
		} finally {
			setIsDeleting(false)
		}
	}, [])

	const handleExport = useCallback((selectedThreads: SavedThread[]) => {
		if (selectedThreads.length === 0) return

		const t = toast.loading(`Preparando exportación de ${selectedThreads.length} hilos...`)

		// Small delay to make it feel more "premium" and real
		setTimeout(() => {
			const data = JSON.stringify(selectedThreads, null, 2)
			const blob = new Blob([data], { type: 'application/json' })
			const url = URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = `mv-saved-threads-${new Date().toISOString().split('T')[0]}.json`
			a.click()
			URL.revokeObjectURL(url)
			toast.success(`${selectedThreads.length} hilos exportados`, { id: t })
		}, 800)
	}, [])

	const handleImport = useCallback(() => {
		const input = document.createElement('input')
		input.type = 'file'
		input.accept = 'application/json'
		input.onchange = async e => {
			const file = (e.target as HTMLInputElement).files?.[0]
			if (!file) return
			const reader = new FileReader()
			reader.onload = async ev => {
				try {
					const imported = JSON.parse(ev.target?.result as string) as SavedThread[]
					const { added, updated } = await importSavedThreads(imported)
					toast.success(`Importados: ${added} nuevos, ${updated} actualizados`)
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
		threads,
		filteredData,
		subforumsList,
		isLoading,
		isDeleting,

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
		showNoteDialog,
		setShowNoteDialog,
		editingNote,
		setEditingNote,
		activeThreadId,

		// Handlers
		handleOpenNoteEditor,
		handleSaveNote,
		handleDeleteSelected,
		handleExport,
		handleImport,
	}
}
