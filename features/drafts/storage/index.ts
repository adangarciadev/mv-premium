/** Public draft API. All mutations share the background writer across tabs. */
import { sendMessage } from '@/lib/messaging'
import type * as repository from './repository'
import type { DraftMutation, DraftMutationMap } from './mutations'
import { storage } from '#imports'
import { logger } from '@/lib/logger'
import { STORAGE_KEYS } from '@/constants/storage-keys'
import type { Draft, DraftFolder, DraftsData } from './types'
export type { Draft, DraftFolder, DraftsData } from './types'
export const draftsStorage = storage.defineItem<DraftsData>(`local:${STORAGE_KEYS.DRAFTS}`, {
	defaultValue: { drafts: [], folders: [] },
})
const getData = (): Promise<DraftsData> => sendMessage('readDrafts', undefined)
function mutate<K extends keyof DraftMutationMap>(
	operation: K,
	args: Parameters<DraftMutationMap[K]>
): ReturnType<DraftMutationMap[K]> {
	// Chrome's JSON transport drops undefined object properties. Preserve explicit clears.
	const patch = args[1]
	const clearedFields = (operation === 'updateDraft' || operation === 'updateFolder') && patch && typeof patch === 'object'
		? Object.entries(patch).filter(([, value]) => value === undefined).map(([key]) => key)
		: undefined
	return sendMessage('mutateDrafts', { operation, args, clearedFields } as DraftMutation) as ReturnType<DraftMutationMap[K]>
}
export const createDraft: typeof repository.createDraft = (...args) => mutate('createDraft', args)
export const updateDraft: typeof repository.updateDraft = (...args) => mutate('updateDraft', args)
export const deleteDraft: typeof repository.deleteDraft = (...args) => mutate('deleteDraft', args)
export const deleteDrafts: typeof repository.deleteDrafts = (...args) => mutate('deleteDrafts', args)
export const duplicateDraft: typeof repository.duplicateDraft = (...args) => mutate('duplicateDraft', args)
export const convertDraftType: typeof repository.convertDraftType = (...args) => mutate('convertDraftType', args)
export const moveDraftToFolder: typeof repository.moveDraftToFolder = (...args) => mutate('moveDraftToFolder', args)
export const moveDraftsToFolder: typeof repository.moveDraftsToFolder = (...args) => mutate('moveDraftsToFolder', args)
export const createFolder: typeof repository.createFolder = (...args) => mutate('createFolder', args)
export const updateFolder: typeof repository.updateFolder = (...args) => mutate('updateFolder', args)
export const deleteFolder: typeof repository.deleteFolder = (...args) => mutate('deleteFolder', args)
export async function getDrafts(): Promise<Draft[]> {
	const data = await getData()
	return data.drafts.sort((a, b) => b.updatedAt - a.updatedAt)
}
export async function getDraft(id: string): Promise<Draft | null> {
	const data = await getData()
	return data.drafts.find(d => d.id === id) ?? null
}
export async function getFolders(): Promise<DraftFolder[]> {
	const data = await getData()
	return data.folders
}
export async function getFoldersWithCounts(filterType?: 'draft' | 'template'): Promise<(DraftFolder & {
	count: number
})[]> {
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
		}
		else {
			counts['_unassigned']++
		}
	})
	return counts
}
export function clearCache(): void {
	// No-op: WXT Storage handles caching automatically
}
export async function getTemplates(): Promise<Draft[]> {
	const data = await getData()
	return data.drafts.filter(d => d.type === 'template').sort((a, b) => b.updatedAt - a.updatedAt)
}
export function onDraftsChanged(callback: (data: DraftsData) => void): () => void {
	return draftsStorage.watch(async () => {
		try {
			callback(await getData())
		}
		catch {
			logger.error('No se pudieron actualizar los borradores; los datos originales se han conservado.')
		}
	})
}
