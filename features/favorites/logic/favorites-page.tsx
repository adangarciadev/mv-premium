/**
 * Favorites Page
 *
 * Injects checks into the native table + React action bar in Shadow DOM
 */

import { useState, useCallback, useSyncExternalStore, useRef, useEffect } from 'react'
import { toast } from '@/lib/lazy-toast'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Search from 'lucide-react/dist/esm/icons/search'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { mountFeature, unmountFeature } from '@/lib/content-modules/utils/react-helpers'
import { batchDeleteFavorites } from './delete-favorites'

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
import { MV_SELECTORS, DOM_MARKERS, FEATURE_IDS } from '@/constants'
import { logger } from '@/lib/logger'

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const MARKER = DOM_MARKERS.INJECTION.FAVORITES
const CB_CLASS = DOM_MARKERS.CLASSES.FAV_CHECKBOX
const FEATURE_ID = FEATURE_IDS.FAVORITES_ACTION_BAR

// ─────────────────────────────────────────────────────────────
// DOM Helpers (native table)
// ─────────────────────────────────────────────────────────────

const table = () => document.getElementById(MV_SELECTORS.FORUM.THREAD_TABLE.replace('#', '')) as HTMLTableElement | null
const rows = () => Array.from(document.querySelectorAll<HTMLTableRowElement>(MV_SELECTORS.FORUM.THREAD_ROW))
const visibleRows = () => rows().filter(r => r.style.display !== 'none')

/**
 * Retrieves the IDs of all currently checked threads in the native table.
 * @returns Array of thread IDs
 */
function getCheckedIds(): string[] {
	return visibleRows()
		.map(r => r.querySelector<HTMLInputElement>(`input.${CB_CLASS}:checked`)?.dataset.tid)
		.filter(Boolean) as string[]
}

// ─────────────────────────────────────────────────────────────
// Store to synchronize state between DOM and React
// ─────────────────────────────────────────────────────────────

let listeners: Array<() => void> = []
let snapshot = { checkedCount: 0, visibleCount: 0 }
let tableClickHandler: ((e: MouseEvent) => void) | null = null
let selectAllChangeHandler: ((e: Event) => void) | null = null

function emitChange() {
	snapshot = {
		checkedCount: getCheckedIds().length,
		visibleCount: visibleRows().length,
	}
	listeners.forEach(l => l())
}

function subscribe(listener: () => void) {
	listeners.push(listener)
	return () => {
		listeners = listeners.filter(l => l !== listener)
	}
}

function getSnapshot() {
	return snapshot
}

// ─────────────────────────────────────────────────────────────
// React Component: Action Bar
// ─────────────────────────────────────────────────────────────

function FavoritesActionBar() {
	const [search, setSearch] = useState('')
	const [isDeleting, setIsDeleting] = useState(false)
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)
	const state = useSyncExternalStore(subscribe, getSnapshot)

	const handleSearch = useCallback((value: string) => {
		setSearch(value)
		const q = value.toLowerCase().trim()

		for (const row of rows()) {
			const title =
				row
					.querySelector(`${MV_SELECTORS.FORUM.THREAD_TITLE_LINK}, ${MV_SELECTORS.FORUM.THREAD_TITLE_LINK_READ}`)
					?.textContent?.toLowerCase() ?? ''
			const show = !q || title.includes(q)
			row.style.display = show ? '' : 'none'
			if (!show) {
				const cb = row.querySelector<HTMLInputElement>(`input.${CB_CLASS}`)
				if (cb) cb.checked = false
			}
		}
		emitChange()
	}, [])

	const handleDeleteConfirm = useCallback(async () => {
		const ids = getCheckedIds()
		if (!ids.length) return

		setIsDeleting(true)
		// Show loading toast
		const toastId = toast.loading('Eliminando favoritos...')

		try {
			const result = await batchDeleteFavorites(ids)
			result.success.forEach(id => document.getElementById(`t${id}`)?.remove())

			if (result.failed.length) {
				toast.error(`${result.failed.length} no se pudieron eliminar`, { id: toastId })
			} else if (result.success.length) {
				toast.success(`${result.success.length} eliminado(s)`, { id: toastId })
			} else {
				// Edge case where there was nothing to delete or it failed silently
				toast.dismiss(toastId)
			}
		} catch (e) {
			logger.error('Error deleting favorites:', e)
			toast.error('Error al eliminar', { id: toastId })
		} finally {
			setIsDeleting(false)
			setShowDeleteDialog(false)
			emitChange()
		}
	}, [])

	return (
		<ShadowWrapper>
			<div
				ref={containerRef}
				className="flex items-center justify-between gap-4 p-4 bg-sidebar border border-border rounded-lg shadow-xl outline outline-1 outline-black/50"
			>
				{/* Search - Left side */}
				<div className="relative">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
					<Input
						type="text"
						placeholder="Buscar hilos..."
						value={search}
						onChange={e => handleSearch(e.target.value)}
						className="pl-8 w-64 h-9 bg-secondary/50 border-border/50"
					/>
				</div>

				{/* Delete Button - Right side */}
				<Button
					variant={state.checkedCount > 0 ? 'destructive' : 'secondary'}
					size="sm"
					disabled={state.checkedCount === 0 || isDeleting}
					onClick={() => setShowDeleteDialog(true)}
				>
					<Trash2 className="w-4 h-4 mr-2" />
					Eliminar ({state.checkedCount})
				</Button>
			</div>

			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>¿Eliminar {state.checkedCount} favoritos?</AlertDialogTitle>
						<AlertDialogDescription>
							Esta acción no se puede deshacer. Los hilos seleccionados dejarán de estar en tu lista de favoritos.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDeleteConfirm}
							disabled={isDeleting}
							className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
						>
							{isDeleting ? 'Eliminando...' : 'Eliminar'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</ShadowWrapper>
	)
}

/**
 * Injects selection checkboxes into the native Mediavida favorites table.
 * Also adds the 'Select All' checkbox in the table header.
 */
function injectCheckboxes(): void {
	const t = table()
	if (!t) return

	// Header checkbox
	const headerRow = t.querySelector('thead tr')
	if (headerRow && !headerRow.querySelector(`#${DOM_MARKERS.IDS.FAV_SELECT_ALL}`)) {
		const th = document.createElement('th')
		th.style.cssText = 'width:30px; text-align:center;'
		th.innerHTML = `<input type="checkbox" id="${DOM_MARKERS.IDS.FAV_SELECT_ALL}" style="width:16px;height:16px;cursor:pointer;accent-color:#818cf8;">`
		headerRow.insertBefore(th, headerRow.firstChild)
	}

	// Row checkboxes
	for (const row of rows()) {
		if (row.querySelector(`input.${CB_CLASS}`)) continue
		const tid = row.id.replace('t', '')
		if (!tid) continue

		const td = document.createElement('td')
		td.style.cssText = 'width:30px; text-align:center; vertical-align:middle;'
		td.innerHTML = `<input type="checkbox" class="${CB_CLASS}" data-tid="${tid}" style="width:16px;height:16px;cursor:pointer;accent-color:#818cf8;">`
		row.insertBefore(td, row.firstChild)
	}

	// Hover styles (Updated to 0.15 opacity and transition)
	// favorites-page.tsx -> inside injectCheckboxes()

	// Styles injection
	// 1. Cleanup
	const existingStyle = document.getElementById(DOM_MARKERS.IDS.FAV_STYLES)
	if (existingStyle) existingStyle.remove()

	// 2. FIXED INJECTION (Dual Theme Support)
	const style = document.createElement('style')
	style.id = DOM_MARKERS.IDS.FAV_STYLES
	style.textContent = `
    /* Define variables based on theme */
    :root {
        --mvp-fav-overlay-rgb: 0, 0, 0; /* Light Mode: Black overlay */
    }
    :root.dark, body.dark {
        --mvp-fav-overlay-rgb: 255, 255, 255; /* Dark Mode: White overlay */
    }

    /* Smooth transition */
    #tablatemas tr td {
        transition: background-image 0.1s ease;
    }
    
    /* HOVER: Use variable for overlay color */
    html body table#tablatemas tbody tr:hover td {
        background-image: linear-gradient(rgba(var(--mvp-fav-overlay-rgb), 0.05), rgba(var(--mvp-fav-overlay-rgb), 0.05)) !important;
    }

    /* SELECTED: Use variable for overlay color (more intense) */
    html body table#tablatemas tbody tr.selected td {
        background-image: linear-gradient(rgba(var(--mvp-fav-overlay-rgb), 0.08), rgba(var(--mvp-fav-overlay-rgb), 0.08)) !important;
    }

    /* Cleanup of native TR to avoid conflicts */
    html body table#tablatemas tbody tr:hover,
    html body table#tablatemas tbody tr.selected {
        background-image: none !important;
        background-color: transparent !important;
    }
    
    #tablatemas tr:hover td.col-th a.h, #tablatemas tr:hover td.col-th a.hb { color: #ff5912 !important; }
  `
	document.head.appendChild(style)
}

/**
 * Sets up event delegation for checkboxes and handles Shift+Click range selection.
 */
function setupEventListeners(): void {
	const t = table()
	if (!t) return

	let lastCheckedIndex = -1

	selectAllChangeHandler = e => {
		const checked = (e.target as HTMLInputElement).checked
		visibleRows().forEach(r => {
			const cb = r.querySelector<HTMLInputElement>(`input.${CB_CLASS}`)
			if (cb) {
				cb.checked = checked
				if (checked) r.classList.add('selected')
				else r.classList.remove('selected')
			}
		})
		lastCheckedIndex = -1
		emitChange()
	}

	const selectAll = document.getElementById(DOM_MARKERS.IDS.FAV_SELECT_ALL)
	selectAll?.addEventListener('change', selectAllChangeHandler)

	tableClickHandler = e => {
		const target = e.target as HTMLElement
		if (target.classList.contains(CB_CLASS) && target instanceof HTMLInputElement) {
			const currentRow = target.closest('tr')
			const allRows = visibleRows()
			const currentIndex = allRows.indexOf(currentRow as HTMLTableRowElement)

			const setRowState = (row: HTMLTableRowElement, isChecked: boolean) => {
				const cb = row.querySelector<HTMLInputElement>(`input.${CB_CLASS}`)
				if (cb) cb.checked = isChecked
				if (isChecked) row.classList.add('selected')
				else row.classList.remove('selected')
			}

			if ((e as MouseEvent).shiftKey && lastCheckedIndex !== -1 && lastCheckedIndex !== currentIndex) {
				const start = Math.min(lastCheckedIndex, currentIndex)
				const end = Math.max(lastCheckedIndex, currentIndex)
				const checkedState = target.checked
				for (let i = start; i <= end; i++) {
					setRowState(allRows[i], checkedState)
				}
			} else {
				if (currentRow) setRowState(currentRow, target.checked)
			}

			lastCheckedIndex = currentIndex

			const allCbs = allRows
				.map(r => r.querySelector<HTMLInputElement>(`input.${CB_CLASS}`))
				.filter(Boolean) as HTMLInputElement[]
			const checkedCount = allCbs.filter(cb => cb.checked).length
			const headerCb = document.getElementById(DOM_MARKERS.IDS.FAV_SELECT_ALL) as HTMLInputElement | null
			if (headerCb) {
				headerCb.checked = allCbs.length > 0 && checkedCount === allCbs.length
				headerCb.indeterminate = checkedCount > 0 && checkedCount < allCbs.length
			}
			emitChange()
		}
	}

	t.addEventListener('click', tableClickHandler)
}

/**
 * Initializes the Favorites page enhancements.
 * Injects checkboxes and the React-based Action Bar.
 */
export function injectFavoritesPageButtons(): void {
	const t = table()
	if (!t || t.hasAttribute(MARKER)) return
	logger.debug('Favorites inject')
	t.setAttribute(MARKER, 'true')

	// 1. Inject checkboxes into native table
	injectCheckboxes()
	setupEventListeners()

	// 2. Mount React action bar in Shadow DOM
	const container = document.createElement('div')
	container.id = DOM_MARKERS.IDS.FAV_BAR_CONTAINER
	// Apply sticky styles to the host container so it sticks to the viewport
	container.style.cssText = 'position: sticky; top: 52px; z-index: 50; margin-bottom: 1rem;'

	// Insert before the table container
	t.closest('.wpx')?.insertBefore(container, t.closest('.wpx')?.firstChild ?? null)

	mountFeature(FEATURE_ID, container, <FavoritesActionBar />)

	// Initialize snapshot
	emitChange()
}

/**
 * Cleans up all injected elements and unmounts React components.
 */
export function cleanupFavoritesPage(): void {
	unmountFeature(FEATURE_ID)
	document.getElementById(DOM_MARKERS.IDS.FAV_BAR_CONTAINER)?.remove()
	document.getElementById(DOM_MARKERS.IDS.FAV_STYLES)?.remove()

	const t = table()
	if (t && t.hasAttribute(MARKER)) {
		t.removeAttribute(MARKER)

		if (tableClickHandler) {
			t.removeEventListener('click', tableClickHandler)
			tableClickHandler = null
		}
		if (selectAllChangeHandler) {
			document.getElementById(DOM_MARKERS.IDS.FAV_SELECT_ALL)?.removeEventListener('change', selectAllChangeHandler)
			selectAllChangeHandler = null
		}

		// Remove injected checkboxes/columns
		const headerRow = t.querySelector('thead tr')
		headerRow?.querySelector(`#${DOM_MARKERS.IDS.FAV_SELECT_ALL}`)?.closest('th')?.remove()

		for (const row of rows()) {
			const injectedCell = row.querySelector(`td > input.${CB_CLASS}`)?.parentElement
			injectedCell?.remove()
			row.classList.remove('selected')
		}
	}
}
