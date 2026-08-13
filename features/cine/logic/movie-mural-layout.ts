/**
 * Geometry and selection for the shareable poster wall.
 *
 * Pure maths, kept apart from the renderer so the wall's proportions can be reasoned about and
 * tested without a canvas. The renderer never computes a coordinate itself.
 */
import { filterMovieReviews, sortMovieReviews } from './movie-review-list'
import type { MovieReviewRecord } from './movie-review-store'

export const MURAL_WIDTH = 1200
export const MURAL_PADDING = 40
export const MURAL_GAP = 16
export const MURAL_HEADER_HEIGHT = 132
export const MURAL_FOOTER_HEIGHT = 96

/**
 * The band under each poster carrying its score.
 *
 * The score sits below the artwork rather than on it. A wall is read as a ranking, and scores
 * on a shared baseline can be compared at a glance, where a chip over each poster lands
 * wherever that poster's composition allows.
 */
export const MURAL_SCORE_STRIP = 34

/** Posters are 2:3, the standard film poster ratio TMDB serves. */
export const POSTER_RATIO = 3 / 2

/**
 * Past this the wall stops being an image and becomes a scroll inside a thread. A larger
 * selection shows the best of it and says how many were left out.
 */
export const MURAL_MAX_POSTERS = 42

const MIN_COLUMNS = 4
const MAX_COLUMNS = 8

export interface MuralSelection {
	/** A year present in the collection, or 'all'. */
	year: string
	/** Keep only the top N by score, or null for everything. */
	limit: number | null
}

export interface MuralGeometry {
	width: number
	height: number
	columns: number
	rows: number
	posterWidth: number
	posterHeight: number
	/** Poster plus its score strip. */
	cellHeight: number
	/** Left edge of the cell at this index, centring a partial last row. */
	cellX(index: number, count: number): number
	/** Top edge of the poster at this index. */
	cellY(index: number): number
}

/**
 * Columns grow as the square root of twice the count, which lands about two columns per row.
 * Since a poster is one and a half times taller than it is wide, that keeps the finished image
 * near square across the whole range instead of drifting into a ribbon or a tower.
 */
export function getMuralColumns(count: number): number {
	if (count <= 0) return MIN_COLUMNS
	return Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, Math.ceil(Math.sqrt(count * 2))))
}

export function getMuralGeometry(count: number): MuralGeometry {
	const columns = getMuralColumns(count)
	const rows = count <= 0 ? 0 : Math.ceil(count / columns)

	const contentWidth = MURAL_WIDTH - MURAL_PADDING * 2
	const posterWidth = (contentWidth - (columns - 1) * MURAL_GAP) / columns
	const posterHeight = posterWidth * POSTER_RATIO
	const cellHeight = posterHeight + MURAL_SCORE_STRIP

	const gridHeight = rows === 0 ? 0 : rows * cellHeight + (rows - 1) * MURAL_GAP
	const height = MURAL_HEADER_HEIGHT + gridHeight + MURAL_FOOTER_HEIGHT + MURAL_PADDING * 2

	return {
		width: MURAL_WIDTH,
		height,
		columns,
		rows,
		posterWidth,
		posterHeight,
		cellHeight,
		cellX(index: number, total: number) {
			const row = Math.floor(index / columns)
			const column = index % columns
			const isLastRow = row === Math.ceil(total / columns) - 1
			const inThisRow = isLastRow ? total - row * columns : columns

			// A short final row is centred, so the wall never ends on a ragged right edge.
			const rowWidth = inThisRow * posterWidth + (inThisRow - 1) * MURAL_GAP
			const rowStart = MURAL_PADDING + (contentWidth - rowWidth) / 2

			return rowStart + column * (posterWidth + MURAL_GAP)
		},
		cellY(index: number) {
			const row = Math.floor(index / columns)
			return MURAL_PADDING + MURAL_HEADER_HEIGHT + row * (cellHeight + MURAL_GAP)
		},
	}
}

/**
 * The films the wall will show: filtered by year, ranked by score, capped.
 *
 * Always sorted by score descending. A grid of posters reads as a ranking whether or not it was
 * meant to, so it may as well be one.
 */
export function selectMuralReviews(records: MovieReviewRecord[], selection: MuralSelection): MovieReviewRecord[] {
	const filtered = filterMovieReviews(records, { year: selection.year, badge: 'all' })
	const ranked = sortMovieReviews(filtered, 'rating')
	const limit = Math.min(selection.limit ?? MURAL_MAX_POSTERS, MURAL_MAX_POSTERS)

	return ranked.slice(0, limit)
}
