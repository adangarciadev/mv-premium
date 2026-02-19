/**
 * Shared Twitter Lite utilities used by both content scripts and background.
 */

// DNR allow-list parameter added to iframe src for the network guard
export const TWITTER_LITE_ALLOW_PARAM = 'mvp_allow'
export const TWITTER_LITE_ALLOW_VALUE = '1'

// Path patterns for normalizing tweet URLs
const TWITTER_I_WEB_STATUS_PATH_RE = /^\/i\/web\/status\/(\d+)/i
const TWITTER_USER_STATUS_PATH_RE = /^\/([A-Za-z0-9_]+)\/status\/(\d+)/i
const TWITTER_I_STATUS_PATH_RE = /^\/i\/status\/(\d+)/i

/**
 * Normalizes a Twitter/X URL into a canonical `https://twitter.com/user/status/id` form.
 *
 * Shared between content script (DOM-extracted URLs) and background (oEmbed HTML URLs).
 * The caller is responsible for any pre-processing (e.g. HTML entity decoding).
 */
export function normalizeTweetUrl(rawUrl: string): string | null {
	const normalized = rawUrl.trim()
	if (!normalized) return null

	const withProtocol = normalized.startsWith('//') ? `https:${normalized}` : normalized

	try {
		const parsed = new URL(withProtocol)
		const isTwitterHost =
			/(^|\.)twitter\.com$/i.test(parsed.hostname) || /(^|\.)x\.com$/i.test(parsed.hostname)
		if (!isTwitterHost) return null

		const path = parsed.pathname

		// Check /i/web/status/ first (most specific — avoids matching 'i' as a username)
		const webStatusMatch = path.match(TWITTER_I_WEB_STATUS_PATH_RE)
		if (webStatusMatch) {
			return `https://twitter.com/i/status/${webStatusMatch[1]}`
		}

		const statusMatch = path.match(TWITTER_USER_STATUS_PATH_RE)
		if (statusMatch) {
			return `https://twitter.com/${statusMatch[1]}/status/${statusMatch[2]}`
		}

		const iStatusMatch = path.match(TWITTER_I_STATUS_PATH_RE)
		if (iStatusMatch) {
			return `https://twitter.com/i/status/${iStatusMatch[1]}`
		}

		return null
	} catch {
		return null
	}
}
