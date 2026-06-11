/**
 * Avatar URL sanitization for Mobile Lite.
 *
 * Mediavida lazy-loads avatars: until an image scrolls into view its `src`
 * points to a placeholder (pix.gif / inline data URI) and the real avatar
 * lives in `data-src`. Reading `img.src` blindly stores the placeholder,
 * which renders as a black square in the panel's user list.
 */

const PLACEHOLDER_AVATAR_URL_PATTERNS = ['pix.gif', '/style/img/', '/smileys/', '/smilies/']

/** Returns the URL only when it looks like a real avatar, never a placeholder. */
export function sanitizeAvatarUrl(url: string | null | undefined): string | undefined {
	if (!url) return undefined

	const lowerUrl = url.toLowerCase()
	if (lowerUrl.startsWith('data:')) return undefined
	if (PLACEHOLDER_AVATAR_URL_PATTERNS.some(pattern => lowerUrl.includes(pattern))) return undefined

	return url
}

/** Extracts a usable avatar URL from an image, preferring the lazy-load source. */
export function getAvatarUrlFromImage(img: HTMLImageElement | null | undefined): string | undefined {
	if (!img) return undefined

	return sanitizeAvatarUrl(img.getAttribute('data-src')) ?? sanitizeAvatarUrl(img.src)
}
