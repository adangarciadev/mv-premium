/**
 * Which of the two ways of looking at the collection Mediaffinity is showing.
 *
 * 'gallery' → the posters, large, to walk through what you have seen.
 * 'diary'   → rows, dense, to find and compare.
 *
 * They are opposites on purpose: one is for recorrer, the other for encontrar. A third mode that
 * sat between them would only make both worse.
 *
 * Stored under its own lightweight key rather than in the settings store, mirroring the activity
 * view mode: it is a dashboard-only preference and has no business in what the content script
 * hydrates on every page of the forum.
 */
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'

export type MovieReviewView = 'gallery' | 'diary'

const MOVIE_REVIEWS_VIEW_KEY = `local:${STORAGE_KEYS.MOVIE_REVIEWS_VIEW}` as `local:${string}`

export const movieReviewViewStorage = storage.defineItem<MovieReviewView>(MOVIE_REVIEWS_VIEW_KEY, {
	defaultValue: 'gallery',
})

export async function getMovieReviewView(): Promise<MovieReviewView> {
	return (await movieReviewViewStorage.getValue()) === 'diary' ? 'diary' : 'gallery'
}

export async function setMovieReviewView(view: MovieReviewView): Promise<void> {
	await movieReviewViewStorage.setValue(view)
}
