import { storage } from '@wxt-dev/storage'
import { STORAGE_KEYS } from '@/constants'

const MAX_RECENT_FORUMS = 20

const recentForumsStorage = storage.defineItem<string[]>(`local:${STORAGE_KEYS.HOMEPAGE_RECENT_FORUMS}`, {
	defaultValue: [],
})

export async function getLatestVisitedForums(): Promise<string[]> {
	try {
		const value = await recentForumsStorage.getValue()
		if (!Array.isArray(value)) return []
		return value.filter((forum): forum is string => typeof forum === 'string')
	} catch {
		return []
	}
}

export async function setLatestVisitedForum(forumSlug: string): Promise<void> {
	if (!forumSlug) return

	try {
		const current = await getLatestVisitedForums()
		const updated = [forumSlug, ...current.filter(forum => forum !== forumSlug)]
		await recentForumsStorage.setValue(updated.slice(0, MAX_RECENT_FORUMS))
	} catch {
		// Ignore storage errors (quota/unavailable)
	}
}
