import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'
import type { ThreadClipperHistoryEntry } from './types'

const HISTORY_KEY = `local:${STORAGE_KEYS.THREAD_CLIPPER_HISTORY}` as const
const MAX_HISTORY_ENTRIES = 20

function isValidHistoryEntry(value: unknown): value is ThreadClipperHistoryEntry {
	if (!value || typeof value !== 'object') return false
	const entry = value as Partial<ThreadClipperHistoryEntry>
	return (
		typeof entry.id === 'string' &&
		typeof entry.title === 'string' &&
		typeof entry.sourceUrl === 'string' &&
		typeof entry.sourceTitle === 'string' &&
		typeof entry.subforum === 'string' &&
		typeof entry.template === 'string' &&
		typeof entry.body === 'string' &&
		typeof entry.createdAt === 'number'
	)
}

export async function getThreadClipperHistory(): Promise<ThreadClipperHistoryEntry[]> {
	const history = await storage.getItem<unknown>(HISTORY_KEY)
	if (!Array.isArray(history)) return []
	return history.filter(isValidHistoryEntry).slice(0, MAX_HISTORY_ENTRIES)
}

export async function addThreadClipperHistoryEntry(
	entry: Omit<ThreadClipperHistoryEntry, 'id' | 'createdAt'>
): Promise<void> {
	const history = await getThreadClipperHistory()
	const nextEntry: ThreadClipperHistoryEntry = {
		...entry,
		id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		createdAt: Date.now(),
	}
	const nextHistory = [nextEntry, ...history.filter(item => item.sourceUrl !== entry.sourceUrl)].slice(
		0,
		MAX_HISTORY_ENTRIES
	)
	await storage.setItem(HISTORY_KEY, nextHistory)
}

export async function clearThreadClipperHistory(): Promise<void> {
	await storage.removeItem(HISTORY_KEY)
}

