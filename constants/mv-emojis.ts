/**
 * Mediavida Emoji Types and Loader
 *
 * The emoji data is now loaded dynamically from an optimized JSON file
 * to reduce the initial bundle size by ~100KB.
 *
 * JSON Format (optimized):
 * {
 *   categories: [{ name, icon, items: [":code1:", ":code2:"] }],
 *   emojis: { ":code:": "shortPath" }
 * }
 */

import { browser } from 'wxt/browser'
import { logger } from '@/lib/logger'

// =============================================================================
// TYPES
// =============================================================================

/** Emoji with code and full URL (public interface) */
export interface MvEmoji {
	code: string
	url: string
}

/** Category with name, icon, and emoji items */
export interface MvEmojiCategory {
	category: string
	icon: string
	items: MvEmoji[]
}

/** Optimized JSON format from file */
interface OptimizedEmojiData {
	categories: Array<{
		name: string
		icon: string
		items: string[] // Array of codes like [":psyduck:", ":shutup:"]
	}>
	emojis: Record<string, string> // { ":code:": "shortPath" }
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MEDIAVIDA_BASE_URL = 'https://www.mediavida.com'
const EMOJI_BASE_PATH = '/img/emoji/'

// Cache for loaded emojis
let loadingPromise: Promise<MvEmojiCategory[]> | null = null
let emojisCache: MvEmojiCategory[] | null = null

// Fast lookup map: code -> full url
let emojiUrlMap: Record<string, string> | null = null

// =============================================================================
// LOADER
// =============================================================================

/**
 * Load emojis dynamically from optimized JSON file.
 * Results are cached after first load.
 * Converts optimized format to public interface format.
 */
export function loadEmojis(): Promise<MvEmojiCategory[]> {
	// 1. If we already have the data, return it directly (faster)
	if (emojisCache) return Promise.resolve(emojisCache)

	// 2. If there's already a load in progress, return that same promise (avoids double fetch)
	if (loadingPromise) return loadingPromise

	// 3. Start the load
	const url = browser.runtime.getURL('data/mv-emojis.json' as never)

	loadingPromise = fetch(url)
		.then(async response => {
			if (!response.ok) throw new Error('Network response was not ok')
			const data: OptimizedEmojiData = await response.json()

			// Build emoji URL map for fast lookups
			emojiUrlMap = {}
			for (const [code, shortPath] of Object.entries(data.emojis)) {
				emojiUrlMap[code] = EMOJI_BASE_PATH + shortPath
			}

			// Convert optimized format to public interface format
			emojisCache = data.categories.map(cat => ({
				category: cat.name,
				icon: cat.icon,
				items: cat.items.map(code => ({
					code,
					url: emojiUrlMap![code] || EMOJI_BASE_PATH + data.emojis[code],
				})),
			}))

			return emojisCache
		})
		.catch(error => {
			logger.error('Failed to load emojis:', error)
			loadingPromise = null // Allow retry if failed
			return [] // Return empty array to not break the UI
		})

	return loadingPromise
}

/**
 * Get the full URL for an emoji path
 */
export function getEmojiUrl(path: string): string {
	return MEDIAVIDA_BASE_URL + path
}

/**
 * Get emoji URL by code (fast lookup from cache)
 * Returns null if emojis haven't been loaded yet
 */
export function getEmojiUrlByCode(code: string): string | null {
	if (!emojiUrlMap) return null
	const path = emojiUrlMap[code]
	return path ? MEDIAVIDA_BASE_URL + path : null
}
