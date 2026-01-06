/**
 * Favorite Subforums Feature - Barrel Export
 */

// Components
export { FavoriteSubforumButton } from './components/favorite-subforum-button'
export { FavoriteSubforumsPanel } from './components/favorite-subforums-panel'
export { FavoriteSubforumsSidebar } from './components/favorite-subforums-sidebar'

// Hooks
export { useFavoriteSubforums, useIsSubforumFavorite } from './hooks/use-favorite-subforums'

// Logic (content script injection)
export {
	injectFavoriteSubforumButtons,
	cleanupFavoriteSubforumButtons,
	injectFavoriteSubforumsSidebar,
	cleanupFavoriteSubforumsSidebar,
} from './logic/favorite-subforum-inject'
