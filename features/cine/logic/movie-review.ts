export type MovieRatingTier = 'must-see' | 'recommended' | 'interesting' | 'not-recommended'

/**
 * A tier is purely the colour temperature of a score. The written verdict lives in the badge,
 * which the user confirms — see `getSuggestedMovieReviewBadge`.
 */
export interface MovieRatingTierConfig {
	id: MovieRatingTier
	min: number
	accent: string
}

export const MOVIE_RATING_TIERS: readonly MovieRatingTierConfig[] = [
	{ id: 'must-see', min: 9, accent: '#f6c945' },
	{ id: 'recommended', min: 7, accent: '#eab308' },
	{ id: 'interesting', min: 5, accent: '#c4b98e' },
	{ id: 'not-recommended', min: 0, accent: '#a8a29e' },
] as const

export const MOVIE_REVIEW_QUOTE_MAX_LENGTH = 160

export type MovieReviewBadge =
	| 'masterpiece'
	| 'must-see'
	| 'recommended'
	| 'interesting'
	| 'guilty-pleasure'
	| 'disappointing'
	| 'not-recommended'
	| 'terrible'

export interface MovieReviewBadgeConfig {
	id: MovieReviewBadge
	label: string
	background: string
	border: string
	text: string
}

/**
 * Ordered from the warmest verdict to the coldest; the picker renders them in this order, so the
 * row reads as a ramp and the suggested one sits where the score puts it.
 */
export const MOVIE_REVIEW_BADGES: readonly MovieReviewBadgeConfig[] = [
	{
		id: 'masterpiece',
		label: 'OBRA MAESTRA',
		background: 'rgba(201,156,51,.18)',
		border: 'rgba(246,201,69,.55)',
		text: '#f6d778',
	},
	{
		id: 'must-see',
		label: 'IMPRESCINDIBLE',
		background: 'rgba(176,132,35,.16)',
		border: 'rgba(234,179,43,.48)',
		text: '#edc95f',
	},
	{
		id: 'recommended',
		label: 'RECOMENDADA',
		background: 'rgba(151,117,24,.14)',
		border: 'rgba(207,166,48,.42)',
		text: '#dfc06b',
	},
	{
		id: 'interesting',
		label: 'INTERESANTE',
		background: 'rgba(135,130,113,.14)',
		border: 'rgba(184,177,151,.35)',
		text: '#c8c1a8',
	},
	{
		id: 'guilty-pleasure',
		label: 'PLACER CULPABLE',
		background: 'rgba(115,82,126,.15)',
		border: 'rgba(161,117,174,.36)',
		text: '#c9a8d2',
	},
	{
		id: 'disappointing',
		label: 'DECEPCIONANTE',
		background: 'rgba(133,91,48,.14)',
		border: 'rgba(179,128,72,.38)',
		text: '#c9a178',
	},
	{
		id: 'not-recommended',
		label: 'NO RECOMENDADA',
		background: 'rgba(104,107,112,.16)',
		border: 'rgba(151,155,163,.34)',
		text: '#b6bac2',
	},
	{
		id: 'terrible',
		label: 'MALÍSIMA',
		background: 'rgba(104,48,48,.16)',
		border: 'rgba(154,82,82,.38)',
		text: '#c99a9a',
	},
] as const

export function getMovieReviewBadge(badge: MovieReviewBadge | null): MovieReviewBadgeConfig | null {
	return badge ? MOVIE_REVIEW_BADGES.find(option => option.id === badge) ?? null : null
}

/**
 * The verdict a score implies, so the picker can preselect one and the user confirms rather than
 * invents. `guilty-pleasure` is never suggested on purpose: it is the one verdict whose whole point
 * is to contradict the number.
 */
const SUGGESTED_BADGE_BY_RATING: readonly { min: number; badge: MovieReviewBadge }[] = [
	{ min: 9.5, badge: 'masterpiece' },
	{ min: 8.5, badge: 'must-see' },
	{ min: 7, badge: 'recommended' },
	{ min: 5, badge: 'interesting' },
	{ min: 3.5, badge: 'disappointing' },
	{ min: 2, badge: 'not-recommended' },
	{ min: 0, badge: 'terrible' },
] as const

export function getSuggestedMovieReviewBadge(rating: number): MovieReviewBadge {
	const normalized = Number.isFinite(rating) ? rating : 0
	const band = SUGGESTED_BADGE_BY_RATING.find(option => normalized >= option.min)
	return (band ?? SUGGESTED_BADGE_BY_RATING[SUGGESTED_BADGE_BY_RATING.length - 1]!).badge
}

export function getMovieRatingTier(rating: number): MovieRatingTierConfig {
	const normalized = Number.isFinite(rating) ? rating : 0
	return MOVIE_RATING_TIERS.find(tier => normalized >= tier.min) ?? MOVIE_RATING_TIERS[MOVIE_RATING_TIERS.length - 1]!
}

export function normalizeMovieRating(rating: number): number {
	return Math.min(10, Math.max(0.5, Math.round(rating * 2) / 2))
}

export function normalizeMovieReviewQuote(quote: string): string {
	const normalized = quote.trim().replace(/\s+/g, ' ')
	if (normalized.length <= MOVIE_REVIEW_QUOTE_MAX_LENGTH) return normalized
	return `${normalized.slice(0, MOVIE_REVIEW_QUOTE_MAX_LENGTH - 1).trimEnd()}…`
}

export function buildMovieMetadata(director: string, year: string, genres: string[]): string {
	const safeDirector = director.trim() && director !== 'Desconocido' ? director.trim() : ''
	return [safeDirector, year.trim(), ...genres.filter(Boolean).slice(0, 2)].filter(Boolean).join(' · ')
}

export interface MovieReviewCardData {
	title: string
	director: string
	year: string
	genres: string[]
	posterUrl: string | null
	backdropUrl: string | null
	rating: number | null
	quote: string
	username: string
	avatarUrl?: string
	badge: MovieReviewBadge | null
}
