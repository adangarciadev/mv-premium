import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'
import type { ThreadClipperBasket, ThreadClipperBasketItem } from './types'
import { THREAD_CLIPPER_DRAFT_VERSION } from './types'

export const THREAD_CLIPPER_BASKET_KEY = `local:${STORAGE_KEYS.THREAD_CLIPPER_BASKET}` as const

function isValidBasketItem(value: unknown): value is ThreadClipperBasketItem {
	if (!value || typeof value !== 'object') return false
	const item = value as { type?: unknown; value?: unknown; label?: unknown }
	if (item.type === 'text') return typeof item.value === 'string'
	if (item.type === 'media') return typeof item.value === 'string'
	if (item.type === 'link') return typeof item.value === 'string' && typeof item.label === 'string'
	return false
}

export function isValidThreadClipperBasket(value: unknown): value is ThreadClipperBasket {
	if (!value || typeof value !== 'object') return false
	const basket = value as Partial<ThreadClipperBasket>
	return (
		typeof basket.sessionId === 'string' &&
		typeof basket.tabId === 'number' &&
		typeof basket.sourceUrl === 'string' &&
		typeof basket.sourceTitle === 'string' &&
		(basket.pending === undefined || (
			basket.pending !== null &&
			typeof basket.pending.title === 'string' &&
			typeof basket.pending.body === 'string' &&
			typeof basket.pending.subforum === 'string' &&
			basket.pending.sourceUrl === basket.sourceUrl
		)) &&
		(basket.version === undefined || basket.version === THREAD_CLIPPER_DRAFT_VERSION) &&
		typeof basket.createdAt === 'number' &&
		typeof basket.updatedAt === 'number' &&
		(basket.contentMode === undefined || basket.contentMode === 'article' || basket.contentMode === 'media-only') &&
		(basket.textFormat === undefined || basket.textFormat === 'quote' || basket.textFormat === 'plain') &&
		(basket.template === undefined ||
			basket.template === 'news' ||
			basket.template === 'article' ||
			basket.template === 'video' ||
			basket.template === 'review' ||
			basket.template === 'deal' ||
			basket.template === 'rumor') &&
		Array.isArray(basket.items) &&
		basket.items.every(isValidBasketItem)
	)
}

/** The previous format stored a single basket under the same key. */
export async function readThreadClipperBaskets(): Promise<ThreadClipperBasket[]> {
	const stored = await storage.getItem<unknown>(THREAD_CLIPPER_BASKET_KEY)
	const entries = Array.isArray(stored) ? stored : [stored]
	return entries.filter(isValidThreadClipperBasket)
}

// Mutations run on the background clipper queue.
export async function saveThreadClipperBasket(basket: ThreadClipperBasket): Promise<void> {
	const others = (await readThreadClipperBaskets()).filter(entry => entry.sessionId !== basket.sessionId)
	await storage.setItem(THREAD_CLIPPER_BASKET_KEY, [...others, basket])
}

export async function clearThreadClipperBasket(sessionId: string): Promise<void> {
	const remaining = (await readThreadClipperBaskets()).filter(entry => entry.sessionId !== sessionId)
	if (remaining.length) await storage.setItem(THREAD_CLIPPER_BASKET_KEY, remaining)
	else await storage.removeItem(THREAD_CLIPPER_BASKET_KEY)
}

export function createThreadClipperSessionId(): string {
	return crypto.randomUUID()
}
