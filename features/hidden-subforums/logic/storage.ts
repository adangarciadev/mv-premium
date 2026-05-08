import { storage } from '#imports'
import { RUNTIME_CACHE_KEYS, STORAGE_KEYS } from '@/constants'
import type { HiddenSubforum } from '@/types/storage'
import { notifyHiddenSubforumsChanged } from './listeners'
import { getFavoriteSubforums } from '@/features/favorite-subforums/logic/storage'

export type { HiddenSubforum } from '@/types/storage'

export const HIDDEN_SUBFORUM_ERROR_CODES = {
	FAVORITE_CONFLICT: 'favorite-conflict',
} as const

export const hiddenSubforumsStorage = storage.defineItem<HiddenSubforum[]>(`local:${STORAGE_KEYS.HIDDEN_SUBFORUMS}`, {
	defaultValue: [],
})

function updateHiddenSubforumsCache(subforums: HiddenSubforum[]): void {
	try {
		if (subforums.length === 0) {
			localStorage.removeItem(RUNTIME_CACHE_KEYS.HIDDEN_SUBFORUMS)
			return
		}

		const slugs = Array.from(new Set(subforums.map(subforum => subforum.id))).sort((a, b) => a.localeCompare(b))
		localStorage.setItem(RUNTIME_CACHE_KEYS.HIDDEN_SUBFORUMS, JSON.stringify(slugs))
	} catch {
		// localStorage may be unavailable in restricted contexts.
	}
}

async function assertSubforumCanBeHidden(subforumId: string): Promise<void> {
	const favorites = await getFavoriteSubforums()
	if (favorites.some(subforum => subforum.id === subforumId)) {
		throw new Error(HIDDEN_SUBFORUM_ERROR_CODES.FAVORITE_CONFLICT)
	}
}

export async function getHiddenSubforums(): Promise<HiddenSubforum[]> {
	const subforums = await hiddenSubforumsStorage.getValue()
	updateHiddenSubforumsCache(subforums)
	return subforums
}

export async function saveHiddenSubforums(subforums: HiddenSubforum[]): Promise<void> {
	await hiddenSubforumsStorage.setValue(subforums)
	updateHiddenSubforumsCache(subforums)
}

export async function isSubforumHidden(subforumId: string): Promise<boolean> {
	const subforums = await getHiddenSubforums()
	return subforums.some(subforum => subforum.id === subforumId)
}

export async function hideSubforum(subforum: Omit<HiddenSubforum, 'hiddenAt'>): Promise<HiddenSubforum[]> {
	await assertSubforumCanBeHidden(subforum.id)

	const subforums = await getHiddenSubforums()
	const existingIndex = subforums.findIndex(item => item.id === subforum.id)

	if (existingIndex >= 0) {
		subforums[existingIndex] = {
			...subforums[existingIndex],
			...subforum,
			hiddenAt: Date.now(),
		}

		const updated = [...subforums].sort((a, b) => b.hiddenAt - a.hiddenAt)
		await saveHiddenSubforums(updated)
		notifyHiddenSubforumsChanged()
		return updated
	}

	const updated = [
		...subforums,
		{
			...subforum,
			hiddenAt: Date.now(),
		},
	].sort((a, b) => b.hiddenAt - a.hiddenAt)

	await saveHiddenSubforums(updated)
	notifyHiddenSubforumsChanged()
	return updated
}

export async function unhideSubforum(subforumId: string): Promise<HiddenSubforum[]> {
	const subforums = await getHiddenSubforums()
	const updated = subforums.filter(subforum => subforum.id !== subforumId)
	await saveHiddenSubforums(updated)
	notifyHiddenSubforumsChanged()
	return updated
}

export async function unhideSubforums(subforumIds: string[]): Promise<HiddenSubforum[]> {
	if (subforumIds.length === 0) return await getHiddenSubforums()

	const ids = new Set(subforumIds)
	const subforums = await getHiddenSubforums()
	const updated = subforums.filter(subforum => !ids.has(subforum.id))
	await saveHiddenSubforums(updated)
	notifyHiddenSubforumsChanged()
	return updated
}

export async function clearHiddenSubforums(): Promise<void> {
	await saveHiddenSubforums([])
	notifyHiddenSubforumsChanged()
}

export async function toggleHiddenSubforum(
	subforum: Omit<HiddenSubforum, 'hiddenAt'>
): Promise<{ isHidden: boolean; subforums: HiddenSubforum[] }> {
	const hidden = await isSubforumHidden(subforum.id)

	if (hidden) {
		const subforums = await unhideSubforum(subforum.id)
		return { isHidden: false, subforums }
	}

	const subforums = await hideSubforum(subforum)
	return { isHidden: true, subforums }
}

export function watchHiddenSubforums(callback: (subforums: HiddenSubforum[]) => void): () => void {
	return hiddenSubforumsStorage.watch(newValue => {
		callback(newValue || [])
	})
}
