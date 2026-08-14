/**
 * Geometry and figures for the shareable recap.
 *
 * Everything here is countable. Letterboxd's year in review shows totals, repetitions and
 * dates, never a personal "top" ranked by rating — a list of scores does not yield a top
 * without inventing a tie-breaker. This follows that rule: how you score, who and what repeats
 * and how often, and the two ends of the period.
 *
 * Pure maths, kept apart from the renderer so the composition can be tested without a canvas.
 */
import { countUniqueMovies, getMovieReviewStats } from './movie-review-list'
import type { MovieReviewRecord } from './movie-review-store'

/**
 * Exactly twice Mediavida's 648px post width, so the browser halves it on an integer boundary
 * instead of resampling at an awkward fraction.
 */
export const RECAP_WIDTH = 1296
export const RECAP_PADDING = 48

/** The whole image is a card, so its corners are rounded and its edge is drawn. */
export const RECAP_RADIUS = 26

/**
 * One band per half point, because that is the resolution the scores are actually given in.
 *
 * Ten whole-point bands folded every half up into the point above it: a 7,5 was drawn as an eight,
 * and someone who scores almost everything on the halves saw a distribution that was not theirs.
 * Twenty bands is the same scale at the granularity it is voted on.
 */
export const RATING_BAND_COUNT = 20

/** The step each band covers. Scores are normalised to this in `normalizeMovieRating`. */
export const RATING_BAND_STEP = 0.5

/** Ground showing between cells. One pixel — half a pixel at the size a post displays it. */
const CELL_GAP = 1

/** How many entries each ranking column shows. */
export const RANKING_SIZE = 4

/** Direction, cast and genre. A fourth joins them only when there is something repeated to show. */
export const RANKING_COLUMN_COUNT = 3

const SECTION_GAP = 26

const TITLE_BLOCK_HEIGHT = 96
const FACTS_HEIGHT = 70
/**
 * The footprint's own rhythm, all of it measured from the section's label baseline.
 *
 * The peak sits beside that label rather than beside the band, which is what lets the band run the
 * full content width — and a band that reaches both edges reads as one piece instead of a chart
 * parked in a column. It costs the card some height, and that is the trade.
 */
const CHART_TOP_GAP = 30
const PEAK_VALUE_OFFSET = 46
/**
 * Close under the peak's own line rather than a section away from it.
 *
 * Stacking the caption, the score and the count on three lines reserved so much height that the
 * band ended up marooned at the bottom of the section, and the score read as a fourth headline
 * figure rather than as the name of the gold cell. Two lines put it within reach of the thing it
 * describes.
 */
const STRIP_OFFSET = 62
/** The footprint is a band, not a plot: its height is a constant, not a scale. */
const STRIP_HEIGHT = 58
const AXIS_OFFSET = 24
const LEGEND_OFFSET = 48
const RANKING_LABEL_HEIGHT = 28
const RANKING_ROW_HEIGHT = 42
const RANKING_COLUMN_GAP = 32
const ENDS_LABEL_HEIGHT = 28
const ENDS_CARD_PADDING = 16
const ENDS_POSTER_WIDTH = 128
const ENDS_POSTER_HEIGHT = 192
/** Sized so the poster clears its own padding exactly, rather than by eye. */
const ENDS_CARD_HEIGHT = ENDS_POSTER_HEIGHT + ENDS_CARD_PADDING * 2
const ENDS_CARD_GAP = 32
const ENDS_TEXT_GAP = 18

export interface RatingBand {
	/** The score this band holds: 0,5 · 1 · 1,5 … 10. Also its label on the axis. */
	band: number
	count: number
}

export interface RankedEntry {
	name: string
	count: number
}

export interface RecapGeometry {
	width: number
	height: number
	radius: number
	contentLeft: number
	contentRight: number
	titleY: number
	subtitleY: number
	identityY: number
	factsRuleTopY: number
	factsY: number
	factsRuleBottomY: number
	chartLabelY: number
	/** The most repeated score, right-aligned: its caption, then score and count on one line. */
	peakCaptionY: number
	peakValueY: number
	/** The intensity strip: one cell per half point, all of them the same width. */
	stripTop: number
	stripBottom: number
	stripHeight: number
	stripWidth: number
	cellWidth: number
	cellX(index: number): number
	/** Baseline of the numbers under the strip. */
	axisY: number
	/** Baseline of the line that explains the grey. */
	legendY: number
	rankingLabelY: number
	rankingTop: number
	rankingColumnWidth: number
	rankingRowHeight: number
	rankingX(column: number): number
	rankingRowY(row: number): number
	endsLabelY: number
	endsTop: number
	endsCardWidth: number
	endsCardHeight: number
	endsCardX(index: number): number
	posterWidth: number
	posterHeight: number
	endsTextX(index: number): number
	endsTextWidth: number
}

/**
 * Counts per band. Every band is present even when empty, because the gaps in a distribution
 * say as much as the peaks: nothing below a six is a real finding about how someone scores.
 */
export function getRatingHistogram(records: MovieReviewRecord[]): RatingBand[] {
	const counts = new Array<number>(RATING_BAND_COUNT).fill(0)

	for (const record of records) {
		// Scores run 0,5 to 10 in half points, so each one has a band of its own. A rating that
		// somehow arrives off the half is pulled to the nearest one rather than rounded up a whole
		// point, which is what used to turn every 7,5 into an eight.
		const index = Math.round(record.rating / RATING_BAND_STEP) - 1
		counts[Math.min(RATING_BAND_COUNT - 1, Math.max(0, index))] += 1
	}

	return counts.map((count, index) => ({ band: (index + 1) * RATING_BAND_STEP, count }))
}

/** The tallest band, or null when there is nothing to highlight. */
export function getPeakBand(bands: RatingBand[]): RatingBand | null {
	return bands.reduce<RatingBand | null>(
		(top, band) => (band.count > 0 && (!top || band.count > top.count) ? band : top),
		null
	)
}

/**
 * The most repeated names with how often each appears.
 *
 * The count is the point: "Villeneuve" alone is trivia, "Villeneuve · 3" is a fact about the
 * period. Ties keep the order they were first seen, which is stable across renders.
 */
export function getRanking(values: string[], size: number = RANKING_SIZE): RankedEntry[] {
	const counts = new Map<string, number>()

	for (const value of values) {
		const clean = value.trim()
		if (clean) counts.set(clean, (counts.get(clean) ?? 0) + 1)
	}

	return Array.from(counts, ([name, count]) => ({ name, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, size)
}

export interface FirstAndLast {
	first: MovieReviewRecord | null
	last: MovieReviewRecord | null
}

/**
 * The oldest and newest review in the period.
 *
 * Chosen by when they happened, so ties are impossible and nothing is invented. It is also one
 * of Letterboxd's own panels.
 */
export function getFirstAndLast(records: MovieReviewRecord[]): FirstAndLast {
	if (records.length === 0) return { first: null, last: null }

	const sorted = [...records].sort((a, b) => a.createdAt - b.createdAt)
	const first = sorted[0]
	const last = sorted[sorted.length - 1]

	// With a single review the two would be the same card twice, which says nothing.
	return first === last ? { first, last: null } : { first, last }
}

export interface ReviewDateRange {
	/** ISO date (YYYY-MM-DD), inclusive. Empty means unbounded on that side. */
	from: string
	to: string
}

/**
 * Filters by when the review was written, not by the film's release year.
 *
 * These are different questions and the recap asks the second one: "my cinema, July to August"
 * is about what the user did in that window, whatever decade the films are from.
 */
export function filterByReviewDate(records: MovieReviewRecord[], range: ReviewDateRange): MovieReviewRecord[] {
	const from = range.from ? new Date(`${range.from}T00:00:00`).getTime() : null
	const to = range.to ? new Date(`${range.to}T23:59:59.999`).getTime() : null

	return records.filter(record => {
		if (from !== null && Number.isFinite(from) && record.createdAt < from) return false
		if (to !== null && Number.isFinite(to) && record.createdAt > to) return false
		return true
	})
}

/** The years in which the user actually wrote reviews, newest first. */
export function getReviewYears(records: MovieReviewRecord[]): string[] {
	const years = new Set(records.map(record => String(new Date(record.createdAt).getFullYear())))
	return Array.from(years).sort((a, b) => b.localeCompare(a))
}

/** "JUL – AGO 2026", or a single month when the period does not span one. */
export function getPeriodLabel(records: MovieReviewRecord[]): string | null {
	const { first, last } = getFirstAndLast(records)
	if (!first) return null

	const month = (timestamp: number) =>
		new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(timestamp).replace('.', '').toUpperCase()
	const year = (timestamp: number) => new Date(timestamp).getFullYear()

	const from = first.createdAt
	const to = (last ?? first).createdAt

	if (year(from) !== year(to)) return `${month(from)} ${year(from)} – ${month(to)} ${year(to)}`
	if (month(from) === month(to)) return `${month(from)} ${year(to)}`
	return `${month(from)} – ${month(to)} ${year(to)}`
}

/**
 * Films seen more than once in the period, most repeated first.
 *
 * Only what can be counted here appears: a lone review flagged as a rewatch is a fact about a
 * viewing that happened before any of this, and the period has no number to put beside it.
 */
export function getRewatchRanking(records: MovieReviewRecord[], size: number = RANKING_SIZE): RankedEntry[] {
	const counts = new Map<number, RankedEntry>()

	for (const record of records) {
		const existing = counts.get(record.tmdbId)
		if (existing) existing.count += 1
		else counts.set(record.tmdbId, { name: record.title, count: 1 })
	}

	return Array.from(counts.values())
		.filter(entry => entry.count > 1)
		.sort((a, b) => b.count - a.count)
		.slice(0, size)
}

export function getRecapGeometry(rankingColumns: number = RANKING_COLUMN_COUNT): RecapGeometry {
	const contentLeft = RECAP_PADDING
	const contentRight = RECAP_WIDTH - RECAP_PADDING
	const contentWidth = contentRight - contentLeft

	const titleY = RECAP_PADDING + 30
	const subtitleY = RECAP_PADDING + 70
	const identityY = RECAP_PADDING + 34

	const factsRuleTopY = RECAP_PADDING + TITLE_BLOCK_HEIGHT
	const factsY = factsRuleTopY + FACTS_HEIGHT / 2
	const factsRuleBottomY = factsRuleTopY + FACTS_HEIGHT

	const chartLabelY = factsRuleBottomY + CHART_TOP_GAP
	const stripTop = chartLabelY + STRIP_OFFSET
	const stripBottom = stripTop + STRIP_HEIGHT
	const axisY = stripBottom + AXIS_OFFSET
	const legendY = stripBottom + LEGEND_OFFSET

	// Every cell is the same width, whatever it holds: the whole point of the footprint is that the
	// scale is the constant and only the intensity moves.
	const stripWidth = contentWidth
	const cellWidth = stripWidth / RATING_BAND_COUNT

	const rankingLabelY = legendY + SECTION_GAP
	const rankingTop = rankingLabelY + RANKING_LABEL_HEIGHT
	const columns = Math.max(1, rankingColumns)
	const rankingColumnWidth = (contentWidth - RANKING_COLUMN_GAP * (columns - 1)) / columns

	const endsLabelY = rankingTop + RANKING_ROW_HEIGHT * RANKING_SIZE + SECTION_GAP
	const endsTop = endsLabelY + ENDS_LABEL_HEIGHT
	const endsCardWidth = (contentWidth - ENDS_CARD_GAP) / 2

	const height = endsTop + ENDS_CARD_HEIGHT + RECAP_PADDING

	return {
		width: RECAP_WIDTH,
		height,
		radius: RECAP_RADIUS,
		contentLeft,
		contentRight,
		titleY,
		subtitleY,
		identityY,
		factsRuleTopY,
		factsY,
		factsRuleBottomY,
		chartLabelY,
		peakCaptionY: chartLabelY,
		peakValueY: chartLabelY + PEAK_VALUE_OFFSET,
		stripTop,
		stripBottom,
		stripHeight: STRIP_HEIGHT,
		stripWidth,
		cellWidth: cellWidth - CELL_GAP,
		cellX: (index: number) => contentLeft + index * cellWidth,
		axisY,
		legendY,
		rankingLabelY,
		rankingTop,
		rankingColumnWidth,
		rankingRowHeight: RANKING_ROW_HEIGHT,
		rankingX: (column: number) => contentLeft + column * (rankingColumnWidth + RANKING_COLUMN_GAP),
		rankingRowY: (row: number) => rankingTop + row * RANKING_ROW_HEIGHT,
		endsLabelY,
		endsTop,
		endsCardWidth,
		endsCardHeight: ENDS_CARD_HEIGHT,
		endsCardX: (index: number) => contentLeft + index * (endsCardWidth + ENDS_CARD_GAP),
		posterWidth: ENDS_POSTER_WIDTH,
		posterHeight: ENDS_POSTER_HEIGHT,
		endsTextX: (index: number) =>
			contentLeft + index * (endsCardWidth + ENDS_CARD_GAP) + ENDS_CARD_PADDING + ENDS_POSTER_WIDTH + ENDS_TEXT_GAP,
		endsTextWidth: endsCardWidth - ENDS_CARD_PADDING * 2 - ENDS_POSTER_WIDTH - ENDS_TEXT_GAP,
	}
}

/** Where inside a card the poster sits. */
export const ENDS_CARD_INSET = ENDS_CARD_PADDING

export interface RecapFacts {
	count: number
	/** Distinct films behind those reviews. Equal to the count unless something was rewatched. */
	movies: number
	averageRating: number | null
	/** Total runtime in minutes, when TMDB could be reached. */
	minutes: number | null
	directors: RankedEntry[]
	actors: RankedEntry[]
	genres: RankedEntry[]
	/** Films reviewed more than once. Empty for a collection with nothing repeated. */
	rewatches: RankedEntry[]
}

export function getRecapFacts(
	records: MovieReviewRecord[],
	enrichment: { minutes: number | null; directors: string[]; genres: string[]; actors: string[] }
): RecapFacts {
	const stats = getMovieReviewStats(records)

	return {
		count: stats.count,
		movies: countUniqueMovies(records),
		averageRating: stats.averageRating,
		minutes: enrichment.minutes,
		directors: getRanking(enrichment.directors),
		actors: getRanking(enrichment.actors),
		genres: getRanking(enrichment.genres),
		rewatches: getRewatchRanking(records),
	}
}
