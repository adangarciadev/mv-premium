/**
 * Post Font Size Module
 * Applies custom font size to post content areas via CSS variable on :root
 *
 * Uses the same proven pattern as init-bold-color.ts:
 * - Sets CSS variable on document.documentElement.style
 * - Toggles a data attribute on <html> to activate conditional CSS rules in app.css
 * - Watches storage changes for live updates without page refresh
 * - Keeps localStorage cache in sync for the early script (post-font-size-early.content.ts)
 */
import { browser, type Browser } from 'wxt/browser'
import { RUNTIME_CACHE_KEYS, STORAGE_KEYS } from '@/constants'
import { postFontSizeStorage } from '@/lib/theme/storage'

const DEFAULT_SIZE = 100
const DATA_ATTR = 'data-mvp-font-scaled'
const CSS_VAR = '--mvp-post-font-size'
const CACHE_KEY = RUNTIME_CACHE_KEYS.POST_FONT_SIZE

/**
 * Updates the localStorage cache for instant access on next page load.
 */
function updateCache(size: number): void {
	try {
		if (size === DEFAULT_SIZE) {
			localStorage.removeItem(CACHE_KEY)
		} else {
			localStorage.setItem(CACHE_KEY, String(size))
		}
	} catch {
		// localStorage might be disabled
	}
}

/**
 * Apply or remove the font-size scaling on the document root.
 */
function setFontSizeOnRoot(size: number): void {
	if (size === DEFAULT_SIZE) {
		document.documentElement.removeAttribute(DATA_ATTR)
		document.documentElement.style.removeProperty(CSS_VAR)
		return
	}

	document.documentElement.setAttribute(DATA_ATTR, '')
	document.documentElement.style.setProperty(CSS_VAR, `${size}%`)
}

/**
 * Apply post font size from storage on initial load.
 */
export async function applyPostFontSize(): Promise<void> {
	try {
		const size = await postFontSizeStorage.getValue()
		const resolved = size ?? DEFAULT_SIZE
		setFontSizeOnRoot(resolved)
		updateCache(resolved)
	} catch {
		// Ignore if storage is unavailable
	}
}

/**
 * Watch for post font size changes and apply instantly.
 * Uses native browser.storage.onChanged for cross-context support.
 */
export function watchPostFontSize(): void {
	const listener = (changes: Record<string, Browser.storage.StorageChange>, areaName: string) => {
		if (areaName !== 'local') return
		if (!changes[STORAGE_KEYS.POST_FONT_SIZE]) return

		const newSize = (changes[STORAGE_KEYS.POST_FONT_SIZE].newValue as number) ?? DEFAULT_SIZE
		setFontSizeOnRoot(newSize)
		updateCache(newSize)
	}

	browser.storage.onChanged.addListener(listener)
}
