import { logger } from '@/lib/logger'
import { MV_URLS, MV_SELECTORS } from '@/constants'

export interface SearchedUser {
	value: string
	data: {
		uid: string
		avatar: string
		nombre: string
	}
}

export interface MVUser {
	username: string
	uid: string
	avatar: string
	// Custom fields (stored locally)
	usernameCustom?: string
	usernameColour?: string
	avatarCustom?: string
	postBorderColour?: string
	note?: string
	isIgnored?: boolean
}

/**
 * Fetches user results from the Mediavida search/autocomplete endpoint.
 * Supports both JSON and HTML fallback parsing for maximum compatibility.
 * @param query - The username search string
 */
export async function getSearchUsers(query: string): Promise<SearchedUser[]> {
	if (!query || query.length < 2) {
		return []
	}

	try {
		const url = `${MV_URLS.USERS_LIST}?query=${encodeURIComponent(query)}`

		const response = await fetch(url, {
			credentials: 'include',
			headers: {
				Accept: 'application/json, text/javascript, */*; q=0.01',
				'X-Requested-With': 'XMLHttpRequest',
				'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
			},
		})

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`)
		}

		const text = await response.text()

		// Check if it's JSON
		if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
			const data = JSON.parse(text)

			// MV returns { suggestions: [...] }
			const suggestions = data.suggestions || data

			if (Array.isArray(suggestions)) {
				interface MVUserSuggestion {
					value?: string
					nombre?: string
					username?: string
					data?: { uid?: string | number; avatar?: string; nombre?: string }
					uid?: string | number
					avatar?: string
				}
				const users = suggestions
					.map((item: MVUserSuggestion) => ({
						value: item.value || item.nombre || item.username || '',
						data: {
							uid: String(item.data?.uid || item.uid || ''),
							avatar: item.data?.avatar || item.avatar || '',
							nombre: item.data?.nombre || item.nombre || item.value || '',
						},
					}))
					.slice(0, 50) // Limit to 50 results
				return users
			}
		}

		// It's HTML - parse it
		const parser = new DOMParser()
		const doc = parser.parseFromString(text, 'text/html')

		// Try to find user elements - adjust selectors based on actual HTML
		// Common patterns: links with /id/, user cards, etc.
		const users: SearchedUser[] = []
		const seenNames = new Set<string>()

		// Look for user links with avatar images
		const userElements = doc.querySelectorAll(MV_SELECTORS.USER.AUTHOR_LINK)

		userElements.forEach(el => {
			const href = el.getAttribute('href') || ''
			const nameMatch = href.match(/\/id\/([^\/\?]+)/)
			if (!nameMatch) return

			const nombre = nameMatch[1]
			if (seenNames.has(nombre)) return
			seenNames.add(nombre)

			// Try to find avatar
			const img = el.querySelector('img') || el.closest('.user, .usuario, li, div')?.querySelector('img')
			let avatar = img?.getAttribute('src') || ''

			// Extract uid from avatar URL if possible
			const uidMatch = avatar.match(/\/(\d+)\./)
			const uid = uidMatch ? uidMatch[1] : ''

			users.push({
				value: nombre,
				data: {
					uid,
					avatar,
					nombre,
				},
			})
		})

		return users.slice(0, 50)
	} catch (error) {
		logger.error('MV Users search error:', error)
		return []
	}
}

/**
 * Formats a relative or inconsistent avatar path into a full, secure URL.
 * @param avatar - The raw avatar string (filename or partial path)
 */
export function getAvatarUrl(avatar: string): string {
	if (!avatar) return ''
	if (avatar.startsWith('https://') || avatar.startsWith('http://')) {
		return avatar
	}
	if (avatar.startsWith('//')) {
		return `https:${avatar}`
	}
	return `https://www.mediavida.com/img/users/avatar/${avatar}`
}
