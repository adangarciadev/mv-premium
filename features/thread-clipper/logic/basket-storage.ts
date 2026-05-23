import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'
import { logger } from '@/lib/logger'
import type { ThreadClipperBasket, ThreadClipperBasketItem } from './types'
import { THREAD_CLIPPER_DRAFT_VERSION } from './types'

export const THREAD_CLIPPER_BASKET_KEY = `local:${STORAGE_KEYS.THREAD_CLIPPER_BASKET}` as const
const MAX_BASKET_AGE_MS = 60 * 60 * 1000

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

export async function readThreadClipperBasket(): Promise<ThreadClipperBasket | null> {
	try {
		const basket = await storage.getItem<ThreadClipperBasket>(THREAD_CLIPPER_BASKET_KEY)
		if (!isValidThreadClipperBasket(basket)) return null
		if (Date.now() - basket.updatedAt > MAX_BASKET_AGE_MS) {
			await clearThreadClipperBasket()
			return null
		}
		if (!basket.version || !basket.template || !basket.textFormat) {
			const migratedBasket: ThreadClipperBasket = {
				...basket,
				version: THREAD_CLIPPER_DRAFT_VERSION,
				template: basket.template ?? 'news',
				textFormat: basket.textFormat ?? 'quote',
			}
			await saveThreadClipperBasket(migratedBasket)
			return migratedBasket
		}
		return basket
	} catch (error) {
		logger.warn('Thread clipper: could not read clip basket', error)
		return null
	}
}

export async function saveThreadClipperBasket(basket: ThreadClipperBasket): Promise<void> {
	await storage.setItem(THREAD_CLIPPER_BASKET_KEY, basket)
}

export async function clearThreadClipperBasket(): Promise<void> {
	await storage.removeItem(THREAD_CLIPPER_BASKET_KEY)
}

export function createThreadClipperSessionId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
