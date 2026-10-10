/**
 * Drafts Storage - Persistencia de borradores y carpetas
 * Refactorizado para usar @wxt-dev/storage (API unificada)
 *
 * Uses lz-string compression to reduce storage footprint.
 */
import { storage } from '#imports'
import { generateId } from '@/lib/id-generator'
import { STORAGE_KEYS } from '@/constants'
import { getCompressed, setCompressed } from '@/lib/storage/compressed-storage'

// ============================================================================
// TYPES
// ============================================================================

import type { Draft, DraftFolder, DraftsData } from './types'
import { draftsDataSchema } from './schema'

// ============================================================================
// STORAGE KEY
// ============================================================================
const DRAFTS_KEY = `local:${STORAGE_KEYS.DRAFTS}` as const

// ============================================================================
// INTERNAL HELPERS (using compressed storage)
// ============================================================================

export async function readDraftsData(): Promise<DraftsData> {
	const raw = await storage.getItem<unknown>(DRAFTS_KEY)
	const data = await getCompressed<DraftsData>(DRAFTS_KEY)
	if (raw !== null && data === null) throw new Error('No se pudieron leer los borradores. Los datos originales se han conservado.')
	return draftsDataSchema.parse(data ?? { drafts: [], folders: [] })
}

async function setData(data: DraftsData): Promise<void> {
	await setCompressed(DRAFTS_KEY, draftsDataSchema.parse(data))
}

// ============================================================================
// DRAFTS CRUD
// ============================================================================

export async function createDraft(draft: Omit<Draft, 'id' | 'createdAt' | 'updatedAt'>): Promise<Draft> {
	const data = await readDraftsData()

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
	const data = await readDraftsData()

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
	const data = await readDraftsData()

	const index = data.drafts.findIndex(d => d.id === id)
	if (index === -1) return false

	data.drafts.splice(index, 1)
	await setData(data)

	return true
}

export async function deleteDrafts(ids: string[]): Promise<number> {
	if (ids.length === 0) return 0

	const data = await readDraftsData()
	const idSet = new Set(ids)
	const beforeCount = data.drafts.length

	data.drafts = data.drafts.filter(draft => !idSet.has(draft.id))
	await setData(data)

	return beforeCount - data.drafts.length
}

export async function duplicateDraft(id: string): Promise<Draft | null> {
	const data = await readDraftsData()

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
	const data = await readDraftsData()

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

	return draft
}

export async function moveDraftToFolder(draftId: string, folderId: string | undefined): Promise<boolean> {
	const data = await readDraftsData()

	const draft = data.drafts.find(d => d.id === draftId)
	if (!draft) return false

	draft.folderId = folderId
	draft.updatedAt = Date.now()

	await setData(data)
	return true
}

export async function moveDraftsToFolder(draftIds: string[], folderId: string | undefined): Promise<number> {
	if (draftIds.length === 0) return 0

	const data = await readDraftsData()
	const idSet = new Set(draftIds)
	const now = Date.now()
	let moved = 0

	for (const draft of data.drafts) {
		if (idSet.has(draft.id)) {
			draft.folderId = folderId
			draft.updatedAt = now
			moved++
		}
	}

	if (moved > 0) {
		await setData(data)
	}

	return moved
}

// ============================================================================
// FOLDERS CRUD
// ============================================================================

export async function createFolder(folder: Omit<DraftFolder, 'id' | 'createdAt'>): Promise<DraftFolder> {
	const data = await readDraftsData()

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
	const data = await readDraftsData()

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
	const data = await readDraftsData()

	const index = data.folders.findIndex(f => f.id === id)
	if (index === -1) return false

	data.folders.splice(index, 1)

	// Unassign drafts from this folder (keeping original logic)
	data.drafts.forEach(draft => {
		if (draft.folderId === id) {
			draft.folderId = undefined
		}
	})

	await setData(data)
	return true
}
