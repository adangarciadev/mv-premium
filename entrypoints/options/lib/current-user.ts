/**
 * Current User Storage
 * Detects and stores the current Mediavida user's info
 *
 * Uses WXT unified storage API
 */
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'

export interface CurrentUser {
	username: string
	avatarUrl?: string
	detectedAt: number
}

// Define typed storage item
const currentUserStorage = storage.defineItem<CurrentUser | null>(`local:${STORAGE_KEYS.CURRENT_USER}`, {
	defaultValue: null,
})

/**
 * Detect the current user from Mediavida page
 * Selector: #user-data contains avatar img and username span
 */
export function detectCurrentUser(): CurrentUser | null {
	try {
		// User data is in: <a id="user-data" href="/id/USERNAME"><img src="..."><span>USERNAME</span></a>
		const userDataLink = document.querySelector<HTMLAnchorElement>('#user-data')
		if (!userDataLink) return null

		const usernameSpan = userDataLink.querySelector('span')
		const avatarImg = userDataLink.querySelector<HTMLImageElement>('img')

		const username = usernameSpan?.textContent?.trim()
		if (!username) return null

		return {
			username,
			avatarUrl: avatarImg?.src,
			detectedAt: Date.now(),
		}
	} catch {
		return null
	}
}

/**
 * Save current user to storage
 */
export async function saveCurrentUser(user: CurrentUser): Promise<void> {
	await currentUserStorage.setValue(user)
}

/**
 * Get current user from storage
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
	return await currentUserStorage.getValue()
}

/**
 * Detect user from page and save to storage
 * Call this from content script on page load
 */
export async function detectAndSaveCurrentUser(): Promise<void> {
	const user = detectCurrentUser()
	if (user) {
		await saveCurrentUser(user)
	}
}
