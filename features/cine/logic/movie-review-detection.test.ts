import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/mv-api', () => ({
	getPostsElements: vi.fn(() => []),
	getThreadInfo: vi.fn(() => ({
		title: 'Hilo de cine',
		id: '123',
		subforum: 'Cine',
		subforumSlug: 'cine',
		currentPage: 1,
		totalPages: 1,
	})),
}))

vi.mock('@/entrypoints/options/lib/current-user', () => ({
	getCurrentUser: vi.fn(() => Promise.resolve({ username: 'adan', detectedAt: 0 })),
}))

vi.mock('./movie-review-store', () => ({
	getPendingMovieReviews: vi.fn(() => Promise.resolve([])),
	confirmMovieReviewPublication: vi.fn(() => Promise.resolve(true)),
}))

import { getPostsElements } from '@/lib/mv-api'
import { getCurrentUser } from '@/entrypoints/options/lib/current-user'
import {
	detectPublishedMovieReviews,
	matchPendingReviews,
	resetMovieReviewDetection,
	type MatchablePost,
} from './movie-review-detection'
import { confirmMovieReviewPublication, getPendingMovieReviews } from './movie-review-store'
import type { MovieReviewRecord } from './movie-review-store'

function makeRecord(imageId: string): MovieReviewRecord {
	return {
		imageId,
		imageUrl: `https://iili.io/${imageId}.png`,
		tmdbId: 1,
		title: 'Una película',
		year: '2024',
		posterUrl: null,
		rating: 8,
		badge: null,
		quote: '',
		createdAt: 0,
		source: 'generated',
		publication: null,
	}
}

function makePost(id: string, author: string, html: string): MatchablePost {
	const container = document.createElement('div')
	container.innerHTML = html
	return { id, author, container }
}

describe('matchPendingReviews', () => {
	it('matches a pending card inside the user own post', () => {
		const post = makePost('45', 'adan', '<img src="https://iili.io/4ypDNabBJ.png">')

		expect(matchPendingReviews([post], [makeRecord('4ypDNabBJ')], 'adan')).toEqual([
			{ imageId: '4ypDNabBJ', postNumber: '45' },
		])
	})

	it('matches an ImgBB upload, whose identifier spans two path segments', () => {
		const post = makePost('45', 'adan', '<img src="https://i.ibb.co/0jZ8XKq/image-1700000000000.jpg">')
		const record = makeRecord('0jZ8XKq/image-1700000000000')

		expect(matchPendingReviews([post], [record], 'adan')).toHaveLength(1)
	})

	it('matches through a lazy-loaded data-src', () => {
		const post = makePost('45', 'adan', '<img data-src="https://iili.io/4ypDNabBJ.png">')

		expect(matchPendingReviews([post], [makeRecord('4ypDNabBJ')], 'adan')).toHaveLength(1)
	})

	it('matches a resized variant of the same upload', () => {
		const post = makePost('45', 'adan', '<img src="https://iili.io/4ypDNabBJ_th.png">')

		expect(matchPendingReviews([post], [makeRecord('4ypDNabBJ')], 'adan')).toHaveLength(1)
	})

	it('ignores the same card inside somebody else post', () => {
		const post = makePost('45', 'otro', '<img src="https://iili.io/4ypDNabBJ.png">')

		expect(matchPendingReviews([post], [makeRecord('4ypDNabBJ')], 'adan')).toEqual([])
	})

	it('compares the author case-insensitively', () => {
		const post = makePost('45', 'Adan', '<img src="https://iili.io/4ypDNabBJ.png">')

		expect(matchPendingReviews([post], [makeRecord('4ypDNabBJ')], 'adan')).toHaveLength(1)
	})

	it('resolves several cards published in one message', () => {
		const post = makePost(
			'45',
			'adan',
			`<img src="https://iili.io/aaaaaaaaa.png">
			 <img src="https://iili.io/bbbbbbbbb.png">
			 <img src="https://iili.io/ccccccccc.png">`
		)
		const pending = [makeRecord('aaaaaaaaa'), makeRecord('bbbbbbbbb'), makeRecord('ccccccccc')]

		expect(matchPendingReviews([post], pending, 'adan')).toEqual([
			{ imageId: 'aaaaaaaaa', postNumber: '45' },
			{ imageId: 'bbbbbbbbb', postNumber: '45' },
			{ imageId: 'ccccccccc', postNumber: '45' },
		])
	})

	it('reports each pending card at most once, keeping the earliest post', () => {
		const first = makePost('45', 'adan', '<img src="https://iili.io/4ypDNabBJ.png">')
		const second = makePost('88', 'adan', '<img src="https://iili.io/4ypDNabBJ.png">')

		expect(matchPendingReviews([first, second], [makeRecord('4ypDNabBJ')], 'adan')).toEqual([
			{ imageId: '4ypDNabBJ', postNumber: '45' },
		])
	})

	it('returns nothing when no image matches', () => {
		const post = makePost('45', 'adan', '<img src="https://iili.io/ZZZZZZZZZ.png">')

		expect(matchPendingReviews([post], [makeRecord('4ypDNabBJ')], 'adan')).toEqual([])
	})

	it('skips a post that carries no images at all', () => {
		const post = makePost('45', 'adan', '<p>Solo texto</p>')

		expect(matchPendingReviews([post], [makeRecord('4ypDNabBJ')], 'adan')).toEqual([])
	})

	it('returns nothing without pending records or without a username', () => {
		const post = makePost('45', 'adan', '<img src="https://iili.io/4ypDNabBJ.png">')

		expect(matchPendingReviews([post], [], 'adan')).toEqual([])
		expect(matchPendingReviews([post], [makeRecord('4ypDNabBJ')], '')).toEqual([])
	})
})

describe('detectPublishedMovieReviews', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		resetMovieReviewDetection()
		vi.mocked(getPendingMovieReviews).mockResolvedValue([])
		vi.mocked(getCurrentUser).mockResolvedValue({ username: 'adan', detectedAt: 0 })
		vi.mocked(getPostsElements).mockReturnValue([])
		window.history.pushState({}, '', '/foro/cine/hilo-123')
	})

	it('confirms a match with the thread details and the post number', async () => {
		vi.mocked(getPendingMovieReviews).mockResolvedValue([makeRecord('4ypDNabBJ')])
		vi.mocked(getPostsElements).mockReturnValue([
			makePost('45', 'adan', '<img src="https://iili.io/4ypDNabBJ.png">'),
		] as unknown as ReturnType<typeof getPostsElements>)

		expect(await detectPublishedMovieReviews()).toBe(1)
		expect(confirmMovieReviewPublication).toHaveBeenCalledWith(
			'4ypDNabBJ',
			expect.objectContaining({
				threadUrl: `${window.location.origin}/foro/cine/hilo-123`,
				threadTitle: 'Hilo de cine',
				postNumber: '45',
			})
		)
	})

	it('stops reading storage once a page load finds nothing pending', async () => {
		expect(await detectPublishedMovieReviews()).toBe(0)
		expect(await detectPublishedMovieReviews()).toBe(0)
		expect(await detectPublishedMovieReviews()).toBe(0)

		// The mutation observer reruns injections constantly; only the first run may pay.
		expect(getPendingMovieReviews).toHaveBeenCalledTimes(1)
	})

	it('keeps looking on later runs while something is still pending', async () => {
		vi.mocked(getPendingMovieReviews).mockResolvedValue([makeRecord('4ypDNabBJ')])

		await detectPublishedMovieReviews()
		await detectPublishedMovieReviews()

		expect(getPendingMovieReviews).toHaveBeenCalledTimes(2)
	})

	it('confirms nothing when the current user is unknown', async () => {
		vi.mocked(getPendingMovieReviews).mockResolvedValue([makeRecord('4ypDNabBJ')])
		vi.mocked(getCurrentUser).mockResolvedValue(null)

		expect(await detectPublishedMovieReviews()).toBe(0)
		expect(confirmMovieReviewPublication).not.toHaveBeenCalled()
	})

	it('swallows a failure so the rest of the page injections still run', async () => {
		vi.mocked(getPendingMovieReviews).mockRejectedValue(new Error('storage caído'))

		await expect(detectPublishedMovieReviews()).resolves.toBe(0)
	})
})
