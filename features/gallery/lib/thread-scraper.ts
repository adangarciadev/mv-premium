/**
 * Thread Media Scraper
 * * Extracts images and videos from Mediavida forum thread posts.
 * Filters out avatars, signatures, emojis, and other non-content media.
 */

import { MV_SELECTORS } from '@/constants'

// =============================================================================
// TYPES
// =============================================================================

export interface ThreadMedia {
	/** Unique ID: postNum-index */
	id: string
	/** Media type */
	type: 'image' | 'video'
	/** Full resolution URL */
	src: string
	/** Thumbnail URL (for videos or large images) */
	thumbnail?: string
	/** Original image width if available */
	width?: number
	/** Original image height if available */
	height?: number
	/** Post author username */
	author: string
	/** Anchor link to the post (#num) */
	postLink: string
	/** Post number */
	postNum: number
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Minimum image size to include (filters out emojis/smileys) */
const MIN_IMAGE_SIZE = 50

/** URL patterns to exclude (smileys, icons, etc.) */
const EXCLUDED_URL_PATTERNS = [
	'/smileys/',
	'/smilies/',
	'/emoticons/',
	'/f/', // Forum icons
	'/style/img/', // Site UI images
	'pix.gif', // Placeholder pixel
]

/** YouTube thumbnail URL template */
const YOUTUBE_THUMB_TEMPLATE = 'https://i.ytimg.com/vi/{videoId}/hqdefault.jpg'

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function isExcludedUrl(url: string): boolean {
	if (!url) return true
	const lowerUrl = url.toLowerCase()
	return EXCLUDED_URL_PATTERNS.some(pattern => lowerUrl.includes(pattern))
}

function isImageTooSmall(img: HTMLImageElement): boolean {
	// Check element dimensions
	if (img.width > 0 && img.width < MIN_IMAGE_SIZE) return true
	if (img.height > 0 && img.height < MIN_IMAGE_SIZE) return true

	// Check natural dimensions (if loaded)
	if (img.naturalWidth > 0 && img.naturalWidth < MIN_IMAGE_SIZE) return true
	if (img.naturalHeight > 0 && img.naturalHeight < MIN_IMAGE_SIZE) return true

	return false
}

function getFullResolutionUrl(img: HTMLImageElement): string {
	// Check if inside a.img-zoom (click-to-expand link)
	const zoomLink = img.closest('a.img-zoom')
	if (zoomLink) {
		const href = zoomLink.getAttribute('href')
		if (href) return href
	}

	// Use data-src if available (lazy loading)
	const dataSrc = img.getAttribute('data-src')
	if (dataSrc && !isExcludedUrl(dataSrc)) return dataSrc

	// Fall back to src
	return img.src
}

function getDimensionsFromLink(img: HTMLImageElement): { width?: number; height?: number } {
	const zoomLink = img.closest('a.img-zoom')
	if (zoomLink) {
		const width = parseInt(zoomLink.getAttribute('data-width') || '', 10)
		const height = parseInt(zoomLink.getAttribute('data-height') || '', 10)
		if (width > 0 && height > 0) {
			return { width, height }
		}
	}
	return {}
}

function extractYoutubeVideoId(element: Element): string | null {
	// From data-youtube attribute
	const anchor = element.querySelector('a[data-youtube]')
	if (anchor) {
		return anchor.getAttribute('data-youtube')
	}

	// From href
	const linkWithHref = element.querySelector('a[href*="youtube.com"], a[href*="youtu.be"]')
	if (linkWithHref) {
		const href = linkWithHref.getAttribute('href') || ''
		const match = href.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
		if (match) return match[1]
	}

	// From background-image style (Mediavida embeds often use this)
	const styledElement = element.querySelector('[style*="ytimg.com"]')
	if (styledElement) {
		const style = styledElement.getAttribute('style') || ''
		const match = style.match(/\/vi\/([\w-]+)\//)
		if (match) return match[1]
	}

	// Direct iframe embeds
	const iframe = element.querySelector('iframe[src*="youtube.com"]')
	if (iframe) {
		const src = iframe.getAttribute('src') || ''
		const match = src.match(/\/embed\/([\w-]+)/)
		if (match) return match[1]
	}

	return null
}

// =============================================================================
// =============================================================================
// MAIN SCRAPER
// =============================================================================

/**
 * Scans the provided DOM subtree for media content (images, YouTube embeds, native video tags).
 * Filters out UI elements, small icons, and duplicated URLs.
 * @param rootElement - The container to start scanning from (defaults to document)
 * @returns Array of ThreadMedia objects containing metadata and source URLs
 */
export function getThreadMedia(rootElement: ParentNode = document): ThreadMedia[] {
	const media: ThreadMedia[] = []
	const seenUrls = new Set<string>()

	// Find posts within the provided root
	const posts = rootElement.querySelectorAll<HTMLElement>(
		`${MV_SELECTORS.THREAD.POST}, ${MV_SELECTORS.THREAD.POST_DIV}[data-num]`
	)

	posts.forEach(post => {
		const postNum = parseInt(post.getAttribute('data-num') || '0', 10)
		const author = post.getAttribute('data-autor') || 'Desconocido'
		const postLink = `#${postNum}`

		if (postNum === 0) return

		// Get post content container (avoid avatar and signature)
		const postContent = post.querySelector(MV_SELECTORS.THREAD.POST_CONTENTS)
		if (!postContent) return

		let mediaIndex = 0

		// -------------------------------------------------------------------------
		// 1. IMAGES
		// -------------------------------------------------------------------------
		const images = postContent.querySelectorAll<HTMLImageElement>('img')

		images.forEach(img => {
			const src = getFullResolutionUrl(img)

			if (!src || seenUrls.has(src)) return
			if (isExcludedUrl(src)) return
			if (isImageTooSmall(img)) return
			if (img.classList.contains('avatar')) return

			seenUrls.add(src)

			const dimensions = getDimensionsFromLink(img)

			media.push({
				id: `${postNum}-${mediaIndex++}`,
				type: 'image',
				src,
				thumbnail: img.src !== src ? img.src : undefined,
				width: dimensions.width,
				height: dimensions.height,
				author,
				postLink,
				postNum,
			})
		})

		// -------------------------------------------------------------------------
		// 2. YOUTUBE VIDEOS
		// -------------------------------------------------------------------------
		const youtubeEmbeds = postContent.querySelectorAll('.embed.yt, .youtube_lite, [data-s9e-mediaembed="youtube"]')

		youtubeEmbeds.forEach(embed => {
			const videoId = extractYoutubeVideoId(embed)
			if (!videoId) return

			const thumbnailUrl = YOUTUBE_THUMB_TEMPLATE.replace('{videoId}', videoId)
			const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

			if (seenUrls.has(videoUrl)) return
			seenUrls.add(videoUrl)

			media.push({
				id: `${postNum}-${mediaIndex++}`,
				type: 'video',
				src: videoUrl,
				thumbnail: thumbnailUrl,
				width: 1280,
				height: 720,
				author,
				postLink,
				postNum,
			})
		})

		// -------------------------------------------------------------------------
		// 3. NATIVE VIDEO TAGS (MP4/WebM)
		// -------------------------------------------------------------------------
		const nativeVideos = postContent.querySelectorAll('video')
		nativeVideos.forEach(video => {
			const src = video.currentSrc || video.src || video.querySelector('source')?.src
			if (!src) return

			if (seenUrls.has(src)) return
			seenUrls.add(src)

			media.push({
				id: `${postNum}-${mediaIndex++}`,
				type: 'video',
				src: src,
				thumbnail: video.poster || undefined,
				author,
				postLink,
				postNum,
			})
		})
	})

	return media
}

/**
 * Returns the current total count of unique media items found in the entire document.
 */
export function getThreadMediaCount(): number {
	return getThreadMedia(document).length
}

/**
 * Validates if the current page context represents a forum thread view.
 */
export function isThreadPage(): boolean {
	return document.querySelector(MV_SELECTORS.THREAD.POSTS_CONTAINER) !== null
}
