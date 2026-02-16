import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'
import { normalizeThreadPath, parseHiddenThreadFromUrl, type HiddenThreadMetadata } from './thread-utils'

const HIDDEN_THREADS_KEY = `local:${STORAGE_KEYS.HIDDEN_THREADS}` as const

export interface HiddenThread extends HiddenThreadMetadata {
	hiddenAt: number
}

const hiddenThreadsStorage = storage.defineItem<HiddenThread[]>(HIDDEN_THREADS_KEY, {
	defaultValue: [],
})

export async function getHiddenThreads(): Promise<HiddenThread[]> {
	return await hiddenThreadsStorage.getValue()
}

export async function saveHiddenThreads(threads: HiddenThread[]): Promise<void> {
	await hiddenThreadsStorage.setValue(threads)
}

export async function isThreadHidden(threadOrUrl: string): Promise<boolean> {
	const normalized = normalizeThreadPath(threadOrUrl) || threadOrUrl
	if (!normalized) return false

	const threads = await getHiddenThreads()
	return threads.some(thread => thread.id === normalized)
}

export async function hideThread(thread: HiddenThreadMetadata): Promise<HiddenThread> {
	const threads = await getHiddenThreads()
	const index = threads.findIndex(item => item.id === thread.id)

	if (index >= 0) {
		const updatedThread: HiddenThread = {
			...threads[index],
			...thread,
			hiddenAt: Date.now(),
		}
		threads[index] = updatedThread
		threads.sort((a, b) => b.hiddenAt - a.hiddenAt)
		await saveHiddenThreads(threads)
		return updatedThread
	}

	const newThread: HiddenThread = {
		...thread,
		hiddenAt: Date.now(),
	}

	const updated = [...threads, newThread].sort((a, b) => b.hiddenAt - a.hiddenAt)
	await saveHiddenThreads(updated)
	return newThread
}

export async function hideThreadFromUrl(url: string): Promise<HiddenThread | null> {
	const parsed = parseHiddenThreadFromUrl(url)
	if (!parsed) return null

	return await hideThread(parsed)
}

export async function unhideThread(threadIdOrUrl: string): Promise<void> {
	const normalized = normalizeThreadPath(threadIdOrUrl) || threadIdOrUrl
	if (!normalized) return

	const threads = await getHiddenThreads()
	const filtered = threads.filter(thread => thread.id !== normalized)
	await saveHiddenThreads(filtered)
}

export async function unhideThreads(threadIdsOrUrls: string[]): Promise<void> {
	if (threadIdsOrUrls.length === 0) return

	const normalizedIds = new Set(
		threadIdsOrUrls
			.map(id => normalizeThreadPath(id) || id)
			.filter((id): id is string => Boolean(id))
	)

	const threads = await getHiddenThreads()
	const filtered = threads.filter(thread => !normalizedIds.has(thread.id))
	await saveHiddenThreads(filtered)
}

export async function clearHiddenThreads(): Promise<void> {
	await hiddenThreadsStorage.setValue([])
}

export function watchHiddenThreads(callback: (threads: HiddenThread[]) => void): () => void {
	return hiddenThreadsStorage.watch(newValue => {
		callback(newValue || [])
	})
}
