import { cover, HEAVY_FONT, loadImage, roundedRect, truncateToWidth, UI_FONT } from './canvas-utils'

// Re-exported from its original home so existing importers keep working.
export { truncateToWidth }
import {
	buildMovieMetadata,
	getMovieRatingTier,
	getMovieReviewBadge,
	normalizeMovieRating,
	normalizeMovieReviewQuote,
	type MovieReviewCardData,
} from './movie-review'

const WIDTH = 1200
const HEIGHT = 453

const TITLE_MAX_FONT_SIZE = 38
const TITLE_MIN_FONT_SIZE = 18

export interface MovieTitleLayout {
	lines: string[]
	fontSize: number
	lineHeight: number
}

/**
 * Breaks a single word that is wider than the column, by code point so surrogate pairs survive.
 * Returns the finished lines plus the remainder still being filled.
 */
function breakLongWord(
	ctx: CanvasRenderingContext2D,
	word: string,
	maxWidth: number
): { lines: string[]; rest: string } {
	const lines: string[] = []
	let chunk = ''
	for (const character of Array.from(word)) {
		if (chunk && ctx.measureText(chunk + character).width > maxWidth) {
			lines.push(chunk)
			chunk = character
		} else {
			chunk += character
		}
	}
	return { lines, rest: chunk }
}

/** Breaks text into lines that fit `maxWidth`, using the font already set on the context. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const lines: string[] = []
	let line = ''

	for (const word of text.split(' ')) {
		const candidate = line ? `${line} ${word}` : word
		if (ctx.measureText(candidate).width <= maxWidth) {
			line = candidate
			continue
		}

		if (line) lines.push(line)
		// A word wider than the column has to be split, or fillText would condense it into an
		// unreadable ribbon: 160 characters with no spaces are a single "word".
		if (ctx.measureText(word).width > maxWidth) {
			const broken = breakLongWord(ctx, word, maxWidth)
			lines.push(...broken.lines)
			line = broken.rest
		} else {
			line = word
		}
	}

	if (line) lines.push(line)
	return lines
}

/**
 * Picks the largest heading size at which the title fits in at most two lines.
 * The title is NEVER truncated: if even the smallest size needs more room, every line is still
 * drawn, and `fillText`'s maxWidth condenses an unbreakable word rather than cutting it.
 * Leaves the chosen font set on the context.
 */
export function layoutMovieTitle(ctx: CanvasRenderingContext2D, title: string, maxWidth: number): MovieTitleLayout {
	let lines = [title]
	let fontSize = TITLE_MIN_FONT_SIZE

	for (let size = TITLE_MAX_FONT_SIZE; size >= TITLE_MIN_FONT_SIZE; size -= 1) {
		ctx.font = `900 ${size}px ${HEAVY_FONT}`
		lines = wrapLines(ctx, title, maxWidth)
		fontSize = size
		if (lines.length <= 2 && lines.every(line => ctx.measureText(line).width <= maxWidth)) break
	}

	ctx.font = `900 ${fontSize}px ${HEAVY_FONT}`
	return { lines, fontSize, lineHeight: Math.round(fontSize * 1.1) }
}

/**
 * Clamps a single line to `maxWidth` with an ellipsis, using the font already set on the context.
 * Canvas `fillText(maxWidth)` only condenses glyphs, so long values must be cut before drawing.
 */
function drawWrappedText(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	maxWidth: number,
	lineHeight: number,
	maxLines: number
) {
	const lines = wrapLines(ctx, text, maxWidth)
	const visible = lines.slice(0, maxLines)
	if (lines.length > maxLines) visible[maxLines - 1] = `${visible[maxLines - 1].replace(/[.…]+$/, '')}…`
	visible.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight, maxWidth))
}

function drawMovieMetadata(
	ctx: CanvasRenderingContext2D,
	metadata: string,
	director: string,
	x: number,
	y: number,
	maxWidth: number
) {
	if (!metadata) return

	const safeDirector = director.trim() && director !== 'Desconocido' ? director.trim() : ''
	const segments = metadata.split(' · ')
	const separator = ' · '
	const measureLine = (fontSize: number) =>
		segments.reduce((width, segment, index) => {
			const isDirector = Boolean(safeDirector) && index === 0
			ctx.font = `${isDirector ? 600 : 500} ${fontSize}px ${UI_FONT}`
			const segmentWidth = ctx.measureText(segment).width
			if (index === segments.length - 1) return width + segmentWidth
			ctx.font = `400 ${fontSize}px ${UI_FONT}`
			return width + segmentWidth + ctx.measureText(separator).width
		}, 0)

	let fontSize = 20
	let lineWidth = measureLine(fontSize)
	if (lineWidth > maxWidth) {
		fontSize = 17
		lineWidth = measureLine(fontSize)
	}
	const horizontalScale = Math.min(1, maxWidth / lineWidth)

	ctx.save()
	ctx.translate(x, y)
	ctx.scale(horizontalScale, 1)
	let cursorX = 0
	segments.forEach((segment, index) => {
		const isDirector = Boolean(safeDirector) && index === 0
		ctx.font = `${isDirector ? 600 : 500} ${fontSize}px ${UI_FONT}`
		ctx.fillStyle = isDirector ? '#d0d0d5' : '#9d9ca3'
		ctx.fillText(segment, cursorX, 0)
		cursorX += ctx.measureText(segment).width

		if (index < segments.length - 1) {
			ctx.font = `400 ${fontSize}px ${UI_FONT}`
			ctx.fillStyle = 'rgba(170, 168, 176, 0.55)'
			ctx.fillText(separator, cursorX, 0)
			cursorX += ctx.measureText(separator).width
		}
	})
	ctx.restore()
}

function traceStar(
	ctx: CanvasRenderingContext2D,
	centerX: number,
	centerY: number,
	outerRadius: number,
	innerRadius: number
) {
	ctx.beginPath()
	for (let point = 0; point < 10; point += 1) {
		const radius = point % 2 === 0 ? outerRadius : innerRadius
		const angle = -Math.PI / 2 + (point * Math.PI) / 5
		const pointX = centerX + Math.cos(angle) * radius
		const pointY = centerY + Math.sin(angle) * radius
		if (point === 0) ctx.moveTo(pointX, pointY)
		else ctx.lineTo(pointX, pointY)
	}
	ctx.closePath()
}

function drawStars(ctx: CanvasRenderingContext2D, rating: number, x: number, y: number, color: string) {
	const outerRadius = 10
	const innerRadius = 4.6
	const step = 22
	const centerY = y - 9

	ctx.save()
	ctx.lineJoin = 'round'
	ctx.lineWidth = 1.1

	for (let index = 0; index < 10; index += 1) {
		const centerX = x + outerRadius + index * step
		const fill = rating >= index + 1 ? 1 : rating >= index + 0.5 ? 0.5 : 0

		traceStar(ctx, centerX, centerY, outerRadius, innerRadius)
		ctx.strokeStyle = fill === 1 ? color : 'rgba(214, 207, 190, 0.25)'
		ctx.globalAlpha = fill === 1 ? 0.82 : 0.72
		ctx.stroke()

		if (fill > 0) {
			ctx.save()
			if (fill === 0.5) {
				ctx.beginPath()
				ctx.rect(centerX - outerRadius - 1, centerY - outerRadius - 1, outerRadius + 1, outerRadius * 2 + 2)
				ctx.clip()
			}
			traceStar(ctx, centerX, centerY, outerRadius, innerRadius)
			ctx.globalAlpha = 1
			ctx.fillStyle = color
			ctx.fill()
			ctx.restore()
		}
	}

	ctx.restore()
}

/**
 * The rewatch mark: a circular arrow, traced by hand for the same reason the stars are.
 *
 * "↺" is a glyph the platform may or may not have, and a missing one would print as a box on
 * someone else's machine. It sits between the score and the stars, at the weight of the hairline
 * artwork around it — it is a footnote to the score, not a second badge.
 */
function drawRewatchMark(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
	const radius = 8
	const end = Math.PI * 1.72

	ctx.save()
	ctx.strokeStyle = color
	ctx.globalAlpha = 0.85
	ctx.lineWidth = 2.1
	ctx.lineCap = 'round'

	ctx.beginPath()
	ctx.arc(x, y, radius, Math.PI * 0.16, end)
	ctx.stroke()

	// The head points along the circle, so the ring reads as travelling rather than as a broken O.
	const tipX = x + Math.cos(end) * radius
	const tipY = y + Math.sin(end) * radius
	const alongX = -Math.sin(end)
	const alongY = Math.cos(end)
	const acrossX = Math.cos(end)
	const acrossY = Math.sin(end)

	ctx.beginPath()
	ctx.moveTo(tipX + alongX * 5, tipY + alongY * 5)
	ctx.lineTo(tipX - alongX * 3 + acrossX * 4.5, tipY - alongY * 3 + acrossY * 4.5)
	ctx.lineTo(tipX - alongX * 3 - acrossX * 4.5, tipY - alongY * 3 - acrossY * 4.5)
	ctx.closePath()
	ctx.fillStyle = color
	ctx.fill()

	ctx.restore()
}

const POSTER_X = 958
const POSTER_Y = 42
const POSTER_WIDTH = 190
const POSTER_HEIGHT = 285

interface CardImages {
	backdrop: HTMLImageElement | null
	poster: HTMLImageElement | null
	avatar: HTMLImageElement | null
}

function loadCardImages(data: MovieReviewCardData): Promise<CardImages> {
	return Promise.all([loadImage(data.backdropUrl), loadImage(data.posterUrl), loadImage(data.avatarUrl)]).then(
		([backdrop, poster, avatar]) => ({ backdrop, poster, avatar })
	)
}

/**
 * Backdrop, veils and poster depend only on the movie, but the card is redrawn on every keystroke
 * of the quote. Rendering them once into an offscreen canvas turns each redraw into one drawImage.
 */
const staticLayerCache = new Map<string, HTMLCanvasElement>()
const STATIC_LAYER_CACHE_LIMIT = 4

function drawStaticLayer(ctx: CanvasRenderingContext2D, images: CardImages) {
	const base = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT)
	base.addColorStop(0, '#090a0d')
	base.addColorStop(0.7, '#121116')
	base.addColorStop(1, '#060608')
	ctx.fillStyle = base
	ctx.fillRect(0, 0, WIDTH, HEIGHT)

	const backdropWidth = Math.round(HEIGHT * (16 / 9))
	const backdropX = WIDTH - backdropWidth
	if (images.backdrop) {
		ctx.save()
		ctx.globalAlpha = 0.68
		cover(ctx, images.backdrop, backdropX, 0, backdropWidth, HEIGHT)
		ctx.restore()
	}

	const veil = ctx.createLinearGradient(0, 0, 1010, 0)
	veil.addColorStop(0, 'rgba(7,8,11,.99)')
	veil.addColorStop(0.22, 'rgba(7,8,11,.96)')
	veil.addColorStop(backdropX / 1010, 'rgba(7,8,11,1)')
	veil.addColorStop(0.48, 'rgba(7,8,11,.82)')
	veil.addColorStop(0.72, 'rgba(7,8,11,.46)')
	veil.addColorStop(1, 'rgba(7,8,11,.12)')
	ctx.fillStyle = veil
	ctx.fillRect(0, 0, WIDTH, HEIGHT)

	const bottom = ctx.createLinearGradient(0, 210, 0, HEIGHT)
	bottom.addColorStop(0, 'rgba(7,8,11,0)')
	bottom.addColorStop(1, 'rgba(7,8,11,.96)')
	ctx.fillStyle = bottom
	ctx.fillRect(0, 0, WIDTH, HEIGHT)

	if (images.poster) {
		ctx.save()
		ctx.shadowColor = 'rgba(0,0,0,.65)'
		ctx.shadowBlur = 18
		roundedRect(ctx, POSTER_X, POSTER_Y, POSTER_WIDTH, POSTER_HEIGHT, 9)
		ctx.clip()
		cover(ctx, images.poster, POSTER_X, POSTER_Y, POSTER_WIDTH, POSTER_HEIGHT)
		ctx.restore()
		roundedRect(ctx, POSTER_X, POSTER_Y, POSTER_WIDTH, POSTER_HEIGHT, 9)
		ctx.strokeStyle = 'rgba(255,255,255,.16)'
		ctx.lineWidth = 1
		ctx.stroke()
	} else {
		ctx.fillStyle = 'rgba(255,255,255,.06)'
		roundedRect(ctx, POSTER_X, POSTER_Y, POSTER_WIDTH, POSTER_HEIGHT, 9)
		ctx.fill()
		ctx.font = `800 20px ${UI_FONT}`
		ctx.fillStyle = '#77737a'
		ctx.textAlign = 'center'
		ctx.fillText('SIN PÓSTER', POSTER_X + POSTER_WIDTH / 2, POSTER_Y + POSTER_HEIGHT / 2)
		ctx.textAlign = 'left'
	}
}

function getStaticLayer(data: MovieReviewCardData, images: CardImages): HTMLCanvasElement {
	const key = `${data.backdropUrl ?? ''}|${data.posterUrl ?? ''}`
	const cached = staticLayerCache.get(key)
	if (cached) return cached

	const layer = document.createElement('canvas')
	layer.width = WIDTH
	layer.height = HEIGHT
	const layerCtx = layer.getContext('2d')
	if (!layerCtx) throw new Error('Canvas is not available')
	drawStaticLayer(layerCtx, images)

	if (staticLayerCache.size >= STATIC_LAYER_CACHE_LIMIT) {
		const oldest = staticLayerCache.keys().next().value
		if (oldest !== undefined) staticLayerCache.delete(oldest)
	}
	staticLayerCache.set(key, layer)
	return layer
}

/** Synchronous draw of the whole card. Every input must already be loaded. */
function drawMovieReviewCard(ctx: CanvasRenderingContext2D, data: MovieReviewCardData, images: CardImages) {
	const { avatar } = images
	const rating = data.rating === null ? null : normalizeMovieRating(data.rating)
	const tier = getMovieRatingTier(rating ?? 7)
	const badge = getMovieReviewBadge(data.badge)
	const quote = normalizeMovieReviewQuote(data.quote)

	ctx.clearRect(0, 0, WIDTH, HEIGHT)
	ctx.drawImage(getStaticLayer(data, images), 0, 0)

	const titleMaxWidth = 650
	const title = layoutMovieTitle(ctx, data.title, titleMaxWidth)
	// A single line keeps the original baselines (78 / 108); extra lines lift the block and push metadata down.
	const titleBaseline = 78 - (title.lines.length - 1) * 16
	ctx.fillStyle = '#fff'
	title.lines.forEach((line, index) => ctx.fillText(line, 46, titleBaseline + index * title.lineHeight, titleMaxWidth))
	const metadata = buildMovieMetadata(data.director, data.year, data.genres)
	const metadataY = titleBaseline + (title.lines.length - 1) * title.lineHeight + 30
	drawMovieMetadata(ctx, metadata, data.director, 47, metadataY, 650)

	const ratingText = rating === null ? '—' : String(rating).replace('.', ',')
	ctx.font = `900 43px ${HEAVY_FONT}`
	ctx.fillStyle = rating === null ? '#74767d' : tier.accent
	ctx.fillText(ratingText, 46, 177)
	const ratingWidth = ctx.measureText(ratingText).width
	ctx.font = `600 18px ${UI_FONT}`
	ctx.fillStyle = '#aaa7ad'
	ctx.fillText('/10', 53 + ratingWidth, 174)
	if (data.rewatch) drawRewatchMark(ctx, 105 + ratingWidth, 163, rating === null ? '#5f6066' : tier.accent)
	drawStars(ctx, rating ?? 0, 138 + ratingWidth, 172, rating === null ? '#5f6066' : tier.accent)

	if (badge) {
		// Kept below the metadata's weight on purpose: it is a stamp, not a second headline.
		ctx.font = `800 17px ${UI_FONT}`
		ctx.fillStyle = badge.border
		ctx.fillRect(47, 195, 3, 23)
		ctx.fillStyle = badge.text
		ctx.fillText(badge.label, 60, 212)
	}

	if (quote) {
		ctx.font = `italic 700 21px ${UI_FONT}`
		ctx.fillStyle = '#f1f0ed'
		drawWrappedText(ctx, `“${quote}”`, 46, badge ? 262 : 236, 570, 27, 4)
	}

	const authorY = 399
	if (avatar) {
		ctx.save()
		ctx.beginPath()
		ctx.arc(61, authorY - 7, 19, 0, Math.PI * 2)
		ctx.clip()
		cover(ctx, avatar, 42, authorY - 26, 38, 38)
		ctx.restore()
	} else {
		// Without a rating there is no tier yet, so the placeholder stays neutral instead of pre-tinting gold.
		ctx.fillStyle = rating === null ? '#33343a' : tier.accent
		ctx.beginPath()
		ctx.arc(61, authorY - 7, 19, 0, Math.PI * 2)
		ctx.fill()
		ctx.font = `900 20px ${HEAVY_FONT}`
		ctx.fillStyle = rating === null ? '#c9c7cc' : '#17130a'
		ctx.textAlign = 'center'
		// Array.from splits by code point, so an astral first character is not cut into half a surrogate pair.
		ctx.fillText((Array.from(data.username.trim())[0] ?? '?').toUpperCase(), 61, authorY)
		ctx.textAlign = 'left'
	}
	const authorLabel = 'Vista y valorada por'
	ctx.font = `600 18px ${UI_FONT}`
	ctx.fillStyle = '#b8b5b8'
	ctx.fillText(authorLabel, 93, authorY)
	const usernameX = 93 + ctx.measureText(authorLabel).width + 9
	// The footer is gone, so the username may run to the right edge before the safe margin.
	const usernameMaxWidth = Math.max(80, 1150 - usernameX)
	ctx.font = `800 18px ${UI_FONT}`
	ctx.fillStyle = '#fff'
	ctx.fillText(truncateToWidth(ctx, data.username, usernameMaxWidth), usernameX, authorY, usernameMaxWidth)
}

/** Draws the card onto a canvas already sized to the card, for a live preview without encoding a PNG. */
export async function renderMovieReviewCard(canvas: HTMLCanvasElement, data: MovieReviewCardData): Promise<void> {
	const ctx = canvas.getContext('2d')
	if (!ctx) throw new Error('Canvas is not available')
	if (canvas.width !== WIDTH || canvas.height !== HEIGHT) {
		canvas.width = WIDTH
		canvas.height = HEIGHT
	}
	drawMovieReviewCard(ctx, data, await loadCardImages(data))
}

/** Encodes the card as a PNG. Only needed when the image leaves the page: upload and download. */
export async function createMovieReviewImage(data: MovieReviewCardData): Promise<Blob> {
	const canvas = document.createElement('canvas')
	canvas.width = WIDTH
	canvas.height = HEIGHT
	const ctx = canvas.getContext('2d')
	if (!ctx) throw new Error('Canvas is not available')

	drawMovieReviewCard(ctx, data, await loadCardImages(data))

	return await new Promise((resolve, reject) =>
		canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not create image'))), 'image/png')
	)
}
