/**
 * Canvas primitives shared by every Cine composition.
 *
 * These live apart from any one drawing so the review card and the poster wall share a single
 * image cache: a poster fetched to draw a card is free when the wall draws it again.
 */
import { logger } from '@/lib/logger'
import { sendMessage } from '@/lib/messaging'

/**
 * Decoded images, keyed by URL. A composition is redrawn on every edit, and without this each
 * redraw re-fetched, re-base64'd and re-decoded the same backdrop, poster and avatar.
 * Entries are promises so concurrent redraws share one in-flight load instead of racing.
 */
const imageCache = new Map<string, Promise<HTMLImageElement | null>>()

async function fetchImage(url: string): Promise<HTMLImageElement | null> {
	try {
		const source = url.startsWith('data:') ? url : (await sendMessage('fetchMovieReviewImage', { url })).dataUrl
		return await new Promise((resolve, reject) => {
			const image = new Image()
			image.onload = () => resolve(image)
			image.onerror = reject
			image.src = source
		})
	} catch (cause) {
		logger.debug('Movie review card: could not load image, rendering without it', url, cause)
		return null
	}
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
