/**
 * Confirms which generated review cards actually got published.
 *
 * Inserting a card is not publishing a post: the user can abandon the message, fail
 * validation, or publish it days later from a draft in another thread. So this never
 * observes the submit action. It looks for the card's image identifier inside the user's
 * own posts while they browse, which also means several cards in one message resolve in a
 * single pass. Mediavida navigates to the new message after posting, so in practice the
 * confirmation happens on the very next page load at no extra cost.
 */
import { getPostsElements, getThreadInfo } from '@/lib/mv-api'
import { getCurrentUser } from '@/entrypoints/options/lib/current-user'
import { logger } from '@/lib/logger'
import { sourceMatchesImageId } from './movie-review-image-id'
import { confirmMovieReviewPublication, getPendingMovieReviews, type MovieReviewRecord } from './movie-review-store'

/** The parts of a scraped post this module actually needs. */
export interface MatchablePost {
	id: string
	author: string
	container: HTMLElement
}

export interface DetectedPublication {
	imageId: string
	postNumber: string
}

/**
 * Once a page load establishes there is nothing pending, later mutation-driven reruns skip
 * the storage read entirely. The ordinary cost of this feature on a thread page is this
 * boolean.
 */
let nothingPending = false

/** Test seam, and reset for a page transition. */
export function resetMovieReviewDetection(): void {
	nothingPending = false
}

/** Every URL an image in the post might carry, including lazy-loaded ones. */
function getImageSources(container: HTMLElement): string[] {
	return Array.from(container.querySelectorAll('img'))
		.flatMap(image => [image.getAttribute('src') ?? '', image.getAttribute('data-src') ?? ''])
		.filter(Boolean)
}

/** Pure matcher: which pending cards appear in which of the user's own posts. */
export function matchPendingReviews(
	posts: MatchablePost[],
	pending: MovieReviewRecord[],
	username: string
): DetectedPublication[] {
	if (pending.length === 0 || !username) return []

	const normalizedUser = username.toLowerCase()
	const matches: DetectedPublication[] = []
	const found = new Set<string>()

	for (const post of posts) {
		if (post.author.toLowerCase() !== normalizedUser) continue

		const sources = getImageSources(post.container)
		if (sources.length === 0) continue

		for (const record of pending) {
			if (found.has(record.imageId)) continue
			if (sources.some(source => sourceMatchesImageId(source, record.imageId))) {
				found.add(record.imageId)
				matches.push({ imageId: record.imageId, postNumber: post.id })
			}
		}
	}

	return matches
}

/**
 * Scans the current thread page and confirms whatever it finds. Returns how many records
 * were confirmed. Never throws: a detection failure must not block the other injections.
 */
export async function detectPublishedMovieReviews(): Promise<number> {
	if (nothingPending) return 0

	try {
		const pending = await getPendingMovieReviews()
		if (pending.length === 0) {
			nothingPending = true
			return 0
		}

		const user = await getCurrentUser()
		if (!user?.username) return 0

		const matches = matchPendingReviews(getPostsElements(), pending, user.username)
		if (matches.length === 0) return 0

		const thread = getThreadInfo()
		// Query and hash are dropped: the permalink is built from the post number instead.
		const threadUrl = `${window.location.origin}${window.location.pathname}`
		const confirmedAt = Date.now()

		for (const match of matches) {
			await confirmMovieReviewPublication(match.imageId, {
				threadUrl,
				threadTitle: thread.title,
				postNumber: match.postNumber,
				confirmedAt,
			})
		}

		logger.debug(`Críticas confirmadas como publicadas: ${matches.length}`)
		return matches.length
	} catch (error) {
		logger.error('Fallo al detectar críticas publicadas', error)
		return 0
	}
}
