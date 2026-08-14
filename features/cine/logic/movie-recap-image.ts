/**
 * Draws the shareable recap.
 *
 * The same visual world as the review card — dark ground, the same two typefaces, hairline
 * artwork, the gold accent — arranged as a card with rounded corners. Every coordinate comes
 * from `movie-recap-layout`; nothing here computes a position.
 */
import { cover, HEAVY_FONT, loadImage, roundedRect, truncateToWidth, UI_FONT } from './canvas-utils'
import { mapWithConcurrency } from './movie-recap-enrichment'
import {
	ENDS_CARD_INSET,
	getBarHeight,
	getFirstAndLast,
	getPeakBand,
	getRatingHistogram,
	getRecapGeometry,
	type RankedEntry,
	type RecapFacts,
	type RecapGeometry,
} from './movie-recap-layout'
import type { MovieReviewRecord } from './movie-review-store'

export interface RecapData {
	records: MovieReviewRecord[]
	facts: RecapFacts
	title: string
	/** The span the recap covers, already formatted. */
	period: string | null
	/** Directors by TMDB id, for the two films named on their own. */
	directorById?: Map<number, string>
	username: string
	avatarUrl?: string
}

const GROUND = '#0a0a0d'
const ACCENT = '#f6c945'
const ACCENT_SOFT = 'rgba(246,201,69,.14)'
const ACCENT_EDGE = 'rgba(246,201,69,.42)'

/**
 * A neutral, not a faded gold. Gold at low opacity over this ground mixes down to olive, which
 * reads as muddy rather than recessive. This grey is the lightest step that still clears 3:1
 * against the surface, so the bars read as marks while the peak carries all the colour.
 */
const BAR_DIM = '#4c4d57'
const BAR_EMPTY = 'rgba(255,255,255,.09)'
const BAR_EMPTY_HEIGHT = 3
const SURFACE = 'rgba(255,255,255,.055)'
const SURFACE_EDGE = 'rgba(255,255,255,.09)'
const TRACK = 'rgba(255,255,255,.028)'
/** Reserved so a full-length ranking bar never reaches under its own count. */
const RANKING_COUNT_COLUMN = 46

const TITLE_INK = '#fff'
const SUBTITLE_INK = '#8b8792'
const BYLINE_INK = '#e6e4e9'
const LABEL_INK = '#8b8792'
const FACT_INK = '#9d9ca3'
const FACT_STRONG_INK = '#f6f5f3'
const AXIS_INK = '#77737a'
const RULE = 'rgba(255,255,255,.09)'

const POSTER_RADIUS = 7
const POSTER_BORDER = 'rgba(255,255,255,.16)'
const PLACEHOLDER_FILL = 'rgba(255,255,255,.06)'

const AVATAR_SIZE = 46
const BAR_RADIUS = 4
const PILL_RADIUS = 9

function formatRating(rating: number): string {
	return String(rating).replace('.', ',')
}

function formatDate(timestamp: number): string {
	return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(timestamp)
}

/** Canvas has no letter-spacing, so the small caps labels are spaced by hand. */
function spaced(text: string): string {
	return text.split('').join(' ')
}

function drawRule(ctx: CanvasRenderingContext2D, geometry: RecapGeometry, y: number) {
	ctx.beginPath()
	ctx.moveTo(geometry.contentLeft, y + 0.5)
	ctx.lineTo(geometry.contentRight, y + 0.5)
	ctx.strokeStyle = RULE
	ctx.lineWidth = 1
	ctx.stroke()
}

function drawSectionLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
	ctx.textAlign = 'left'
	ctx.textBaseline = 'middle'
	ctx.font = `800 12px ${UI_FONT}`
	ctx.fillStyle = LABEL_INK
	ctx.fillText(spaced(text), x, y)
}

/**
 * The ground: one flat near-black, and nothing else.
 *
 * Three things were tried here. A recognisable still is content the composition cannot
 * control. Blurring it to a colour wash removed the shapes but kept the problem: the tint came
 * from whatever poster happened to be last. And even a plain gradient banded visibly once the
 * image was opened full size, because there are very few distinct values left this close to
 * black — the steps have nowhere to hide.
 *
 * A single fill cannot band. The artwork here is the posters; the ground's job is to vanish.
 */
function drawGround(ctx: CanvasRenderingContext2D, geometry: RecapGeometry) {
	ctx.fillStyle = GROUND
	ctx.fillRect(0, 0, geometry.width, geometry.height)
}

function drawHeader(
	ctx: CanvasRenderingContext2D,
	geometry: RecapGeometry,
	data: RecapData,
	avatar: HTMLImageElement | null
) {
	const left = geometry.contentLeft
	const right = geometry.contentRight

	ctx.textBaseline = 'middle'
	ctx.textAlign = 'right'

	const avatarX = right - AVATAR_SIZE
	if (avatar) {
		ctx.save()
		ctx.beginPath()
		ctx.arc(avatarX + AVATAR_SIZE / 2, geometry.identityY, AVATAR_SIZE / 2, 0, Math.PI * 2)
		ctx.clip()
		cover(ctx, avatar, avatarX, geometry.identityY - AVATAR_SIZE / 2, AVATAR_SIZE, AVATAR_SIZE)
		ctx.restore()

		ctx.beginPath()
		ctx.arc(avatarX + AVATAR_SIZE / 2, geometry.identityY, AVATAR_SIZE / 2, 0, Math.PI * 2)
		ctx.strokeStyle = ACCENT_EDGE
		ctx.lineWidth = 1.5
		ctx.stroke()
	}

	ctx.font = `700 18px ${UI_FONT}`
	ctx.fillStyle = BYLINE_INK
	const nameWidth = ctx.measureText(data.username).width
	ctx.fillText(data.username, avatarX - 14, geometry.identityY - 10)

	ctx.font = `800 11px ${UI_FONT}`
	ctx.fillStyle = ACCENT
	ctx.fillText(spaced('MV PREMIUM'), avatarX - 14, geometry.identityY + 11)

	const identityWidth = nameWidth + AVATAR_SIZE + 14

	ctx.textAlign = 'left'
	ctx.font = `900 52px ${HEAVY_FONT}`
	ctx.fillStyle = TITLE_INK
	ctx.fillText(truncateToWidth(ctx, data.title, right - left - identityWidth - 48), left, geometry.titleY)

	if (data.period) {
		ctx.font = `800 12px ${UI_FONT}`
		ctx.fillStyle = SUBTITLE_INK
		ctx.fillText(spaced(`RESUMEN DE CINE · ${data.period}`), left, geometry.subtitleY)
	}
}

/**
 * The headline figures, number first every time.
 *
 * Reading "18 críticas · 7,5 media" keeps the eye on a column of numbers; putting the label
 * first would make each figure start somewhere different.
 */
function drawFacts(ctx: CanvasRenderingContext2D, geometry: RecapGeometry, facts: RecapFacts, runtime: string | null) {
	drawRule(ctx, geometry, geometry.factsRuleTopY)
	drawRule(ctx, geometry, geometry.factsRuleBottomY)

	const groups: { value: string; label: string; accent?: boolean }[] = [
		{ value: String(facts.count), label: facts.count === 1 ? 'crítica' : 'críticas' },
	]

	if (facts.averageRating !== null) {
		groups.push({ value: formatRating(facts.averageRating), label: 'media', accent: true })
	}

	if (runtime) groups.push({ value: runtime, label: 'de cine' })

	ctx.textAlign = 'left'
	ctx.textBaseline = 'middle'

	let cursor = geometry.contentLeft
	groups.forEach((group, index) => {
		if (index > 0) {
			ctx.font = `500 18px ${UI_FONT}`
			ctx.fillStyle = 'rgba(157,156,163,.5)'
			ctx.fillText('·', cursor, geometry.factsY)
			cursor += ctx.measureText('·').width + 26
		}

		ctx.font = `900 27px ${HEAVY_FONT}`
		ctx.fillStyle = group.accent ? ACCENT : FACT_STRONG_INK
		ctx.fillText(group.value, cursor, geometry.factsY)
		cursor += ctx.measureText(group.value).width + 9

		ctx.font = `500 18px ${UI_FONT}`
		ctx.fillStyle = FACT_INK
		ctx.fillText(group.label, cursor, geometry.factsY)
		cursor += ctx.measureText(group.label).width + 26
	})
}

function drawHistogram(ctx: CanvasRenderingContext2D, geometry: RecapGeometry, records: MovieReviewRecord[]) {
	const bands = getRatingHistogram(records)
	const peak = getPeakBand(bands)
	const peakCount = peak?.count ?? 0

	drawSectionLabel(ctx, 'CÓMO PUNTÚAS', geometry.contentLeft, geometry.chartLabelY + 12)

	const plotHeight = geometry.chartBottom - geometry.chartTop

	bands.forEach((band, index) => {
		const x = geometry.barX(index)
		const isPeak = peak !== null && band.band === peak.band
		const height = getBarHeight(band.count, peakCount, plotHeight)

		if (height > 0) {
			ctx.fillStyle = isPeak ? ACCENT : BAR_DIM
			// Rounded at the data end only; the base stays anchored to the axis.
			roundedRect(ctx, x, geometry.chartBottom - height, geometry.barWidth, height + BAR_RADIUS, BAR_RADIUS)
			ctx.fill()

			ctx.textAlign = 'center'
			ctx.textBaseline = 'bottom'
			ctx.font = `${isPeak ? 900 : 700} ${isPeak ? 21 : 17}px ${isPeak ? HEAVY_FONT : UI_FONT}`
			ctx.fillStyle = isPeak ? ACCENT : FACT_INK
			ctx.fillText(String(band.count), x + geometry.barWidth / 2, geometry.chartBottom - height - 10)
		} else {
			// "You never score below a four" is a finding, so the empty half of the scale has to
			// look measured. Without this it reads as a rendering gap.
			ctx.fillStyle = BAR_EMPTY
			roundedRect(ctx, x, geometry.chartBottom - BAR_EMPTY_HEIGHT, geometry.barWidth, BAR_EMPTY_HEIGHT, 1.5)
			ctx.fill()
		}

		// A tick per band, so the axis reads as a scale rather than a row of loose numbers.
		ctx.beginPath()
		ctx.moveTo(x + geometry.barWidth / 2, geometry.chartBottom + 4)
		ctx.lineTo(x + geometry.barWidth / 2, geometry.axisTickY)
		ctx.strokeStyle = isPeak ? ACCENT_EDGE : RULE
		ctx.lineWidth = 1
		ctx.stroke()

		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'
		ctx.font = `${isPeak ? 800 : 600} 16px ${UI_FONT}`
		ctx.fillStyle = isPeak ? FACT_STRONG_INK : AXIS_INK
		ctx.fillText(String(band.band), x + geometry.barWidth / 2, geometry.axisY)
	})

	ctx.textAlign = 'left'
}

/**
 * One ranking column: who or what repeats, and how many films back it up.
 *
 * The count is the content. A name on its own is trivia; a name with "3" beside it is a fact
 * about the period. Every row sits on a pill so the column reads as a list, and the fill
 * inside it is proportional, so one film does not look like four.
 */
function drawRankingColumn(
	ctx: CanvasRenderingContext2D,
	geometry: RecapGeometry,
	column: number,
	heading: string,
	entries: RankedEntry[]
) {
	const x = geometry.rankingX(column)
	const width = geometry.rankingColumnWidth

	drawSectionLabel(ctx, heading, x, geometry.rankingLabelY + 12)

	if (entries.length === 0) {
		ctx.textAlign = 'left'
		ctx.font = `500 15px ${UI_FONT}`
		ctx.fillStyle = AXIS_INK
		ctx.fillText('Sin datos de TMDB', x, geometry.rankingRowY(0) + geometry.rankingRowHeight / 2)
		return
	}

	const top = entries[0].count
	// The count lives in its own column outside the track, so a full-length bar can never run
	// underneath its own number.
	const trackWidth = width - RANKING_COUNT_COLUMN

	entries.forEach((entry, row) => {
		const y = geometry.rankingRowY(row)
		const rowHeight = geometry.rankingRowHeight - 8
		const centreY = y + geometry.rankingRowHeight / 2
		const isTop = row === 0
		const fillWidth = Math.max(rowHeight, trackWidth * (entry.count / top))

		// An empty track behind every row keeps the column reading as a list; the fill on top is
		// proportional, so one film never looks like four.
		ctx.fillStyle = TRACK
		roundedRect(ctx, x, y + 4, trackWidth, rowHeight, PILL_RADIUS)
		ctx.fill()

		ctx.fillStyle = isTop ? ACCENT_SOFT : SURFACE
		roundedRect(ctx, x, y + 4, fillWidth, rowHeight, PILL_RADIUS)
		ctx.fill()

		if (isTop) {
			roundedRect(ctx, x, y + 4, fillWidth, rowHeight, PILL_RADIUS)
			ctx.strokeStyle = ACCENT_EDGE
			ctx.lineWidth = 1
			ctx.stroke()
		}

		ctx.textAlign = 'right'
		ctx.textBaseline = 'middle'
		ctx.font = `900 19px ${HEAVY_FONT}`
		ctx.fillStyle = isTop ? ACCENT : FACT_INK
		ctx.fillText(String(entry.count), x + width, centreY)

		ctx.textAlign = 'left'
		ctx.font = `${isTop ? 700 : 500} 16px ${UI_FONT}`
		ctx.fillStyle = isTop ? FACT_STRONG_INK : FACT_INK
		ctx.fillText(truncateToWidth(ctx, entry.name, trackWidth - 28), x + 14, centreY)
	})
}

/**
 * The first and last review of the period, side by side as cards.
 *
 * Chosen by when they happened, not by score. A podium ranked on ratings would need a
 * tie-breaker the user never chose, which is what Letterboxd's own recap avoids.
 */
function drawEnds(
	ctx: CanvasRenderingContext2D,
	geometry: RecapGeometry,
	entries: { record: MovieReviewRecord; director: string | null }[],
	posters: (HTMLImageElement | null)[]
) {
	drawSectionLabel(ctx, 'TU PRIMERA Y ÚLTIMA CRÍTICA', geometry.contentLeft, geometry.endsLabelY + 12)

	entries.forEach((entry, index) => {
		const { record, director } = entry
		const cardX = geometry.endsCardX(index)
		const cardY = geometry.endsTop
		const poster = posters[index] ?? null

		ctx.fillStyle = SURFACE
		roundedRect(ctx, cardX, cardY, geometry.endsCardWidth, geometry.endsCardHeight, 14)
		ctx.fill()
		roundedRect(ctx, cardX, cardY, geometry.endsCardWidth, geometry.endsCardHeight, 14)
		ctx.strokeStyle = SURFACE_EDGE
		ctx.lineWidth = 1
		ctx.stroke()

		const posterX = cardX + ENDS_CARD_INSET
		const posterY = cardY + ENDS_CARD_INSET

		if (poster) {
			ctx.save()
			roundedRect(ctx, posterX, posterY, geometry.posterWidth, geometry.posterHeight, POSTER_RADIUS)
			ctx.clip()
			cover(ctx, poster, posterX, posterY, geometry.posterWidth, geometry.posterHeight)
			ctx.restore()
		} else {
			ctx.fillStyle = PLACEHOLDER_FILL
			roundedRect(ctx, posterX, posterY, geometry.posterWidth, geometry.posterHeight, POSTER_RADIUS)
			ctx.fill()
		}

		roundedRect(ctx, posterX, posterY, geometry.posterWidth, geometry.posterHeight, POSTER_RADIUS)
		ctx.strokeStyle = POSTER_BORDER
		ctx.lineWidth = 1
		ctx.stroke()

		const textX = geometry.endsTextX(index)
		const width = geometry.endsTextWidth

		ctx.textAlign = 'left'
		ctx.textBaseline = 'top'

		// No label above the title: the section heading and the reading order already say which
		// end is which, and repeating it on both cards was noise.
		ctx.font = `900 27px ${HEAVY_FONT}`
		ctx.fillStyle = FACT_STRONG_INK
		ctx.fillText(truncateToWidth(ctx, record.title, width), textX, posterY + 2)

		const meta = [record.year, director].filter(Boolean).join('  ·  ')
		if (meta) {
			ctx.font = `500 15px ${UI_FONT}`
			ctx.fillStyle = FACT_INK
			ctx.fillText(truncateToWidth(ctx, meta, width), textX, posterY + 40)
		}

		ctx.font = `900 38px ${HEAVY_FONT}`
		ctx.fillStyle = ACCENT
		ctx.fillText(formatRating(record.rating), textX, posterY + 74)

		// Anchored to the foot of the poster rather than flowing after the score, so both cards
		// end on the same line whatever their titles do.
		ctx.textBaseline = 'bottom'
		ctx.font = `500 14px ${UI_FONT}`
		ctx.fillStyle = LABEL_INK
		ctx.fillText(truncateToWidth(ctx, formatDate(record.createdAt), width), textX, posterY + geometry.posterHeight)
	})

	ctx.textAlign = 'left'
	ctx.textBaseline = 'alphabetic'
}

async function drawRecap(ctx: CanvasRenderingContext2D, data: RecapData, runtime: string | null): Promise<void> {
	// The repeats column only exists when something was repeated, and the row divides the same
	// content width either way — so the columns are laid out from however many there turn out to be.
	const rankings = [
		{ heading: 'DIRECCIÓN', entries: data.facts.directors },
		{ heading: 'INTÉRPRETES', entries: data.facts.actors },
		{ heading: 'GÉNEROS', entries: data.facts.genres },
	]
	if (data.facts.rewatches.length > 0) {
		rankings.push({ heading: 'LO QUE REPITES', entries: data.facts.rewatches })
	}
	const geometry = getRecapGeometry(rankings.length)

	const { first, last } = getFirstAndLast(data.records)
	const entries = [first, last].filter(Boolean).map(record => ({
		record: record as MovieReviewRecord,
		director: data.directorById?.get((record as MovieReviewRecord).tmdbId) ?? null,
	}))

	// Loaded with a ceiling on parallel requests: every one of these crosses into the background
	// service worker, and firing them all at once is how images end up missing.
	const [avatar, posters] = await Promise.all([
		loadImage(data.avatarUrl),
		mapWithConcurrency(entries, 2, entry => loadImage(entry.record.posterUrl)),
	])

	// The whole image is a card, so everything is clipped to its rounded edge.
	ctx.save()
	roundedRect(ctx, 0.5, 0.5, geometry.width - 1, geometry.height - 1, geometry.radius)
	ctx.clip()

	drawGround(ctx, geometry)
	drawHeader(ctx, geometry, data, avatar)
	drawFacts(ctx, geometry, data.facts, runtime)
	drawHistogram(ctx, geometry, data.records)
	rankings.forEach((ranking, column) => drawRankingColumn(ctx, geometry, column, ranking.heading, ranking.entries))
	drawEnds(ctx, geometry, entries, posters)

	ctx.restore()

	roundedRect(ctx, 0.5, 0.5, geometry.width - 1, geometry.height - 1, geometry.radius)
	ctx.strokeStyle = 'rgba(255,255,255,.07)'
	ctx.lineWidth = 1
	ctx.stroke()
}

/**
 * Renders straight onto a visible canvas, for the live preview.
 *
 * The previous frame is deliberately left on screen until the new one paints over it.
 * Assigning canvas.width wipes the canvas even when the value does not change, and the draw
 * that follows waits on image loading, so resizing or clearing on every edit left the preview
 * blank for a beat — which reads as flicker while the user types.
 */
export async function renderMovieRecap(
	canvas: HTMLCanvasElement,
	data: RecapData,
	runtime: string | null
): Promise<void> {
	const geometry = getRecapGeometry()
	if (canvas.width !== geometry.width) canvas.width = geometry.width
	if (canvas.height !== geometry.height) canvas.height = geometry.height

	const ctx = canvas.getContext('2d')
	if (!ctx) throw new Error('No se pudo preparar el lienzo del resumen')

	// No clearRect either: the ground is an opaque fill that covers every pixel.
	await drawRecap(ctx, data, runtime)
}

/** Renders offscreen and encodes, for upload and download. */
export async function createMovieRecapImage(data: RecapData, runtime: string | null): Promise<Blob> {
	const geometry = getRecapGeometry()
	const canvas = document.createElement('canvas')
	canvas.width = geometry.width
	canvas.height = geometry.height

	const ctx = canvas.getContext('2d')
	if (!ctx) throw new Error('No se pudo preparar el lienzo del resumen')

	await drawRecap(ctx, data, runtime)

	return new Promise((resolve, reject) => {
		canvas.toBlob(blob => {
			if (blob) resolve(blob)
			else reject(new Error('No se pudo generar la imagen del resumen'))
		}, 'image/png')
	})
}
