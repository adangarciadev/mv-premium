import { MV_BASE_URL } from '@/constants'

export const MAX_UNREAD_FAVORITE_TABS = 10

export function unreadFavoritesLimitMessage(count: number): string {
	return `Tienes ${count} hilos favoritos con mensajes nuevos. Puedes abrir hasta ${MAX_UNREAD_FAVORITE_TABS} a la vez. Abre algunos individualmente y vuelve a intentarlo.`
}

/** Keep the native unread destination, including its page and post anchor. */
export function normalizeUnreadFavoriteUrl(value: string): string | null {
	try {
		const url = new URL(value, MV_BASE_URL)
		if (
			url.origin !== MV_BASE_URL ||
			url.username || url.password ||
			!/^\/foro\/[^/]+\/[^/]+-\d+(?:\/\d+)?\/?$/.test(url.pathname)
		) return null
		return url.href
	} catch {
		return null
	}
}

/** A thread is opened only once, even if it appears on multiple flyout pages. */
export function uniqueUnreadFavoriteUrls(values: string[]): string[] {
	const threads = new Set<string>()
	return values.flatMap(value => {
		const url = normalizeUnreadFavoriteUrl(value)
		const id = url && new URL(url).pathname.match(/-(\d+)(?:\/\d+)?\/?$/)?.[1]
		if (!url || !id || threads.has(id)) return []
		threads.add(id)
		return [url]
	})
}

export interface OpenUnreadFavoritesPayload {
	urls: string[]
	/** The native dropdown loads 20 favorites at a time. */
	loadRemaining: boolean
}

export interface OpenUnreadFavoritesResult {
	opened: number
	failed: number
	/** No tabs were opened because the complete unread list exceeds the limit. */
	limitExceeded?: boolean
	unreadCount?: number
}
