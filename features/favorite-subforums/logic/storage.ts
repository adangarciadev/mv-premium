/**
 * Favorite Subforums - Storage and utility functions
 *
 * Refactored to use @wxt-dev/storage (Unified API)
 */
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'
import { notifyFavoriteSubforumsChanged } from './listeners'
import { ALL_SUBFORUMS } from '@/lib/subforums'

// ============================================================================
// TYPES
// ============================================================================

export interface FavoriteSubforum {
	id: string // Unique identifier (slug from URL, e.g., "off-topic")
	name: string // Display name (e.g., "OFF-Topic")
	url: string // Full URL path (e.g., "/foro/off-topic")
	iconClass?: string // Forum icon CSS class (e.g., "fid fid-6")
	description?: string // Forum description
	addedAt: number // Timestamp when added to favorites
}

// ============================================================================
// STORAGE ITEM DEFINITION
// ============================================================================

// Define the storage item. WXT handles caching, reading, and writing automatically.
// ⚠️ Keep the same key to avoid losing existing user data.
export const favoriteSubforumsStorage = storage.defineItem<FavoriteSubforum[]>(
	`local:${STORAGE_KEYS.FAVORITE_SUBFORUMS}`,
	{
		defaultValue: [],
	}
)

// ============================================================================
// STORAGE FUNCTIONS
// ============================================================================

/**
 * Retrieves all favorite subforums from local storage.
 */
export async function getFavoriteSubforums(): Promise<FavoriteSubforum[]> {
	return await favoriteSubforumsStorage.getValue()
}

/**
 * Persists the list of favorite subforums to storage.
 */
export async function saveFavoriteSubforums(subforums: FavoriteSubforum[]): Promise<void> {
	await favoriteSubforumsStorage.setValue(subforums)
}

/**
 * Adds a subforum to the favorites list
 * @param subforum - Subforum details (excluding addedAt timestamp)
 * @returns Updated list of favorite subforums
 */
export async function addFavoriteSubforum(subforum: Omit<FavoriteSubforum, 'addedAt'>): Promise<FavoriteSubforum[]> {
	const subforums = await getFavoriteSubforums()

	// Check if already exists
	if (subforums.some(s => s.id === subforum.id)) {
		return subforums
	}

	const newSubforum: FavoriteSubforum = {
		...subforum,
		addedAt: Date.now(),
	}

	const updated = [...subforums, newSubforum]
	await saveFavoriteSubforums(updated)

	// Notify other components via centralized listener system
	notifyFavoriteSubforumsChanged()

	return updated
}

/**
 * Removes a subforum from the favorites list
 * @param subforumId - The slug ID of the subforum to remove
 * @returns Updated list of favorite subforums
 */
export async function removeFavoriteSubforum(subforumId: string): Promise<FavoriteSubforum[]> {
	const subforums = await getFavoriteSubforums()
	const updated = subforums.filter(s => s.id !== subforumId)
	await saveFavoriteSubforums(updated)

	// Notify other components via centralized listener system
	notifyFavoriteSubforumsChanged()

	return updated
}

/**
 * Checks if a subforum is currently in the favorites list
 * @param subforumId - The slug ID of the subforum
 */
export async function isSubforumFavorite(subforumId: string): Promise<boolean> {
	const subforums = await getFavoriteSubforums()
	return subforums.some(s => s.id === subforumId)
}

/**
 * Toggles a subforum's favorite status (adds if missing, removes if present)
 * @param subforum - Subforum details
 * @returns Object containing the new status and the full updated list
 */
export async function toggleFavoriteSubforum(
	subforum: Omit<FavoriteSubforum, 'addedAt'>
): Promise<{ isFavorite: boolean; subforums: FavoriteSubforum[] }> {
	const isFavorite = await isSubforumFavorite(subforum.id)

	if (isFavorite) {
		const subforums = await removeFavoriteSubforum(subforum.id)
		return { isFavorite: false, subforums }
	} else {
		const subforums = await addFavoriteSubforum(subforum)
		return { isFavorite: true, subforums }
	}
}

/**
 * Subscribes to changes in the favorite subforums collection.
 * @param callback - Function to run when favorites change
 * @returns An unsubscribe function
 */
export function watchFavoriteSubforums(callback: (subforums: FavoriteSubforum[]) => void): () => void {
	return favoriteSubforumsStorage.watch(newSubforums => {
		if (newSubforums) {
			callback(newSubforums)
		}
	})
}

// ============================================================================
// UTILITY FUNCTIONS (DOM extraction - not storage related)
// ============================================================================

/**
 * Detects and extracts subforum metadata from a forum list anchor element.
 * @param linkElement - The HTMLAnchorElement to scrape
 * @returns Metadata object or null if invalid
 */
export function extractSubforumInfo(linkElement: HTMLAnchorElement): Omit<FavoriteSubforum, 'addedAt'> | null {
	const href = linkElement.getAttribute('href')
	if (!href || !href.startsWith('/foro/')) return null

	// Extract ID from URL (e.g., "/foro/off-topic" -> "off-topic")
	const pathParts = href.split('/').filter(Boolean)
	if (pathParts.length < 2) return null

	const id = pathParts[1] // "off-topic", "cine", etc.

	// Get name from strong element
	const nameEl = linkElement.querySelector('.info-col strong')
	const name = nameEl?.textContent?.trim() || id

	// Get description
	const descEl = linkElement.querySelector('.info-col .ddkb')
	const description = descEl?.textContent?.trim()

	// Get icon class
	const iconEl = linkElement.querySelector('.icon-col i')
	const iconClass = iconEl?.className

	return {
		id,
		name,
		url: href,
		iconClass,
		description,
	}
}

/**
 * Extracts subforum metadata from the current page's header.
 * Used when the user is directly viewing a subforum's thread list.
 * @returns Metadata object or null if not on a subforum page
 */
export function extractSubforumInfoFromPage(): Omit<FavoriteSubforum, 'addedAt'> | null {
	const path = window.location.pathname

	// Must be a forum page (/foro/xxx) but not a thread (/foro/xxx/thread-title-123)
	const match = path.match(/^\/foro\/([^/]+)\/?$/)
	if (!match) return null

	const id = match[1]

	// First, try to get the canonical name from our constants (ensures proper capitalization)
	const subforumConstant = ALL_SUBFORUMS.find(s => s.slug === id)

	// Fallback: Get forum name from breadcrumb or page title, then slug
	const breadcrumb = document.querySelector('.breadcrumb a:last-of-type')
	const pageTitle = document.querySelector('#main h2')
	const name = subforumConstant?.name || breadcrumb?.textContent?.trim() || pageTitle?.textContent?.trim() || id

	// Get icon from forum sidebar or navigation
	const iconEl = document.querySelector('.c-side .b-side h3 i.fid, .c-main h2 + .forums .fid')
	const iconClass = iconEl?.className

	return {
		id,
		name,
		url: path,
		iconClass,
	}
}
