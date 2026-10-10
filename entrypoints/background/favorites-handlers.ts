import { browser } from 'wxt/browser'
import { parse } from 'node-html-parser'
import { MV_BASE_URL } from '@/constants'
import { onMessage } from '@/lib/messaging'
import { uniqueUnreadFavoriteUrls } from '@/features/favorites/logic/unread-favorites'

/** Complete the native paginated flyout before opening any tabs. */
async function loadAllUnreadFavorites(): Promise<string[]> {
	const urls: string[] = []
	const seenPages = new Set<string>()
	for (let page = 1; page <= 100; page++) {
		const response = await fetch(`${MV_BASE_URL}/foro/favoritos/fly/${page}`, {
			credentials: 'include',
			signal: AbortSignal.timeout(15000),
		})
		if (!response.ok || response.redirected) throw new Error('No se pudieron cargar los favoritos.')
		const html = await response.text()
		if (!html.trim()) return urls
		const root = parse(html)
		const rows = root.querySelectorAll('li')
		// A login/error page must not be interpreted as a finished favorites list.
		if (!rows.length || seenPages.has(html)) throw new Error('Respuesta de favoritos inesperada.')
		seenPages.add(html)
		urls.push(...root.querySelectorAll('a.unseen-num[href]').map(link => link.getAttribute('href') ?? ''))
		if (rows.length < 20) return urls
	}
	throw new Error('No se pudo completar la lista de favoritos.')
}

export function setupFavoritesHandlers(): void {
	const pendingTabs = new Set<number>()
	onMessage('openUnreadFavorites', async ({ data, sender }) => {
		const tab = sender.tab
		if (typeof tab?.id !== 'number' || !tab.url || new URL(tab.url).origin !== MV_BASE_URL) {
			throw new Error('Esta acción requiere una pestaña de Mediavida.')
		}
		if (!data || !Array.isArray(data.urls) || data.urls.some(url => typeof url !== 'string') || typeof data.loadRemaining !== 'boolean') {
			throw new Error('Lista de favoritos inválida.')
		}
		if (pendingTabs.has(tab.id)) throw new Error('Ya se están abriendo los favoritos.')
		pendingTabs.add(tab.id)
		try {
			const urls = uniqueUnreadFavoriteUrls([
				...data.urls,
				...(data.loadRemaining ? await loadAllUnreadFavorites() : []),
			])
			let opened = 0
			let failed = 0
			for (const url of urls) {
				try {
					await browser.tabs.create({ url, active: false, windowId: tab.windowId, openerTabId: tab.id })
					opened++
				} catch {
					failed++
				}
			}
			return { opened, failed }
		} finally {
			pendingTabs.delete(tab.id)
		}
	})
}
