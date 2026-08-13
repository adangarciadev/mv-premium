/**
 * Store for movie review cards the user has generated.
 *
 * Identity is `imageId`, never the URL: the matching logic cannot trust the full URL, and
 * having two notions of identity in one feature is how records end up duplicated.
 *
 * Published state is derived from `publication !== null` and is deliberately not stored as
 * its own field, so it can never disagree with the data it describes.
 */
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'
import { logger } from '@/lib/logger'
import { extractImageId } from './movie-review-image-id'
import type { MovieReviewBadge, MovieReviewCardData } from './movie-review'

export interface MovieReviewPublication {
	threadUrl: string
	threadTitle: string
	postNumber: string
	confirmedAt: number
}

export interface MovieReviewRecord {
	/** Normalised identifier extracted from the uploaded URL. Primary key. */
	imageId: string
	/** Original uploaded URL, kept for reference and for rendering the thumbnail. */
	imageUrl: string
	tmdbId: number
	title: string
	year: string
	posterUrl: string | null
	rating: number
	badge: MovieReviewBadge | null
	quote: string
	createdAt: number
	source: 'generated' | 'imported'
	publication: MovieReviewPublication | null
}

const MOVIE_REVIEWS_KEY = `local:${STORAGE_KEYS.MOVIE_REVIEWS}` as const

export const movieReviewsStorage = storage.defineItem<MovieReviewRecord[]>(MOVIE_REVIEWS_KEY, {
	defaultValue: [],
})

/**
 * Persisted data can be older than the current shape, or corrupt. A record that fails this
 * check is dropped rather than allowed to crash the dashboard.
 */
function isValidRecord(value: unknown): value is MovieReviewRecord {
	if (!value || typeof value !== 'object') return false
	const record = value as Partial<MovieReviewRecord>

	return (
		typeof record.imageId === 'string' &&
		record.imageId.length > 0 &&
		typeof record.imageUrl === 'string' &&
		typeof record.title === 'string' &&
		typeof record.rating === 'number' &&
		Number.isFinite(record.rating) &&
		typeof record.createdAt === 'number'
	)
}

function sortRecords(records: MovieReviewRecord[]): MovieReviewRecord[] {
	return [...records].sort((a, b) => b.createdAt - a.createdAt)
}

export async function getMovieReviews(): Promise<MovieReviewRecord[]> {
	const stored = await movieReviewsStorage.getValue()
	if (!Array.isArray(stored)) return []
	return sortRecords(stored.filter(isValidRecord))
}

export async function saveMovieReviews(records: MovieReviewRecord[]): Promise<void> {
	await movieReviewsStorage.setValue(sortRecords(records.filter(isValidRecord)))
}

/** Inserts the record, or replaces the existing one carrying the same identifier. */
export async function upsertMovieReview(record: MovieReviewRecord): Promise<MovieReviewRecord[]> {
	const records = await getMovieReviews()
	const index = records.findIndex(existing => existing.imageId === record.imageId)

	if (index === -1) {
		records.push(record)
	} else {
		records[index] = { ...records[index], ...record }
	}

	await saveMovieReviews(records)
	return sortRecords(records)
}

/** Returns false when no record carries that identifier. */
export async function confirmMovieReviewPublication(
	imageId: string,
	publication: MovieReviewPublication
): Promise<boolean> {
	const records = await getMovieReviews()
	const index = records.findIndex(record => record.imageId === imageId)
	if (index === -1) return false

	records[index] = { ...records[index], publication }
	await saveMovieReviews(records)
	return true
}

export async function deleteMovieReview(imageId: string): Promise<boolean> {
	const records = await getMovieReviews()
	const next = records.filter(record => record.imageId !== imageId)
	if (next.length === records.length) return false

	await saveMovieReviews(next)
	return true
}

/** Records still waiting to be found in a published post. */
export async function getPendingMovieReviews(): Promise<MovieReviewRecord[]> {
	return (await getMovieReviews()).filter(record => record.publication === null)
}

export function watchMovieReviews(callback: (records: MovieReviewRecord[]) => void): () => void {
	return movieReviewsStorage.watch(newValue => {
		callback(sortRecords(Array.isArray(newValue) ? newValue.filter(isValidRecord) : []))
	})
}

/**
 * Turns the dialog's card data into a pending record, or null when the review cannot be
 * tracked: an unusable identifier would never confirm, and an unrated card is not a review.
 */
export function buildGeneratedReviewRecord(
	cardData: MovieReviewCardData,
	tmdbId: number,
	imageUrl: string,
	now: number = Date.now()
): MovieReviewRecord | null {
	const imageId = extractImageId(imageUrl)
	if (imageId === null || cardData.rating === null) return null

	return {
		imageId,
		imageUrl,
		tmdbId,
		title: cardData.title,
		year: cardData.year,
		posterUrl: cardData.posterUrl,
		rating: cardData.rating,
		badge: cardData.badge,
		quote: cardData.quote,
		createdAt: now,
		source: 'generated',
		publication: null,
	}
}

/**
 * Records a freshly uploaded review. Never throws: the card is the user's goal and the log
 * is secondary, so a storage failure must not break insertion.
 */
export async function recordGeneratedMovieReview(
	cardData: MovieReviewCardData,
	tmdbId: number,
	imageUrl: string
): Promise<void> {
	try {
		const record = buildGeneratedReviewRecord(cardData, tmdbId, imageUrl)
		if (!record) return
		await upsertMovieReview(record)
	} catch (error) {
		logger.error('No se pudo registrar la crítica generada', error)
	}
}

export interface ImportedReviewInput {
	imageUrl: string
	tmdbId: number
	title: string
	year: string
	posterUrl: string | null
	rating: number
	badge: MovieReviewBadge | null
	publication: MovieReviewPublication
}

/**
 * Builds a record for a card published before this feature existed. It arrives already
 * published, because the message it came from is where we found it.
 *
 * The quote stays empty: it is drawn into the PNG as pixels and cannot be read back. Asking
 * the user to retype it would be asking them to transcribe their own screenshot.
 */
export function buildImportedReviewRecord(
	input: ImportedReviewInput,
	now: number = Date.now()
): MovieReviewRecord | null {
	const imageId = extractImageId(input.imageUrl)
	if (imageId === null) return null

	return {
		imageId,
		imageUrl: input.imageUrl,
		tmdbId: input.tmdbId,
		title: input.title,
		year: input.year,
		posterUrl: input.posterUrl,
		rating: input.rating,
		badge: input.badge,
		quote: '',
		createdAt: now,
		source: 'imported',
		publication: input.publication,
	}
}

/**
 * Corrects a record's data, typically after an import picked the wrong film.
 *
 * Publication details are deliberately outside the allowed changes: they are observed facts
 * about a message, not something the user should be able to retype.
 */
export async function updateMovieReview(
	imageId: string,
	changes: Partial<Pick<MovieReviewRecord, 'tmdbId' | 'title' | 'year' | 'posterUrl' | 'rating' | 'badge' | 'quote'>>
): Promise<boolean> {
	const records = await getMovieReviews()
	const index = records.findIndex(record => record.imageId === imageId)
	if (index === -1) return false

	records[index] = { ...records[index], ...changes }
	await saveMovieReviews(records)
	return true
}
