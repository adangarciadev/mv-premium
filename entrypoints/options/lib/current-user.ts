/**
 * Current User Storage
 * Detects and stores the current Mediavida user's info
 *
 * Uses WXT unified storage API
 */
import { storage } from '#imports'
import { MV_SELECTORS, STORAGE_KEYS } from '@/constants'

export interface CurrentUser {
	username: string
	avatarUrl?: string
	detectedAt: number
}

// Define typed storage item
const currentUserStorage = storage.defineItem<CurrentUser | null>(`local:${STORAGE_KEYS.CURRENT_USER}`, {
	defaultValue: null,
})

const USER_PROFILE_PATH_PREFIX = '/id/'
const USER_AVATAR_PATH = '/img/users/avatar/'

function getUserProfileNameFromHref(href: string): string {
	try {
		const url = new URL(href, window.location.origin)
		if (!url.pathname.startsWith(USER_PROFILE_PATH_PREFIX)) return ''
		return decodeURIComponent(url.pathname.slice(USER_PROFILE_PATH_PREFIX.length).split('/')[0] || '').trim()
	} catch {
		return ''
	}
}

function isCurrentUserProfileLink(link: HTMLAnchorElement, username: string): boolean {
	return getUserProfileNameFromHref(link.href).toLowerCase() === username.toLowerCase()
}

function getAvatarScore(img: HTMLImageElement): number {
	const rect = img.getBoundingClientRect()
	const width = Math.max(img.naturalWidth, img.width, rect.width)
	const height = Math.max(img.naturalHeight, img.height, rect.height)
	return width * height
}

function getAvatarUrl(img: HTMLImageElement): string {
	return img.currentSrc || img.src
}

/**
 * Mediavida serves the same avatar at several sizes: "<base>.png" is the 32x32 used in the navbar,
 * "<base>_full.png" is the profile-sized one. Deriving it means the quality no longer depends on
 * which page happened to be open when the user was detected.
 *
 * Returns null when the URL is not a Mediavida avatar or is already the full-size variant.
 */
export function getLargeAvatarUrl(avatarUrl: string): string | null {
	const match = /^(.*\/img\/users\/avatar\/.+?)(_big|_full)?(\.[a-z0-9]+)$/i.exec(avatarUrl)
	if (!match) return null

	const large = `${match[1]}_full${match[3]}`
	return large === avatarUrl ? null : large
}

/** Not every avatar has a full-size variant, so the derived URL is probed before it is stored. */
function imageExists(url: string): Promise<boolean> {
	return new Promise(resolve => {
		const image = new Image()
		image.onload = () => resolve(image.naturalWidth > 0)
		image.onerror = () => resolve(false)
		image.src = url
	})
}

function findBestAvatarFromLinks(username: string): HTMLImageElement | null {
	const candidates: HTMLImageElement[] = []
	const profileLinks = document.querySelectorAll<HTMLAnchorElement>('a[href*="/id/"]')

	for (const link of profileLinks) {
		if (!isCurrentUserProfileLink(link, username)) continue

		const linkedImage = link.querySelector<HTMLImageElement>(`img[src*="${USER_AVATAR_PATH}"]`)
		if (linkedImage) candidates.push(linkedImage)

		const postAvatar = link.closest(MV_SELECTORS.THREAD.POST_AVATAR)
		const postImage = postAvatar?.querySelector<HTMLImageElement>(`img[src*="${USER_AVATAR_PATH}"]`)
		if (postImage) candidates.push(postImage)
	}

	return candidates.sort((a, b) => getAvatarScore(b) - getAvatarScore(a))[0] ?? null
}

function findBestAvatarFromOwnProfile(username: string): HTMLImageElement | null {
	if (getUserProfileNameFromHref(window.location.href).toLowerCase() !== username.toLowerCase()) return null

	const candidates = Array.from(document.querySelectorAll<HTMLImageElement>(`img[src*="${USER_AVATAR_PATH}"]`)).filter(
		img => !img.closest('#user-data')
	)

	return candidates.sort((a, b) => getAvatarScore(b) - getAvatarScore(a))[0] ?? null
}

function findBestCurrentUserAvatar(username: string, fallbackAvatar?: HTMLImageElement | null): string | undefined {
	const profileAvatar = findBestAvatarFromOwnProfile(username)
	if (profileAvatar) return getAvatarUrl(profileAvatar)

	const linkedAvatar = findBestAvatarFromLinks(username)
	if (linkedAvatar) return getAvatarUrl(linkedAvatar)

	return fallbackAvatar ? getAvatarUrl(fallbackAvatar) : undefined
}

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
			avatarUrl: findBestCurrentUserAvatar(username, avatarImg),
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
	if (!user) return

	// This runs on every Mediavida page and overwrites what is stored, so without upgrading here the
	// navbar's 32x32 avatar would replace the good one as soon as the user left their own profile.
	const large = user.avatarUrl ? getLargeAvatarUrl(user.avatarUrl) : null
	if (large) {
		const stored = await getCurrentUser()
		// Already resolved for this avatar: no need to probe the network again on every page load.
		if (stored?.avatarUrl === large || (await imageExists(large))) user.avatarUrl = large
	}

	await saveCurrentUser(user)
}
