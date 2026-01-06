/**
 * Content script modules index
 * Re-exports all modules for easy importing
 *
 * NOTE: Logic files have been moved to features/{feature}/logic/
 * This file re-exports from features for backwards compatibility
 */

// Utils (kept in lib/content-modules/utils/)
export {
	isForumListPage,
	isSubforumPage,
	isThreadPage,
	isNewThreadPage,
	isCineForum,
	isSportsForum,
	isFavoritesPage,
	isSpyPage,
	isForumGlobalViewPage,
	isBookmarksPage,
	isProfileSubpage,
	getForumCategory,
	getThreadIdFromUrl,
} from './utils/page-detection'
export {
	mountFeature,
	mountFeatureWithBoundary,
	updateFeature,
	unmountFeature,
	isFeatureMounted,
	getFeatureRoot,
	getMountedFeatures,
	createContainer,
	isAlreadyInjected,
	markAsInjected,
} from './utils/react-helpers'
export { createDebouncedObserver, observeDocument, disconnectObserver } from './utils/mutation-observer'

// Feature modules - re-exported from features/
export {
	injectPinButtons,
	injectPinnedPostsSidebar,
	initPinButtonsObserver,
} from '@/features/pinned-posts/logic/pin-posts'
export {
	injectEditorToolbar,
	injectDraftAutosave,
	injectCharacterCounter,
	injectPasteHandler,
} from '@/features/editor/logic/editor-toolbar'
export { injectEditorContentPreservation } from '@/features/editor/logic/editor-content-preserve'
export { applyMutedWordsFilter, clearAllMutedOverlays } from '@/features/muted-words/logic/muted-words'
export { injectFavoritesPageButtons } from '@/features/favorites'
export {
	injectFavoriteSubforumButtons,
	injectFavoriteSubforumsSidebar,
} from '@/features/favorite-subforums/logic/favorite-subforum-inject'
export { injectInfiniteScroll } from '@/features/infinite-scroll'
export { injectLiveThreadButton } from '@/features/live-thread'
export { injectBookmarksUI } from '@/features/bookmarks'
export { injectNewThreadButton } from '@/features/new-thread/logic/new-thread-inject'
export { injectSaveDraftButton } from '@/features/drafts'
