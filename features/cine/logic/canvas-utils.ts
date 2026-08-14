/**
 * Canvas primitives shared by every Cine composition.
 *
 * These live apart from any one drawing so the review card and the poster wall share a single
 * image cache: a poster fetched to draw a card is free when the wall draws it again.
 */
import { logger } from '@/lib/logger'
import { sendMessage } from '@/lib/messaging'

/** Typography of the Cine compositions: heavy for titles and scores, UI for everything else. */
export const UI_FONT = 'Inter, "Segoe UI", Arial, sans-serif'
export const HEAVY_FONT = 'Inter, "Segoe UI Black", "Arial Black", "Segoe UI", Arial, sans-serif'

/**
 * Decoded images, keyed by URL. A composition is redrawn on every edit, and without this each
 * redraw re-fetched, re-base64'd and re-decoded the same backdrop, poster and avatar.
 * Entries are promises so concurrent redraws share one in-flight load instead of racing.
 */
const imageCache = new Map<string, Promise<HTMLImageElement | null>>()

/**
 * Retries once before giving up.
 *
 * The image travels through the background script, and an MV3 service worker is stopped
 * whenever the browser decides it has been idle. A request that arrives mid-shutdown simply
 * dies, which is why posters went missing at random while the avatar beside them loaded. The
 * retry lands after the worker has restarted.
 */
const FETCH_ATTEMPTS = 2
const RETRY_DELAY_MS = 250

async function fetchImageOnce(url: string): Promise<HTMLImageElement> {
	const source = url.startsWith('data:') ? url : (await sendMessage('fetchMovieReviewImage', { url })).dataUrl

	return await new Promise((resolve, reject) => {
		const image = new Image()
		image.onload = () => resolve(image)
		image.onerror = reject
		image.src = source
	})
}

async function fetchImage(url: string): Promise<HTMLImageElement | null> {
	for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
		try {
			return await fetchImageOnce(url)
		} catch (cause) {
			if (attempt === FETCH_ATTEMPTS) {
				// A warning rather than a debug line: this one degrades what the user gets — a card
				// without its poster — and `debug` is stripped from production, which is exactly where
				// the failure needed explaining.
				logger.warn('Cine: could not load image after retrying, rendering without it', url, cause)
				return null
			}

			logger.debug('Cine: image request failed, retrying', url, cause)
			await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
		}
	}

	return null
}

/**
 * Loads through the background script rather than straight from the host, because a canvas
 * that has drawn a cross-origin image is tainted and can no longer produce a Blob.
 */
export function loadImage(url: string | null | undefined): Promise<HTMLImageElement | null> {
	if (!url) return Promise.resolve(null)
	const cached = imageCache.get(url)
	if (cached) return cached

	const pending = fetchImage(url)
	imageCache.set(url, pending)
	// A failed load is not worth caching; the next redraw should be free to try again.
	void pending.then(image => {
		if (!image) imageCache.delete(url)
	})
	return pending
}

/** Draws an image cropped to fill the rect, centred, without distorting it. */
export function cover(
	ctx: CanvasRenderingContext2D,
	image: HTMLImageElement,
	x: number,
	y: number,
	width: number,
	height: number
) {
	const scale = Math.max(width / image.width, height / image.height)
	const sw = width / scale
	const sh = height / scale
	ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, x, y, width, height)
}

/** Shortens text to fit a width, ending in an ellipsis. */
export function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
	if (ctx.measureText(text).width <= maxWidth) return text
	const characters = Array.from(text)
	let end = characters.length
	while (end > 1 && ctx.measureText(`${characters.slice(0, end).join('').trimEnd()}…`).width > maxWidth) end -= 1
	return `${characters.slice(0, end).join('').trimEnd()}…`
}

/** Traces a rounded rectangle. The caller fills, strokes or clips it. */
export function roundedRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number
) {
	const safeRadius = Math.min(radius, width / 2, height / 2)
	ctx.beginPath()
	ctx.moveTo(x + safeRadius, y)
	ctx.lineTo(x + width - safeRadius, y)
	ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
	ctx.lineTo(x + width, y + height - safeRadius)
	ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
	ctx.lineTo(x + safeRadius, y + height)
	ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
	ctx.lineTo(x, y + safeRadius)
	ctx.quadraticCurveTo(x, y, x + safeRadius, y)
	ctx.closePath()
}
