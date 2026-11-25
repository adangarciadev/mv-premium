import { MV_SELECTORS } from '@/constants'
import { getUnreadFavoriteThreadId, normalizeUnreadFavoriteUrl } from './unread-favorites'

/** Mediavida advances the reading position when it serves a thread page. */
export async function markFavoriteRead(unreadUrl: string): Promise<void> {
	const url = normalizeUnreadFavoriteUrl(unreadUrl)
	const threadId = url && getUnreadFavoriteThreadId(url)
	if (!url || !threadId) throw new Error('Invalid favorite thread URL')

	let pageUrl = new URL(url)
	pageUrl.hash = ''
	// Normally the unread link is already on the last page. If it isn't, follow
	// the pager, allowing for a page added between the two requests.
	for (let attempt = 0; attempt < 3; attempt++) {
		const response = await fetch(pageUrl, {
			credentials: 'same-origin',
			cache: 'no-store',
			signal: AbortSignal.timeout(15000),
		})
		const responseUrl = normalizeUnreadFavoriteUrl(response.url || pageUrl.href)
		if (!response.ok || !responseUrl || getUnreadFavoriteThreadId(responseUrl) !== threadId) {
			throw new Error('Could not load the favorite thread')
		}

		const doc = new DOMParser().parseFromString(await response.text(), 'text/html')
		if (!doc.querySelector(MV_SELECTORS.GLOBAL.FAVORITES_TRIGGER) || !doc.querySelector(MV_SELECTORS.THREAD.POST)) {
			throw new Error('Expected an authenticated thread page')
		}
		pageUrl = new URL(responseUrl)
		let lastPage = Number(pageUrl.pathname.match(/\/([0-9]+)\/?$/)?.[1] ?? 1)
		let lastPageUrl: URL | undefined
		for (const link of doc.querySelectorAll<HTMLAnchorElement>('ul.pg a[href]')) {
			const page = Number(link.textContent?.trim())
			if (!Number.isInteger(page) || page <= lastPage) continue
			const href = normalizeUnreadFavoriteUrl(link.getAttribute('href') ?? '')
			if (!href || getUnreadFavoriteThreadId(href) !== threadId) continue
			lastPage = page
			lastPageUrl = new URL(href)
		}
		if (!lastPageUrl) return
		pageUrl = lastPageUrl
	}
	throw new Error('Could not reach the last page of the favorite thread')
}
