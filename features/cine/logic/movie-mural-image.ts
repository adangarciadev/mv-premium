/**
 * Draws the shareable poster wall.
 *
 * A second composition in the same visual world as the review card: the same ground, the same
 * two typefaces, the same hairline-bordered posters, the same tier colour on a score. Every
 * coordinate comes from `movie-mural-layout`; nothing here computes a position.
 */
import { cover, HEAVY_FONT, loadImage, roundedRect, truncateToWidth, UI_FONT } from './canvas-utils'
import { getMovieRatingTier } from './movie-review'
import { getMovieReviewStats } from './movie-review-list'
import { getMuralGeometry, MURAL_PADDING, MURAL_SCORE_STRIP, type MuralGeometry } from './movie-mural-layout'
import type { MovieReviewRecord } from './movie-review-store'

export interface MuralData {
	records: MovieReviewRecord[]
	title: string
	username: string
	avatarUrl?: string
	/** How many the selection had to leave out, so the footer can say so. */
	omittedCount: number
}

/** Matches the card's poster corner, so both compositions round the same way. */
const POSTER_RADIUS = 9
const POSTER_BORDER = 'rgba(255,255,255,.16)'
const PLACEHOLDER_FILL = 'rgba(255,255,255,.06)'
const PLACEHOLDER_INK = '#77737a'

const TITLE_INK = '#fff'
const BYLINE_INK = '#aaa7ad'
const FOOTER_INK = '#9d9ca3'
const FOOTER_STRONG_INK = '#f1f0ed'
const RULE = 'rgba(255,255,255,.10)'

const AVATAR_SIZE = 44

function formatRating(rating: number): string {
	return String(rating).replace('.', ',')
}

/** The card's ground, stretched to whatever height the wall needs. */
function drawGround(ctx: CanvasRenderingContext2D, geometry: MuralGeometry) {
	const base = ctx.createLinearGradient(0, 0, geometry.width, geometry.height)
	base.addColorStop(0, '#090a0d')
	base.addColorStop(0.7, '#121116')
	base.addColorStop(1, '#060608')
	ctx.fillStyle = base
	ctx.fillRect(0, 0, geometry.width, geometry.height)
}

function drawHeader(
	ctx: CanvasRenderingContext2D,
	geometry: MuralGeometry,
	data: MuralData,
	avatar: HTMLImageElement | null
) {
	const left = MURAL_PADDING
	const right = geometry.width - MURAL_PADDING
	const centreY = MURAL_PADDING + 58

	// The byline is measured first so the title knows how much room it actually has.
	ctx.font = `600 18px ${UI_FONT}`
	const bylineWidth = ctx.measureText(data.username).width
	const bylineBlock = bylineWidth + (avatar ? AVATAR_SIZE + 12 : 0)

	ctx.textBaseline = 'middle'
	ctx.font = `900 44px ${HEAVY_FONT}`
	ctx.fillStyle = TITLE_INK
	ctx.fillText(truncateToWidth(ctx, data.title, right - left - bylineBlock - 40), left, centreY)

	if (avatar) {
		const avatarX = right - AVATAR_SIZE
		ctx.save()
		ctx.beginPath()
		ctx.arc(avatarX + AVATAR_SIZE / 2, centreY, AVATAR_SIZE / 2, 0, Math.PI * 2)
		ctx.clip()
		cover(ctx, avatar, avatarX, centreY - AVATAR_SIZE / 2, AVATAR_SIZE, AVATAR_SIZE)
		ctx.restore()

		ctx.textAlign = 'right'
		ctx.font = `600 18px ${UI_FONT}`
		ctx.fillStyle = BYLINE_INK
		ctx.fillText(data.username, avatarX - 12, centreY)
		ctx.textAlign = 'left'
	} else {
		ctx.textAlign = 'right'
		ctx.font = `600 18px ${UI_FONT}`
		ctx.fillStyle = BYLINE_INK
		ctx.fillText(data.username, right, centreY)
		ctx.textAlign = 'left'
	}
}

function drawPoster(
	ctx: CanvasRenderingContext2D,
	geometry: MuralGeometry,
	record: MovieReviewRecord,
	poster: HTMLImageElement | null,
	x: number,
	y: number
) {
	const { posterWidth, posterHeight } = geometry

	if (poster) {
		ctx.save()
		roundedRect(ctx, x, y, posterWidth, posterHeight, POSTER_RADIUS)
		ctx.clip()
		cover(ctx, poster, x, y, posterWidth, posterHeight)
		ctx.restore()
	} else {
		// A film with no poster gets its title, never an empty hole.
		ctx.fillStyle = PLACEHOLDER_FILL
		roundedRect(ctx, x, y, posterWidth, posterHeight, POSTER_RADIUS)
		ctx.fill()

		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'
		ctx.font = `800 ${Math.max(11, Math.round(posterWidth * 0.075))}px ${UI_FONT}`
		ctx.fillStyle = PLACEHOLDER_INK
		ctx.fillText(truncateToWidth(ctx, record.title, posterWidth - 16), x + posterWidth / 2, y + posterHeight / 2)
		ctx.textAlign = 'left'
	}

	// Elevation is declared once, as the card does it: a hairline, never a border plus a shadow.
	roundedRect(ctx, x, y, posterWidth, posterHeight, POSTER_RADIUS)
	ctx.strokeStyle = POSTER_BORDER
	ctx.lineWidth = 1
	ctx.stroke()
}

function drawScore(
	ctx: CanvasRenderingContext2D,
	geometry: MuralGeometry,
	record: MovieReviewRecord,
	x: number,
	y: number
) {
	const size = Math.min(24, Math.max(15, Math.round(geometry.posterWidth * 0.11)))

	ctx.textAlign = 'center'
	ctx.textBaseline = 'middle'
	ctx.font = `900 ${size}px ${HEAVY_FONT}`
	ctx.fillStyle = getMovieRatingTier(record.rating).accent
	ctx.fillText(
		formatRating(record.rating),
		x + geometry.posterWidth / 2,
		y + geometry.posterHeight + MURAL_SCORE_STRIP / 2
	)
	ctx.textAlign = 'left'
}

/**
 * One line of fact, with the hierarchy carried by weight rather than by boxes. Three stat
 * blocks with big numbers and small labels is the template every dashboard already uses.
 */
function drawFooter(ctx: CanvasRenderingContext2D, geometry: MuralGeometry, data: MuralData) {
	const stats = getMovieReviewStats(data.records)
	const y = geometry.height - MURAL_PADDING - 30
	const left = MURAL_PADDING
	const maxWidth = geometry.width - MURAL_PADDING * 2

	ctx.beginPath()
	ctx.moveTo(left, y - 30)
	ctx.lineTo(geometry.width - MURAL_PADDING, y - 30)
	ctx.strokeStyle = RULE
	ctx.lineWidth = 1
	ctx.stroke()

	const segments: { text: string; strong: boolean }[] = [
		{ text: `${stats.count}`, strong: true },
		{ text: stats.count === 1 ? ' película' : ' películas', strong: false },
	]

	if (stats.averageRating !== null) {
		segments.push({ text: '  ·  media ', strong: false }, { text: formatRating(stats.averageRating), strong: true })
	}

	if (stats.best) {
		segments.push({ text: '  ·  la mejor, ', strong: false }, { text: stats.best.title, strong: true })
	}

	if (data.omittedCount > 0) {
		segments.push({ text: `  ·  y ${data.omittedCount} más fuera`, strong: false })
	}

	ctx.textBaseline = 'middle'

	// Measured in full first, so an overlong film title is what gets trimmed, not the figures.
	const setFont = (strong: boolean) => {
		ctx.font = strong ? `900 20px ${HEAVY_FONT}` : `500 17px ${UI_FONT}`
	}

	let total = 0
	for (const segment of segments) {
		setFont(segment.strong)
		total += ctx.measureText(segment.text).width
	}

	let cursor = left
	for (const segment of segments) {
		setFont(segment.strong)
		ctx.fillStyle = segment.strong ? FOOTER_STRONG_INK : FOOTER_INK
		const text = total > maxWidth ? truncateToWidth(ctx, segment.text, maxWidth - (cursor - left)) : segment.text
		ctx.fillText(text, cursor, y)
		cursor += ctx.measureText(text).width
	}
}

async function drawMural(ctx: CanvasRenderingContext2D, data: MuralData): Promise<void> {
	const geometry = getMuralGeometry(data.records.length)

	const [avatar, ...posters] = await Promise.all([
		loadImage(data.avatarUrl),
		...data.records.map(record => loadImage(record.posterUrl)),
	])

	drawGround(ctx, geometry)
	drawHeader(ctx, geometry, data, avatar)

	data.records.forEach((record, index) => {
		const x = geometry.cellX(index, data.records.length)
		const y = geometry.cellY(index)
		drawPoster(ctx, geometry, record, posters[index] ?? null, x, y)
		drawScore(ctx, geometry, record, x, y)
	})

	drawFooter(ctx, geometry, data)
}

/** Renders straight onto a visible canvas, for the live preview. */
export async function renderMovieMural(canvas: HTMLCanvasElement, data: MuralData): Promise<void> {
	const geometry = getMuralGeometry(data.records.length)
	canvas.width = geometry.width
	canvas.height = geometry.height

	const ctx = canvas.getContext('2d')
	if (!ctx) throw new Error('No se pudo preparar el lienzo del mural')

	ctx.clearRect(0, 0, geometry.width, geometry.height)
	await drawMural(ctx, data)
}

/** Renders offscreen and encodes, for upload and download. */
export async function createMovieMuralImage(data: MuralData): Promise<Blob> {
	const geometry = getMuralGeometry(data.records.length)
	const canvas = document.createElement('canvas')
	canvas.width = geometry.width
	canvas.height = geometry.height

	const ctx = canvas.getContext('2d')
	if (!ctx) throw new Error('No se pudo preparar el lienzo del mural')

	await drawMural(ctx, data)

	return new Promise((resolve, reject) => {
		canvas.toBlob(blob => {
			if (blob) resolve(blob)
			else reject(new Error('No se pudo generar la imagen del mural'))
		}, 'image/png')
	})
}
