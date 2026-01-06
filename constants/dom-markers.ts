/**
 * Centralized DOM Markers
 *
 * Stores all data-attributes, classes, and IDs used for DOM injection and tracking.
 * Prevents string duplication and collisions.
 *
 * NAMING CONVENTION:
 * - ALL values start with 'mvp-' prefix (for export/import search compatibility)
 * - DATA_ATTRS: For use with element.setAttribute(key, 'true') or element.hasAttribute(key)
 * - IDS: Store WITHOUT '#' prefix (for getElementById and element.id assignment)
 * - CLASSES: Store WITHOUT '.' prefix (for classList.add/remove/contains)
 * - For querySelector, add the prefix manually: `.${DOM_MARKERS.CLASSES.X}` or `#${DOM_MARKERS.IDS.X}`
 *
 * This differs from MV_SELECTORS which stores FULL selectors including prefixes.
 */

export const DOM_MARKERS = {
	// Data Attributes (all start with mvp-)
	DATA_ATTRS: {
		// Editor
		TOOLBAR: 'mvp-toolbar',
		PASTE: 'mvp-paste',
		INJECTED: 'mvp-injected',
		COUNTER: 'mvp-counter',
		DRAFT: 'mvp-draft',
		SAVE_DRAFT_BTN: 'mvp-save-draft-btn',
		PRESERVE: 'mvp-preserve',
		HIDDEN: 'mvp-hidden',
		HIGHLIGHTED: 'mvp-highlighted',
		// Post
		PIN_INJECTED: 'mvp-pin-injected',
		SUMMARY_INJECTED: 'mvp-summary-injected',
		MUTED_REVEALED: 'mvp-muted-revealed',
		// Injection Status
		FAV_SUBFORUM_INJECTED: 'mvp-favorite-subforum-injected',
		BOOKMARKS_INJECTED: 'mvp-bookmarks-injected',
		FAV_INJECTED: 'mvp-fav-injected',
		NEW_THREAD_INJECTED: 'mvp-new-thread-injected',
		SEARCH_REPLACED: 'mvp-search-replaced',
		USER_CUSTOMIZED: 'mvp-customized',
	},

	// CSS Classes (all start with mvp-)
	CLASSES: {
		// User Customizations
		IGNORED_USER: 'mvp-ignored-user',
		IGNORED_MESSAGE: 'mvp-ignored-message',
		MUTED_USER: 'mvp-muted-user',
		MUTE_PLACEHOLDER: 'mvp-mute-placeholder',
		REVEAL_BTN: 'mvp-reveal-btn',
		USER_NOTE: 'mvp-user-note',
		USER_TAG_NATIVE: 'mvp-user-tag-native',
		USER_BADGE: 'mvp-user-badge',
		USER_CARD_ACTIONS: 'mvp-user-actions',
		BTN_ACTIVE: 'mvp-btn-active',
		// Muted Words
		MUTED_CONTAINER: 'mvp-muted-container',
		MUTED_QUOTE: 'mvp-muted-quote',
		MUTED_OVERLAY: 'mvp-muted-overlay',
		// Favorites
		FAV_CHECKBOX: 'mvp-fav-cb',
		DASHBOARD_INJECTED: 'mvp-dashboard-injected',
		// Editor
		CHAR_COUNTER: 'mvp-char-counter',
		DRAFT_HOST: 'mvp-draft-host',
		TOOLBAR_CONTAINER: 'mvp-toolbar-container',
		TOOLBAR_GROUP: 'mvp-toolbar-group',
		TOOLBAR_BTN: 'mvp-toolbar-btn',
		TOOLBAR_ITEM: 'mvp-toolbar-item',
		// Sidebar
		PINNED_SIDEBAR: 'mvp-pinned-sidebar',
		FAVORITE_SUBFORUM_BTN_CONTAINER: 'mvp-favorite-subforum-btn-container',
		// Infinite Scroll
		INFINITE_DIVIDER_CONTAINER: 'mvp-infinite-scroll-divider-container',
		INFINITE_PAGE_BLOCK: 'mvp-infinite-page-block',
		INFINITE_PAGE_PLACEHOLDER: 'mvp-infinite-page-placeholder',
		INFINITE_SCROLL_BTN: 'mvp-infinite-scroll-btn',
		// Feature Error
		FEATURE_ERROR: 'mvp-feature-error',
	},

	// Custom Events (all start with mvp: or mvp-)
	EVENTS: {
		CONTENT_INJECTED: 'mvp-content-injected',
		COMMAND_MENU_TRIGGER: 'mvp:trigger-command-menu',
		COMMAND_MENU_OPEN: 'mvp:open-command-menu',
		LIVE_MODE_CHANGED: 'mvp:live-mode-changed',
		INFINITE_SCROLL_MODE_CHANGED: 'mvp:infinite-scroll-mode-changed',
		// Draft events
		SAVE_DRAFT: 'mvp-save-draft',
		OPEN_DRAFTS: 'mvp-open-drafts',
		// Feature events
		PIN_CHANGED: 'mvp-pin-changed',
		FAVORITE_SUBFORUMS_CHANGED: 'mvp-favorite-subforums-changed',
	},

	// DOM IDs
	IDS: {
		// Sidebars
		FAVORITES_SIDEBAR_CONTAINER: 'mvp-favorite-subforums-sidebar',
		DRAFT_STATUS_CONTAINER: 'mvp-draft-status-inline',
		// Command Menu
		COMMAND_MENU: 'mvp-command-menu-container',
		COMMAND_MENU_TRIGGER: 'mvp-search-trigger',
		// Theme
		DYNAMIC_THEME: 'mvp-dynamic-theme',
		GLOBAL_THEME_VARS: 'mvp-global-theme-vars',
		GLOBAL_SCROLLBAR: 'mvp-global-scrollbar-override',
		GLOBAL_FONT: 'mvp-global-font-override',
		EARLY_FONT: 'mvp-early-font-override',
		GOOGLE_FONT: 'mvp-google-font',
		// Features
		EXTRA_ACTIONS: 'mvp-extra-actions',
		ULTRAWIDE_STYLES: 'mvp-ultrawide-styles',
		USER_CUSTOMIZATIONS_STYLES: 'mvp-user-customizations-styles',
		SUMMARIZER_BTN: 'mvp-summarizer-btn',
		SUMMARIZER_MODAL: 'mvp-summarizer-modal-container',
		BOOKMARKS_MANAGER: 'mvp-bookmarks-manager',
		SAVE_THREAD_CONTAINER: 'mvp-save-thread-container',
		SAVED_THREADS_TAB: 'mvp-saved-threads-tab',
		SAVED_THREADS_CONTENT: 'mvp-saved-threads-content',
		WIKI_POSTS_TAB: 'mvp-wiki-posts-tab',
		WIKI_POSTS_CONTENT: 'mvp-wiki-posts-content',
		NEW_THREAD_BUTTON: 'mvp-new-thread-button',
		NEW_THREAD_DROPDOWN: 'mvp-new-thread-dropdown',
		WHATS_NEW_BADGE: 'mvp-whats-new-badge',
		// Gallery
		GALLERY_BTN: 'mvp-gallery-btn',
		GALLERY_TRIGGER: 'mvp-gallery-trigger',
		GALLERY_ROOT: 'mvp-gallery-root',
		// Infinite Scroll
		INFINITE_SENTINEL: 'mvp-infinite-scroll-sentinel',
		INFINITE_INDICATOR: 'mvp-infinite-scroll-indicator',
		INFINITE_DEBUG_STYLES: 'mvp-infinite-debug-styles',
		INFINITE_DEBUG_PANEL: 'mvp-infinite-debug-panel',
		// Favorites Page
		FAV_STYLES: 'mvp-fav-styles',
		FAV_SELECT_ALL: 'mvp-fav-select-all',
		FAV_BAR_CONTAINER: 'mvp-fav-bar-container',
		// Shadow DOM
		SHADOW_HOST: 'mvp-shadow-host',
		SHADOW_CONTENT: 'mvp-shadow-content',
		// Live Thread
		LIVE_MAIN_CONTAINER: 'mvp-live-main-container',
		LIVE_HEADER_UI: 'mvp-live-header-ui',
		LIVE_EDITOR_WRAPPER: 'mvp-live-editor-wrapper',
		LIVE_BUTTON_CONTAINER: 'mvp-live-button-container',
		INFINITE_SCROLL_BUTTON_CONTAINER: 'mvp-infinite-scroll-button-container',
		// Media Hover
		MEDIA_HOVER_CARD_CONTAINER: 'mvp-media-hover-card-container',
		// Active Button Styles
		BTN_STYLES_DARK: 'mvp-btn-styles-dark',
		BTN_STYLES_LIGHT: 'mvp-btn-styles-light',
	},

	// Live Thread CSS Classes (prefix: mvp-live-)
	LIVE_THREAD: {
		TRANSITIONING: 'mvp-live-transitioning',
		READY: 'mvp-live-ready',
		NEW_POST: 'mvp-live-new-post',
		HEADER: 'mvp-live-header',
		STATUS: 'mvp-live-status',
		DOT: 'mvp-live-dot',
		LABEL: 'mvp-live-label',
		ACTIONS: 'mvp-live-actions',
		BTN: 'mvp-live-btn',
		TOGGLE_BTN: 'mvp-live-toggle-btn',
		FOOTER: 'mvp-live-footer',
		BTN_SUBMIT: 'mvp-live-btn-submit',
		LINK_EXTENDED: 'mvp-live-link-extended',
	},

	// Storage Keys (prefix: mvp-)
	STORAGE_KEYS: {
		PROFILE: 'mvp-profile',
		ACTIVITY: 'mvp-activity',
		DRAFTS: 'mvp-drafts',
		PINNED_PREFIX: 'mvp-pinned-',
		PINNED_META_PREFIX: 'mvp-pinned-meta-',
		FAVORITE_SUBFORUMS: 'mvp-favorite-subforums',
	},

	// ====== DEPRECATED (keeping for backwards compat, migrate to DATA_ATTRS) ======
	/** @deprecated Use DATA_ATTRS instead */
	EDITOR: {
		TOOLBAR: 'mvp-toolbar',
		PASTE: 'mvp-paste',
		GENERIC_INJECTED: 'mvp-injected',
		COUNTER: 'mvp-counter',
		DRAFT: 'mvp-draft',
		SAVE_DRAFT_BTN: 'mvp-save-draft-btn',
	},
	/** @deprecated Use DATA_ATTRS instead */
	POST: {
		PIN_INJECTED: 'mvp-pin-injected',
		SUMMARY_INJECTED: 'mvp-summary-injected',
		MUTED_REVEALED: 'mvp-muted-revealed',
	},
	/** @deprecated Use DATA_ATTRS instead */
	INJECTION: {
		FAVORITE_SUBFORUM: 'mvp-favorite-subforum-injected',
		BOOKMARKS: 'mvp-bookmarks-injected',
		FAVORITES: 'mvp-fav-injected',
		NEW_THREAD: 'mvp-new-thread-injected',
		SEARCH_REPLACED: 'mvp-search-replaced',
	},
} as const
