/**
 * Feature IDs Registry
 *
 * Centralized constants for React Mount Features.
 * Used by mountFeature() and isFeatureMounted().
 */

export const FEATURE_IDS = {
	// Single Instance Features
	SIDEBAR_FAVORITES: 'mvp-favorite-subforums-sidebar',
	SIDEBAR_PINNED: 'mvp-pinned-posts-sidebar',
	BOOKMARKS_MANAGER: 'mvp-bookmarks-manager',
	FAVORITE_SUBFORUM_PAGE_BTN: 'mvp-favorite-subforum-page-btn',
	GALLERY_MODAL: 'mvp-gallery-modal',
	COMMAND_MENU: 'mvp-command-menu',
	FAVORITES_ACTION_BAR: 'mvp-favorites-action-bar',
	THREAD_SUMMARIZER_MODAL: 'mvp-thread-summarizer-modal',
	SAVE_THREAD_BUTTON: 'mvp-save-thread-button',
	SAVED_THREADS_PROFILE: 'mvp-saved-threads-profile',
	WIKI_POSTS_PROFILE: 'mvp-wiki-posts-profile',
	LIVE_THREAD_BUTTON: 'mvp-live-thread-button',
	LIVE_THREAD_HEADER: 'mvp-live-thread-header',
	INFINITE_SCROLL_INDICATOR: 'mvp-infinite-scroll-indicator',
	INFINITE_SCROLL_BUTTON: 'mvp-infinite-scroll-button',
	MEDIA_HOVER_CARD: 'mvp-media-hover-card',

	// Dynamic Feature Prefixes (used with ID/Counter)
	FAVORITE_SUBFORUM_BTN_PREFIX: 'mvp-favorite-subforum-btn-',
	POST_SUMMARY_POPOVER_PREFIX: 'mvp-post-summary-popover-',
	TOOLBAR_PREFIX: 'mvp-distributed-toolbar-',
	TOOLBAR_FALLBACK_PREFIX: 'mvp-distributed-toolbar-fallback-',
	TOOLBAR_STATE_PREFIX: 'mvp-toolbar-state-',
	DRAFT_MANAGER_PREFIX: 'mvp-draft-manager-',
	INFINITE_SCROLL_DIVIDER_PREFIX: 'mvp-infinite-scroll-divider-',
} as const
