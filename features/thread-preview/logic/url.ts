import { MV_BASE_URL } from '@/constants'
import { THREAD_TITLE_SELECTOR } from './constants'

export function normalizeThreadPreviewUrl(input: string): string | null {
	try {
		const url = new URL(input, MV_BASE_URL)
		const hostname = url.hostname.toLowerCase()
		if (hostname !== 'www.mediavida.com' && hostname !== 'mediavida.com') return null
		if (!url.pathname.startsWith('/foro/')) return null

		let path = url.pathname.replace(/\/live$/i, '').replace(/\/$/, '')
		path = path.replace(/\/\d+$/, '')

		const match = path.match(/^\/foro\/[^/]+\/[^/]+-\d+$/)
		if (!match) return null

		return `${MV_BASE_URL}${match[0]}`
	} catch {
		return null
	}
}

export function getThreadTitleLinkFromRow(row: Element): HTMLAnchorElement | null {
	return row.querySelector<HTMLAnchorElement>(THREAD_TITLE_SELECTOR)
}

export function getThreadPreviewUrlFromRow(row: Element): string | null {
	const link = getThreadTitleLinkFromRow(row)
	const href = link?.getAttribute('href') || link?.href || ''
	return href ? normalizeThreadPreviewUrl(href) : null
}

export function absolutizeUrl(rawUrl: string): string | null {
	try {
		return new URL(rawUrl, MV_BASE_URL).toString()
	} catch {
		return null
	}
}
