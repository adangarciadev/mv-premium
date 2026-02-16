import { MV_BASE_URL } from '@/constants'
import type { HomepageThread, HomepageFavorite, HomepageNewsItem } from '../types'

const REQUEST_HEADERS: HeadersInit = {
	accept: '*/*',
	'x-requested-with': 'XMLHttpRequest',
}

function getForumSlugFromUrl(url: string | null | undefined): string | null {
	if (!url) return null
	const parts = url.split('/').filter(Boolean)
	const forumIndex = parts.indexOf('foro')
	if (forumIndex === -1) return null
	return parts[forumIndex + 1] ?? null
}

function parseIntSafe(value: string | null | undefined): number {
	if (!value) return 0
	const parsed = parseInt(value, 10)
	return Number.isNaN(parsed) ? 0 : parsed
}

function normalizeUrl(path: string): string {
	if (path.startsWith('http://') || path.startsWith('https://')) return path
	if (path.startsWith('/')) return `${MV_BASE_URL}${path}`
	return `${MV_BASE_URL}/${path}`
}

async function fetchAndParse(path: string): Promise<Document> {
	const response = await fetch(normalizeUrl(path), {
		headers: REQUEST_HEADERS,
		mode: 'cors',
		credentials: 'include',
	})

	if (!response.ok) {
		throw new Error(`Homepage request failed (${response.status}) for ${path}`)
	}

	const html = await response.text()
	return new DOMParser().parseFromString(html, 'text/html')
}

export function getUsername(): string | undefined {
	return document.querySelector('#user-data span')?.textContent?.trim() || undefined
}

/**
 * Converts MV's relative time string (e.g. "18s", "2m", "3h", "5d") into
 * an absolute epoch timestamp (ms) by subtracting the delta from Date.now().
 */
function parseMvRelativeTime(text: string): number | undefined {
	const match = text.match(/^(\d+)\s*(s|m|h|d)$/i)
	if (!match) return undefined

	const value = parseInt(match[1], 10)
	const unit = match[2].toLowerCase()

	const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }
	const deltaMs = value * (multipliers[unit] ?? 0)

	return Date.now() - deltaMs
}

export function parseThreadTable(doc: Document): HomepageThread[] {
	const threads: HomepageThread[] = []

	doc.querySelectorAll('#temas tr').forEach(row => {
		const cells = row.querySelectorAll('td')
		const forumSlug = getForumSlugFromUrl(cells.item(0)?.querySelector('a')?.getAttribute('href'))
		const titleLink = cells.item(1)?.querySelector<HTMLAnchorElement>('.hb, .h')
		const title = titleLink?.textContent?.trim()
		const url = titleLink?.getAttribute('href')
		const urlSinceLastVisit = cells.item(1)?.querySelector<HTMLAnchorElement>('.unseen-num')?.getAttribute('href')
		const responsesSinceLastVisit = parseIntSafe(cells.item(1)?.querySelector('.unseen-num')?.textContent)
		const totalResponses = cells.item(2)?.querySelector('.num.reply')?.textContent?.trim()
		const lastActivityAt = cells.item(5)?.textContent?.trim()
		const hasLive = Boolean(cells.item(1)?.querySelector('.thread-live'))

		if (!forumSlug || !title || !url || !totalResponses || !lastActivityAt) {
			return
		}

		threads.push({
			forumSlug,
			url,
			title,
			urlSinceLastVisit,
			responsesSinceLastVisit,
			totalResponses,
			lastActivityAt,
			lastActivityTimestamp: parseMvRelativeTime(lastActivityAt),
			hasLive,
		})
	})

	return threads
}

export function parseFavoritesList(doc: Document): HomepageFavorite[] {
	const favorites: HomepageFavorite[] = []

	doc.querySelectorAll('li').forEach(item => {
		const forumSlug = getForumSlugFromUrl(item.querySelector<HTMLAnchorElement>('.fid')?.getAttribute('href'))
		const titleLink = item.querySelector<HTMLAnchorElement>('.hb, .h')
		const title = titleLink?.getAttribute('title') ?? titleLink?.textContent?.trim()
		const url = titleLink?.getAttribute('href')
		const urlSinceLastVisit = item.querySelector<HTMLAnchorElement>('.unseen-num')?.getAttribute('href')
		const responsesSinceLastVisit = parseIntSafe(item.querySelector('.unseen-num')?.textContent)

		if (!forumSlug || !title || !url) {
			return
		}

		favorites.push({
			forumSlug,
			title,
			url,
			urlSinceLastVisit,
			responsesSinceLastVisit,
		})
	})

	return favorites
}

export function parseNewsList(doc: Document): HomepageNewsItem[] {
	const news: HomepageNewsItem[] = []

	doc.querySelectorAll('.block .news-item').forEach(item => {
		const url = item.querySelector<HTMLAnchorElement>('.news-media')?.getAttribute('href')
		const title = item.querySelector('.news-info h4')?.textContent?.trim()
		const forumSlug = getForumSlugFromUrl(url)
		const imageEl = item.querySelector<HTMLImageElement>('.news-media img, img')
		const thumbnail = imageEl?.getAttribute('data-src') ?? imageEl?.getAttribute('src')
		const totalResponses = item.querySelector('.news-media')?.textContent?.trim()
		const createdAt = item.querySelector('.news-meta')?.textContent?.split(' - ')[1]?.trim()
		const author = item.querySelector('.news-info .news-meta .author')?.textContent?.trim()

		if (!url || !title || !forumSlug || !thumbnail || !totalResponses) {
			return
		}

		news.push({
			forumSlug,
			url,
			title,
			thumbnail,
			totalResponses,
			createdAt,
			author,
		})
	})

	return news
}

export async function getForumLastThreads(): Promise<HomepageThread[]> {
	const doc = await fetchAndParse('/foro/spy')
	return parseThreadTable(doc)
}

export async function getUserLastPosts(username?: string): Promise<HomepageThread[]> {
	if (!username) return []

	const doc = await fetchAndParse(`/id/${encodeURIComponent(username)}/posts`)
	return parseThreadTable(doc)
}

export async function getFavorites(): Promise<HomepageFavorite[]> {
	const doc = await fetchAndParse('/foro/favoritos/fly/1')
	return parseFavoritesList(doc)
}

export async function getLastNews(page = 1): Promise<HomepageNewsItem[]> {
	const path = page <= 1 ? '/' : `/p${page}`
	const doc = await fetchAndParse(path)
	return parseNewsList(doc)
}
