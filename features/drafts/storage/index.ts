/**
 * Drafts Storage - Persistencia de borradores y carpetas
 * Refactorizado para usar @wxt-dev/storage (API unificada)
 *
 * Uses lz-string compression to reduce storage footprint.
 */
import { storage } from '@wxt-dev/storage'
import { generateId } from '@/lib/id-generator'
import { STORAGE_KEYS } from '@/constants'
import { getCompressed, setCompressed } from '@/lib/storage/compressed-storage'

// ============================================================================
// TYPES
// ============================================================================

export interface Draft {
	id: string
	title: string
	content: string
	/** Tipo de documento: borrador o plantilla */
	type: 'draft' | 'template'
	subforum?: string
	/** Category value from the subforum's tag select (e.g., "156" for "Debate") */
	category?: string
	/** Human-readable category label (e.g., "Debate", "Off-Topic") */
	categoryLabel?: string
	folderId?: string
	/** Trigger/shortcut for template expansion (e.g., "/saludo"). Only for templates. */
	trigger?: string
	createdAt: number
	updatedAt: number
}

export interface DraftFolder {
	id: string
	name: string
	icon: string
	color?: string
	/** Folder type: 'draft' or 'template' */
	type?: 'draft' | 'template'
	createdAt: number
}

export interface DraftsData {
	drafts: Draft[]
	folders: DraftFolder[]
}

// ============================================================================
// STORAGE KEY & WATCHER
// ============================================================================
const DRAFTS_KEY = `local:${STORAGE_KEYS.DRAFTS}` as const
const DEFAULT_DATA: DraftsData = { drafts: [], folders: [] }

// Storage item for watching (WXT pattern) - still needed for watch() functionality
export const draftsStorage = storage.defineItem<DraftsData>(DRAFTS_KEY, {
	defaultValue: DEFAULT_DATA,
})

// ============================================================================
// INTERNAL HELPERS (using compressed storage)
// ============================================================================

async function getData(): Promise<DraftsData> {
	const data = await getCompressed<DraftsData>(DRAFTS_KEY)
	return data || DEFAULT_DATA
}

async function setData(data: DraftsData): Promise<void> {
	await setCompressed(DRAFTS_KEY, data)
}

// ============================================================================
// DRAFTS CRUD
// ============================================================================

export async function getDrafts(): Promise<Draft[]> {
	const data = await getData()
	const drafts = data.drafts

	// Migration: ensure all drafts have a type and content
	for (const draft of drafts) {
		if (!draft.type) {
			draft.type = 'draft'
		}
		if (draft.content === undefined || draft.content === null) {
			draft.content = ''
		}
	}

	return drafts.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getDraft(id: string): Promise<Draft | null> {
	const data = await getData()
	const draft = data.drafts.find(d => d.id === id)

	if (!draft) return null

	// Ensure content is string
	if (draft.content === undefined || draft.content === null) {
		draft.content = ''
	}

	return draft
}

export async function createDraft(draft: Omit<Draft, 'id' | 'createdAt' | 'updatedAt'>): Promise<Draft> {
	const data = await getData()

	const newDraft: Draft = {
		...draft,
		id: generateId(),
		createdAt: Date.now(),
		updatedAt: Date.now(),
	}

	data.drafts.push(newDraft)
	await setData(data)

	return newDraft
}

export async function updateDraft(
	id: string,
	updates: Partial<Omit<Draft, 'id' | 'createdAt'>>
): Promise<Draft | null> {
	const data = await getData()

	const index = data.drafts.findIndex(d => d.id === id)
	if (index === -1) return null

	data.drafts[index] = {
		...data.drafts[index],
		...updates,
		updatedAt: Date.now(),
	}

	await setData(data)

	return data.drafts[index]
}

export async function deleteDraft(id: string): Promise<boolean> {
	const data = await getData()

	const index = data.drafts.findIndex(d => d.id === id)
	if (index === -1) return false

	const deleted = data.drafts.splice(index, 1)[0]
	await setData(data)

	return true
}

export async function duplicateDraft(id: string): Promise<Draft | null> {
	const data = await getData()

	const original = data.drafts.find(d => d.id === id)
	if (!original) return null

	// Generate a unique title for the duplicate
	const newTitle = generateDuplicateTitle(original.title, data.drafts)

	const newDraft: Draft = {
		...original,
		id: generateId(),
		title: newTitle,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	}

	data.drafts.push(newDraft)
	await setData(data)

	return newDraft
}

/**
 * Generate a unique title for duplicated drafts.
 * - Removes existing "(copia)" or "(copia N)" suffixes
 * - Adds "(copia)" or "(copia N)" to make it unique
 * - Enforces 72 character limit
 */
function generateDuplicateTitle(originalTitle: string, existingDrafts: Draft[]): string {
	const MAX_TITLE_LENGTH = 72
	const COPY_SUFFIX = ' (copia)'

	// Remove existing copy suffixes: "(copia)" or "(copia N)"
	const baseTitle = originalTitle.replace(/\s*\(copia(?:\s+\d+)?\)$/i, '').trim()

	// Get all existing titles for comparison
	const existingTitles = new Set(existingDrafts.map(d => d.title.toLowerCase()))

	// Try "(copia)" first
	let candidateTitle = baseTitle + COPY_SUFFIX
	if (candidateTitle.length > MAX_TITLE_LENGTH) {
		// Truncate base title to fit
		const maxBaseLength = MAX_TITLE_LENGTH - COPY_SUFFIX.length
		candidateTitle = baseTitle.slice(0, maxBaseLength).trim() + COPY_SUFFIX
	}

	if (!existingTitles.has(candidateTitle.toLowerCase())) {
		return candidateTitle
	}

	// Try "(copia N)" with incrementing numbers
	let copyNumber = 2
	while (copyNumber < 1000) {
		const numberedSuffix = ` (copia ${copyNumber})`
		candidateTitle = baseTitle + numberedSuffix

		if (candidateTitle.length > MAX_TITLE_LENGTH) {
			// Truncate base title to fit
			const maxBaseLength = MAX_TITLE_LENGTH - numberedSuffix.length
			candidateTitle = baseTitle.slice(0, maxBaseLength).trim() + numberedSuffix
		}

		if (!existingTitles.has(candidateTitle.toLowerCase())) {
			return candidateTitle
		}

		copyNumber++
	}

	// Fallback: just return truncated title with timestamp
	const fallbackSuffix = ` (${Date.now()})`
	const maxBaseLength = MAX_TITLE_LENGTH - fallbackSuffix.length
	return baseTitle.slice(0, maxBaseLength).trim() + fallbackSuffix
}

/**
 * Convert a draft to a template or vice versa.
 * When converting to draft, removes the trigger.
 * When converting to template, keeps the content but trigger must be set later.
 */
export async function convertDraftType(id: string): Promise<Draft | null> {
	const data = await getData()

	const draft = data.drafts.find(d => d.id === id)
	if (!draft) return null

	// Toggle type
	const newType = draft.type === 'draft' ? 'template' : 'draft'

	draft.type = newType
	draft.updatedAt = Date.now()

	// If converting to draft, clear the trigger (drafts don't have triggers)
	if (newType === 'draft') {
		draft.trigger = undefined
	}

	await setData(data)

	const action = newType === 'template' ? 'Converted to template' : 'Converted to draft'

	return draft
}

export async function moveDraftToFolder(draftId: string, folderId: string | undefined): Promise<boolean> {
	const data = await getData()

	const draft = data.drafts.find(d => d.id === draftId)
	if (!draft) return false

	draft.folderId = folderId
	draft.updatedAt = Date.now()

	await setData(data)
	return true
}

// ============================================================================
// FOLDERS CRUD
// ============================================================================

export async function getFolders(): Promise<DraftFolder[]> {
	const data = await getData()
	return data.folders
}

export async function createFolder(folder: Omit<DraftFolder, 'id' | 'createdAt'>): Promise<DraftFolder> {
	const data = await getData()

	const newFolder: DraftFolder = {
		...folder,
		id: generateId(),
		createdAt: Date.now(),
	}

	data.folders.push(newFolder)
	await setData(data)

	return newFolder
}

export async function updateFolder(
	id: string,
	updates: Partial<Omit<DraftFolder, 'id' | 'createdAt'>>
): Promise<DraftFolder | null> {
	const data = await getData()

	const index = data.folders.findIndex(f => f.id === id)
	if (index === -1) return null

	data.folders[index] = {
		...data.folders[index],
		...updates,
	}

	await setData(data)
	return data.folders[index]
}

export async function deleteFolder(id: string): Promise<boolean> {
	const data = await getData()

	const index = data.folders.findIndex(f => f.id === id)
	if (index === -1) return false

	const deleted = data.folders.splice(index, 1)[0]

	// Unassign drafts from this folder (keeping original logic)
	let affectedDrafts = 0
	data.drafts.forEach(draft => {
		if (draft.folderId === id) {
			draft.folderId = undefined
			affectedDrafts++
		}
	})

	await setData(data)
	return true
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export async function getFoldersWithCounts(
	filterType?: 'draft' | 'template'
): Promise<(DraftFolder & { count: number })[]> {
	const data = await getData()

	// Filter folders by type (if specified). Folders without type are treated as 'draft'
	let filteredFolders = data.folders
	if (filterType) {
		filteredFolders = data.folders.filter(f => (f.type || 'draft') === filterType)
	}

	return filteredFolders.map(folder => ({
		...folder,
		count: data.drafts.filter(d => d.folderId === folder.id).length,
	}))
}

export async function getDraftsCountByFolder(): Promise<Record<string, number>> {
	const data = await getData()

	const counts: Record<string, number> = { _unassigned: 0 }

	data.folders.forEach(f => {
		counts[f.id] = 0
	})

	data.drafts.forEach(d => {
		if (d.folderId && counts[d.folderId] !== undefined) {
			counts[d.folderId]++
		} else {
			counts['_unassigned']++
		}
	})

	return counts
}

// The clearCache function is no longer needed because WXT manages its own cache,
// but we keep it empty in case it's called externally to avoid compilation errors.
export function clearCache(): void {
	// No-op: WXT Storage handles caching automatically
}

/**
 * Get all templates (drafts with type === 'template')
 * Shorthand for filtering getDrafts() by type
 */
export async function getTemplates(): Promise<Draft[]> {
	const data = await getData()
	return data.drafts.filter(d => d.type === 'template').sort((a, b) => b.updatedAt - a.updatedAt)
}

/**
 * Listen for storage changes
 * Note: Watch triggers on storage change, then fetches decompressed data
 */
export function onDraftsChanged(callback: (data: DraftsData) => void): () => void {
	return draftsStorage.watch(async () => {
		const data = await getData()
		callback(data)
	})
}
