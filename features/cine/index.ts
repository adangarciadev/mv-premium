/**
 * Cine Feature - Unified Export Layer
 *
 * Provides access to the movie template dialogs and editor buttons.
 * Note: Resource-intensive features (hover cards, search) are removed from the root to optimize bundle size.
 */

// Components for editor integration
export { MovieTemplateButton } from './components/movie-template-button'
export { MovieTemplateDialog } from './components/movie-template-dialog'
export { MovieReviewDialog } from './components/movie-review-dialog'

// Review log: which reviews the user generated, and which of them got published
export {
	confirmMovieReviewPublication,
	deleteMovieReview,
	getMovieReviews,
	getPendingMovieReviews,
	recordGeneratedMovieReview,
	watchMovieReviews,
	type MovieReviewPublication,
	type MovieReviewRecord,
} from './logic/movie-review-store'
