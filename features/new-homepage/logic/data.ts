import type { HomepageThread } from '../types'

export function getUsername(): string | undefined {
	return document.querySelector('#user-data span')?.textContent?.trim() || undefined
}

export async function getFavorites(): Promise<HomepageThread[]> {
	const response = await fetch('https://www.mediavida.com/foro/favoritos/fly/1', {
		headers: {
			accept: '*/*',
			'x-requested-with': 'XMLHttpRequest',
		},
		mode: 'cors',
		credentials: 'include',
	})

	const data = await response.text()
	const parser = new DOMParser()
	const doc = parser.parseFromString(data, 'text/html')

	const favorites: HomepageThread[] = []

	doc.querySelectorAll('li').forEach(child => {
		const forumSlug = child.querySelector('.fid')?.getAttribute('href')?.split('/')[2]
		const url = child.querySelector('.hb, .h')?.getAttribute('href')
		const urlSinceLastVisit = child.querySelector('.unseen-num')?.getAttribute('href')
		const title = child.querySelector('.hb, .h')?.getAttribute('title')
		const count = child.querySelector('.unseen-num')?.textContent

		if (url && title && forumSlug) {
			favorites.push({
				forumSlug,
				title,
				url,
				urlSinceLastVisit,
				responsesSinceLastVisit: count ? parseInt(count) : 0,
			})
		}
	})

	return favorites
}

export async function getForumLastThreads(): Promise<HomepageThread[]> {
	const response = await fetch('https://www.mediavida.com/foro/spy', {
		headers: {
			accept: '*/*',
			'x-requested-with': 'XMLHttpRequest',
		},
		mode: 'cors',
		credentials: 'include',
	})

	const data = await response.text()
	const parser = new DOMParser()
	const doc = parser.parseFromString(data, 'text/html')

	const threads: HomepageThread[] = []

	doc.querySelectorAll('#temas tr').forEach(child => {
		const tds = child.querySelectorAll('td')
		const forumSlug = tds.item(0)?.querySelector('a')?.getAttribute('href')?.split('/')[2]
		const title = tds.item(1)?.querySelector('.hb')?.textContent
		const url = tds.item(1)?.querySelector('.hb')?.getAttribute('href')
		const urlSinceLastVisit = tds.item(1)?.querySelector('.unseen-num')?.getAttribute('href')
		const responsesSinceLastVisit = tds.item(1)?.querySelector('.unseen-num')?.textContent
		const totalResponses = tds.item(2)?.querySelector('.num.reply')?.textContent
		const lastActivityAt = tds.item(5)?.textContent
		const hasLive = !!tds.item(1)?.querySelector('.thread-live')

		if (url && title && forumSlug && totalResponses && lastActivityAt) {
			threads.push({
				forumSlug,
				url,
				title,
				urlSinceLastVisit,
				totalResponses,
				lastActivityAt,
				hasLive,
				responsesSinceLastVisit: responsesSinceLastVisit ? parseInt(responsesSinceLastVisit) : 0,
			})
		}
	})

	return threads
}

export async function getLastNews(): Promise<HomepageThread[]> {
	const response = await fetch('https://www.mediavida.com/', {
		headers: {
			accept: '*/*',
			'x-requested-with': 'XMLHttpRequest',
		},
		mode: 'cors',
		credentials: 'include',
	})

	const data = await response.text()
	const parser = new DOMParser()
	const doc = parser.parseFromString(data, 'text/html')

	const lastNews: HomepageThread[] = []

	doc.querySelectorAll('.block .news-item').forEach(child => {
		const url = child.querySelector('.news-media')?.getAttribute('href')
		const title = child.querySelector('.news-info h4')?.textContent
		const forumSlug = url?.split('/')[2]
		const thumbnail = child.querySelector('.news-media img')?.getAttribute('data-src')
		const totalResponses = child.querySelector('.news-media')?.textContent
		const createdAt = child.querySelector('.news-meta')?.textContent?.split(' - ')[1]

		if (url && title && forumSlug && totalResponses && thumbnail) {
			lastNews.push({
				forumSlug,
				url,
				title,
				thumbnail,
				createdAt,
				totalResponses,
			})
		}
	})

	return lastNews
}

export async function getUserLastPosts(username?: string): Promise<HomepageThread[]> {
	if (!username) {
		return []
	}

	const response = await fetch(`https://www.mediavida.com/id/${username}/posts`, {
		headers: {
			accept: '*/*',
			'x-requested-with': 'XMLHttpRequest',
		},
		mode: 'cors',
		credentials: 'include',
	})

	const data = await response.text()
	const parser = new DOMParser()
	const doc = parser.parseFromString(data, 'text/html')

	const threads: HomepageThread[] = []

	doc.querySelectorAll('#temas tr').forEach(child => {
		const tds = child.querySelectorAll('td')
		const forumSlug = tds.item(0)?.querySelector('a')?.getAttribute('href')?.split('/')[2]
		const title = tds.item(1)?.querySelector('.hb')?.textContent
		const url = tds.item(1)?.querySelector('.hb')?.getAttribute('href')
		const urlSinceLastVisit = tds.item(1)?.querySelector('.unseen-num')?.getAttribute('href')
		const responsesSinceLastVisit = tds.item(1)?.querySelector('.unseen-num')?.textContent
		const totalResponses = tds.item(2)?.querySelector('.num.reply')?.textContent
		const lastActivityAt = tds.item(5)?.textContent
		const hasLive = !!tds.item(1)?.querySelector('.thread-live')

		if (url && title && forumSlug && totalResponses && lastActivityAt) {
			threads.push({
				forumSlug,
				url,
				title,
				urlSinceLastVisit,
				totalResponses,
				lastActivityAt,
				hasLive,
				responsesSinceLastVisit: responsesSinceLastVisit ? parseInt(responsesSinceLastVisit) : 0,
			})
		}
	})

	return threads
}
