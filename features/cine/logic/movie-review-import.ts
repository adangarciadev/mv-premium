/**
 * Finding review cards the user published before this feature existed.
 *
 * Their data cannot be recovered — title, score and quote are pixels inside the PNG — but the
 * message context can. The page gives us the post number, the thread and the image URL; the
 * user only has to say which film it is and what they scored it, and the score is legible in
 * the thumbnail shown beside the input.
 */
import { isCardRatio, measureImageRatio } from './movie-card-shape'
import { extractImageId } from './movie-review-image-id'

export interface CandidateImage {
	imageUrl: string
	imageId: string
	postNumber: string
}

export interface CandidateCard extends CandidateImage {
	threadUrl: string
	threadTitle: string
}

const POST_SELECTOR = '.post[data-num]'

function getImageUrl(image: Element): string {
	return image.getAttribute('src') || image.getAttribute('data-src') || ''
}

function collectFromPosts(posts: HTMLElement[], username: string, registeredIds: Set<string>): CandidateImage[] {
	if (!username) return []

	const normalizedUser = username.toLowerCase()
	const candidates: CandidateImage[] = []
	const seen = new Set<string>()

	for (const post of posts) {
		if ((post.dataset.autor || '').toLowerCase() !== normalizedUser) continue

		const postNumber = post.dataset.num || ''
		if (!postNumber) continue

		for (const image of Array.from(post.querySelectorAll('img'))) {
			const imageUrl = getImageUrl(image)
			if (!imageUrl) continue

			const imageId = extractImageId(imageUrl)
			if (!imageId || registeredIds.has(imageId) || seen.has(imageId)) continue

			seen.add(imageId)
			candidates.push({ imageUrl, imageId, postNumber })
		}
	}

	return candidates
}

/**
 * Every not-yet-registered image inside the user's own posts, searching a container such as a
 * whole page or a document parsed from a fetched one.
 *
 * Shape is deliberately not considered here: measuring an image means loading it, so that
 * happens later and only for whatever survives this much cheaper pass.
 *
 * A card that appears in more than one post is reported once, against the first post it was
 * found in. Identity is the image, and a record can only be registered against one message.
 */
export function collectCandidateImages(
	root: ParentNode,
	username: string,
	registeredIds: Set<string>
): CandidateImage[] {
	return collectFromPosts(Array.from(root.querySelectorAll<HTMLElement>(POST_SELECTOR)), username, registeredIds)
}

/**
 * The same, for a post element the caller already has in hand.
 *
 * This exists because `querySelectorAll` only searches descendants: passing a post element to
 * `collectCandidateImages` finds nothing, since a post does not contain itself.
 */
export function collectCandidatesInPost(
	post: HTMLElement,
	username: string,
	registeredIds: Set<string>
): CandidateImage[] {
	return collectFromPosts([post], username, registeredIds)
}

/**
 * Keeps only the candidates shaped like a card.
 *
 * An image that cannot be measured is dropped rather than guessed at: offering the user an
 * image we know nothing about is worse than missing one they can still import by hand.
 */
export async function filterByCardShape<T extends { imageUrl: string }>(
	candidates: T[],
	measure: (url: string) => Promise<number | null> = measureImageRatio
): Promise<T[]> {
	if (candidates.length === 0) return []

	const ratios = await Promise.all(candidates.map(candidate => measure(candidate.imageUrl)))

	// A ratio is width over height, so measuring against a height of 1 reuses the same
	// tolerance maths rather than duplicating it.
	return candidates.filter((_, index) => {
		const ratio = ratios[index]
		return ratio !== null && isCardRatio(ratio, 1)
	})
}
