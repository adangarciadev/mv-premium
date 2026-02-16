/**
 * Mediavida CSS Selectors - Centralized Constants
 *
 * This file contains all CSS selectors used to interact with Mediavida's DOM.
 * Groupings follow the logical structure of the website.
 *
 * SELECTOR FORMAT:
 * - All selectors include the CSS prefix ('#' for IDs, '.' for classes)
 * - Use directly with querySelector: `document.querySelector(MV_SELECTORS.EDITOR.TEXTAREA)`
 * - For getElementById, use the _ID variant without '#': `MV_SELECTORS.EDITOR.POST_EDITOR_ID`
 *
 * This differs from DOM_MARKERS which stores raw names WITHOUT prefixes.
 *
 * NAMING CONVENTIONS:
 * - UPPER_SNAKE_CASE for all keys
 * - Descriptive names that reflect UI purpose, not implementation
 * - Comments for non-obvious selectors
 */

export const MV_SELECTORS = {
	// ============================================================================
	// GLOBAL / LAYOUT
	// ============================================================================
	GLOBAL: {
		/** Body element */
		BODY: 'body',
		/** Main header/navbar */
		HEADER: '#cabecera',
		/** Hidden input containing CSRF token */
		TOKEN_INPUT: '#token',
		TOKEN_INPUT_ID: 'token',
		/** Base URL hidden input (for thread URLs) */
		BASE_URL_INPUT: '#base_url',
		BASE_URL_INPUT_ID: 'base_url',
		/** Side navigation panel */
		SIDE_NAV: '#side-nav',
		SIDE_NAV_ID: 'side-nav',
		/** Right column wrapper on forum/subforum layouts */
		C_SIDE: '.c-side',
		/** Thread companion sidebar */
		THREAD_COMPANION: '#thread-companion',
		THREAD_COMPANION_ID: 'thread-companion',
		/** More actions container */
		MORE_ACTIONS: '#more-actions',
		MORE_ACTIONS_ID: 'more-actions',
		/** Preview button */
		PREVIEW_BUTTON: '#btpreview',
		PREVIEW_BUTTON_ID: 'btpreview',
		/** Preview container */
		PREVIEW_CONTAINER: '#preview',
		PREVIEW_CONTAINER_ID: 'preview',
		/** Submit button inside preview modal ("Editar") */
		PREVIEW_SUBMIT_BUTTON: '#prsubmit',
		PREVIEW_SUBMIT_BUTTON_ID: 'prsubmit',
		/** Submit button */
		SUBMIT_BUTTON: '#btsubmit',
		SUBMIT_BUTTON_ID: 'btsubmit',
		/** Forum navigation bar */
		FORUM_NAV: '.forum-nav',
		FORUM_NAV_ALT: '.cf.mpad.mg-b',
		/** Header search container */
		SEARCH: '#buscar',
		/** Pull right utility class */
		PULL_RIGHT: '.pull-right',
		/** User menu in header */
		USERMENU: '#usermenu',
		/** Avatar wrapper in user menu */
		USERMENU_AVATAR: 'li.avw',
		/** Main wrapper */
		MAIN_WRAPPER: '#main.wrp',
		/** Generic wrapper */
		WRAPPER: '.wrp',
		/** Content wrapper */
		CONTENT_WRAPPER: '.wrw',
		/** Content container */
		CONTENT_CONTAINER: '.wpx',
		/** Main content area */
		MAIN_CONTENT: '.c-main',
		/** Full width tables */
		FULL_WIDTH_TABLE: 'table.mv.full',
		/** Posts container (legacy/alt) */
		POSTS_ALT: '#posts',
		/** Post button (generic) */
		POST_BTN: '.post-btn',
		/** Post button icons */
		POST_BTN_ICON: '.post-btn i',
	},

	// ============================================================================
	// THREAD PAGE (Hilos)
	// ============================================================================
	THREAD: {
		/** Container for all posts */
		POSTS_CONTAINER: '#posts-wrap',
		/** Container ID (for getElementById) */
		POSTS_CONTAINER_ID: 'posts-wrap',
		/** Single post element */
		POST: '.post[data-num]',
		/** Alternative post selector (replies) */
		POST_REPLY: '.rep[data-num]',
		/** Combined post selector (main + replies) */
		POST_ALL: '.post[data-num], .rep[data-num]',
		/** Posts inside container */
		POSTS_IN_CONTAINER: '#posts-wrap .post[data-num]',
		/** Post with alternative ID format */
		POST_DIV: 'div[id^="post-"]',
		/** Post content wrapper */
		POST_CONTENTS: '.post-contents',
		/** Post body text */
		POST_BODY: '.post-contents .body',
		/** Alternative post body */
		POST_BODY_ALT: '.post-body',
		POST_BODY_LEGACY: '.cuerpo',
		/** Combined body selectors */
		POST_BODY_ALL: '.post-contents .body, .post-body, .cuerpo',
		/** Post header section */
		POST_HEADER: '.post-header',
		/** Post metadata container */
		POST_META: '.post-meta',
		/** Post author link */
		POST_AUTHOR: '.post-header .autor',
		POST_AUTHOR_ALT: '.post-meta .autor',
		POST_AUTHOR_LINK: 'a.autor',
		/** Combined author selectors */
		POST_AUTHOR_ALL: '.post-header .autor, .post-meta .autor, a.autor',
		/** Post avatar container */
		POST_AVATAR: '.post-avatar',
		/** Post avatar image */
		POST_AVATAR_IMG: '.post-avatar img',
		/** Reply avatar container */
		POST_AVATAR_REPLY: '.post-avatar-reply',
		/** Post timestamp */
		POST_TIME: 'time',
		POST_TIME_ALT: '.date',
		POST_TIME_DATA: '[data-time]',
		/** Post like button and count */
		POST_LIKE_BTN: '.btnmola',
		POST_LIKE_COUNT: '.btnmola span',
		/** Reply metadata container */
		POST_META_REPLY: '.post-meta-reply',
		/** Thread title (h1) */
		THREAD_TITLE: '#topic h1',
		THREAD_TITLE_ALT: '.hd h1',
		THREAD_TITLE_LEGACY: 'h1.title',
		THREAD_TITLE_HEADER: '.thread-header h1',
		/** Combined thread title selectors */
		THREAD_TITLE_ALL: '#topic h1, .hd h1, h1.title, .thread-header h1',
		/** Thread headlink (brand) */
		THREAD_HEADLINK: '#title h1 a.headlink',
		THREAD_HEADLINK_ALT: '.brand h1 a.headlink',
		/** Subforum section in brand */
		BRAND_SUBFORUM: '.brand .section a',
		/** Subforum title */
		SUBFORUM_TITLE: 'h2.tit',
		SUBFORUM_PATH: '.path a:last-of-type',
		SUBFORUM_RUTA: '.ruta a:last-of-type',
		/** Combined subforum selectors */
		SUBFORUM_ALL: 'h2.tit, .path a:last-of-type, .ruta a:last-of-type',
		/** Pagination elements */
		PAGINATION: '.pags',
		PAGINATION_LIST: '.pg',
		PAGINATION_SIDE: '.side-pages',
		/** Combined pagination selectors */
		PAGINATION_ALL: '.pg, .side-pages, .pags',
		/** Current page indicator */
		PAGINATION_CURRENT: '.pg .current, .pags .current',
		/** Pagination links */
		PAGINATION_LINKS: '.pg a, .pags a',
		/** Quick reply form */
		QUICK_REPLY: '.quickreply',
		QUICK_REPLY_ALT: '#topic-reply',
		/** Combined quick reply selectors */
		QUICK_REPLY_ALL: '.quickreply, #topic-reply',
		/** Bottom progress indicator */
		BOTTOM_PROGRESS: '.bottom-progress',
		/** Main wrapper */
		MAIN_WRAPPER: '#main.wrp',
		/** Generic wrapper */
		WRAPPER: '.wrp',
		/** Content wrapper */
		CONTENT_WRAPPER: '.wrw',
		/** Content container */
		CONTENT_CONTAINER: '.wpx',
		/** Main content area */
		MAIN_CONTENT: '.c-main',
		/** Full width tables */
		FULL_WIDTH_TABLE: 'table.mv.full',
		/** Posts container (legacy/alt) */
		POSTS_ALT: '#posts',
		/** Post button (generic) */
		POST_BTN: '.post-btn',
		/** Post button icons */
		POST_BTN_ICON: '.post-btn i',
	},

	// ============================================================================
	// EDITOR
	// ============================================================================
	EDITOR: {
		/** Main textarea */
		TEXTAREA: 'textarea#cuerpo',
		TEXTAREA_ID: 'cuerpo',
		/** Textarea by name */
		TEXTAREA_NAME: 'textarea[name="cuerpo"]',
		/** Combined textarea selectors */
		TEXTAREA_ALL: 'textarea#cuerpo, textarea[name="cuerpo"], .editor-body textarea',
		/** Post editor container */
		POST_EDITOR: '#post-editor',
		POST_EDITOR_ID: 'post-editor',
		/** Submit button */
		SUBMIT: 'button[name="Submit"]',
		/** Inline save button */
		SAVE_BUTTON: '.saveButton',
		/** Thread title input (nuevo-hilo form) */
		TITLE_INPUT: '#cabecera',
		/** Thread category select (nuevo-hilo form) */
		CATEGORY_SELECT: '#tag',
		/** Editor body container */
		EDITOR_BODY: '.editor-body',
		/** Editor body textarea */
		EDITOR_BODY_TEXTAREA: '.editor-body textarea',
		/** Editor controls/toolbar */
		EDITOR_CONTROLS: '.editor-controls',
		EDITOR_TOOLBAR: '.editor-toolbar',
		TOOLBAR: '.toolbar',
		/** Editor placeholder */
		EDITOR_PLACEHOLDER: '.placeholder',
		EDITOR_PLACEHOLDER_ALT: '.editor-placeholder',
		/** Editor meta (footer with buttons) */
		EDITOR_META: '.editor-meta',
		/** Text wrap container (around textarea) */
		TEXT_WRAP: '.text-wrap',
		/** Control container */
		CONTROL: '.control',
		/** Postform */
		POSTFORM: '#postform',
		POSTFORM_ID: 'postform',
		/** Formbox container */
		FORMBOX: '#formbox',
		FORMBOX_ID: 'formbox',
		/** Inline-edit textarea (double-click quick edit on posts) */
		INLINE_EDIT: 'textarea.inline-edit',
	},

	// ============================================================================
	// BOOKMARKS
	// ============================================================================
	BOOKMARKS: {
		/** Bookmark card element */
		CARD: '.block.cf.post',
		/** Bookmark card title link */
		TITLE_LINK: '.post-meta h1 a',
		/** Bookmark card content */
		CONTENTS: '.post-contents',
		/** Bookmark card time */
		TIME: '.post-meta .rd',
		/** Post bookmark element by composite ID */
		postById: (pid: string) => `#post-${pid}`,
	},

	// ============================================================================
	// USER / PROFILE
	// ============================================================================
	USER: {
		/** Author link in posts and profiles */
		AUTHOR_LINK: 'a.autor[href^="/id/"]',
		/** Author name generic selector */
		AUTHOR_NAME: '.autor',
		/** Author link in post meta */
		POST_META_AUTHOR: '.post-meta a.autor[href^="/id/"]',
		/** Author link in post avatar */
		POST_AVATAR_AUTHOR: '.post-avatar a[href^="/id/"]',
		/** Combined author link selectors */
		AUTHOR_ALL: 'a.autor[href^="/id/"], .post-meta a.autor[href^="/id/"], .post-avatar a[href^="/id/"]',
		/** Native tag/badge span */
		NATIVE_TAG: '.ct',
		/** User data container (header) */
		USER_DATA: '#user-data',
		USER_DATA_ID: 'user-data',
	},

	// ============================================================================
	// FORUM LIST / SUBFORUM
	// ============================================================================
	FORUM: {
		/** Forum list container */
		FORUMS_LIST: 'ul.forums',
		/** Single forum link */
		FORUM_LINK: 'ul.forums > li > a.forum',
		/** Thread row in thread list */
		THREAD_ROW: 'tbody#temas tr[id^="t"]',
		/** Thread list table */
		THREAD_TABLE: '#tablatemas',
		/** Thread list tbody */
		THREAD_TBODY: 'tbody#temas',
		/** Thread title link (unread) */
		THREAD_TITLE_LINK: 'td.col-th a.h',
		/** Thread title link (read) */
		THREAD_TITLE_LINK_READ: 'td.col-th a.hb',
	},

	// ============================================================================
	// USER PROFILE
	// ============================================================================
	PROFILE: {
		/** Profile tabs container */
		TABS_CONTAINER: '.c-main > .cf.mpad.mg-b',
		/** Main content wrapper */
		CONTENT_WRAPPER: '.c-main > .wpx',
		/** Hero controls (settings link) */
		HERO_CONTROLS: '.hero-controls',
		/** Settings link in hero */
		SETTINGS_LINK: '.hero-controls a[href="/configuracion"]',
	},

	// ============================================================================
	// PRIVATE MESSAGES (PM)
	// ============================================================================
	MESSAGES: {
		/** Flyout message list */
		FLYOUT_LIST: '.flypos ul.mps li',
		/** Flyout username */
		FLYOUT_USERNAME: 'span.stuff strong',
		/** PM list in inbox */
		PM_LIST: '#pms a.message',
		PM_LIST_ALT: '.threads7 a.message',
		/** PM info excerpt */
		PM_INFO: '.excerpt .pm-info strong',
		/** Individual PM item */
		PM_ITEM: '#msgs > li.pm',
		PM_ITEM_ALT: 'ul.pm-list > li.pm',
		/** PM author link */
		PM_AUTHOR: '.wrap .pm-info a.autor',
		/** PM content wrapper */
		PM_CONTENT: '.pm-content',
		/** PM wrap element */
		PM_WRAP: '.wrap',
		/** PM Reply Textarea */
		TEXTAREA: 'textarea[name="msg"]',
	},

	// ============================================================================
	// POST ELEMENTS (inside posts)
	// ============================================================================
	POST_ELEMENTS: {
		/** Spoiler tags */
		SPOILER: '.sp',
		SPOILER_ALT: '.spoiler',
		SPOILER_WILDCARD: '[class*="spoiler"]',
		/** Blockquote */
		QUOTE: 'blockquote.quote',
		/** Code blocks */
		CODE: 'code[class*="language-"]',
		CODE_PRE: 'pre.code code',
		/** User crown/tag */
		USER_TAG: '.ct',
		/** Content wrap */
		WRAP: '.wrap',
	},

	// ============================================================================
	// EXTENSION INJECTED ELEMENTS (mvp-*)
	// ============================================================================
	EXTENSION: {
		/** User note badge */
		USER_NOTE: '.mvp-user-note',
		/** User badge */
		USER_BADGE: '.mvp-user-badge',
		/** Native user tag */
		USER_TAG_NATIVE: '.mvp-user-tag-native',
		/** Mute placeholder */
		MUTE_PLACEHOLDER: '.mvp-mute-placeholder',
		/** Reveal button in mute placeholder */
		REVEAL_BTN: '.mvp-reveal-btn',
		/** Customized element marker (attribute selector) */
		CUSTOMIZED_ATTR: '[mvp-customized]',
		/** Ignored user marker */
		IGNORED_USER: '.mvp-ignored-user',
		/** Ignored message marker */
		IGNORED_MESSAGE: '.mvp-ignored-message',
		/** Checkbox wrapper */
		CHECKBOX_WRAPPER: '.mvp-checkbox-wrapper',
		/** Row delete cell */
		DELETE_CELL: '.mvp-delete-cell',
		/** Gallery trigger button */
		GALLERY_TRIGGER: '#mvp-gallery-trigger',
		/** Gallery root container */
		GALLERY_ROOT: '#mvp-gallery-root',
		/** Live thread containers */
		LIVE_HEADER_UI: '#mvp-live-header-ui',
		LIVE_EDITOR_WRAPPER: '#mvp-live-editor-wrapper',
		LIVE_MAIN_CONTAINER: '#mvp-live-main-container',
		LIVE_HEADER_CONTAINER: '#mvp-live-header-container',
		LIVE_BUTTON_CONTAINER: '#mvp-live-button-container',
		/** Infinite scroll sentinel */
		INFINITE_SENTINEL: '#mvp-infinite-scroll-sentinel',
		INFINITE_INDICATOR: '#mvp-infinite-scroll-indicator',
	},

	FAVORITES: {
		/** Favorites table */
		TABLE: '#tablatemas',
		/** Favorites tbody */
		TBODY: 'tbody#temas',
		/** Thread row by ID */
		threadRowById: (tid: string) => `#t${tid}`,
		/** Thread row wildcard */
		THREAD_ROW_WILDCARD: 'tr[id^="t"]',
		/** Thread title link */
		THREAD_TITLE_LINK: 'td.col-th a',
		/** Next page button */
		NEXT_PAGE_BTN: 'a[title="Siguiente"]',
		/** Pagination container */
		PAGINATION: 'ul.pg',
		PAGINATION_BOTTOM: '.pull-right .pg',
		PAGINATION_TOP: '.cf.mpad.mg-b .pg',
	},
} as const

// ============================================================================
// HELPER TYPES
// ============================================================================

/** Type for all static string selectors */
export type MVSelector = string

/** Dynamic selector functions */
export const MVDynamicSelectors = {
	/** Get post element by post number */
	postByNum: (num: string | number) => `.post[data-num="${num}"]`,
	/** Get thread row by thread ID */
	threadRow: (tid: string) => `#t${tid}`,
	/** Get post by ID */
	postById: (pid: string) => `#post-${pid}`,
} as const
