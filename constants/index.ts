/**
 * Centralized Constants
 * All magic strings, colors, and URLs should be defined here
 */

// Re-export selectors and other constants
export * from './mediavida-selectors'
export * from './z-indexes'
export * from './feature-ids'
export * from './dom-markers'
export * from './timing'

// =============================================================================
// MEDIAVIDA URLS
// =============================================================================

export const MV_BASE_URL = 'https://www.mediavida.com'

export const MV_URLS = {
	BASE: MV_BASE_URL,
	SEARCH: `${MV_BASE_URL}/buscar`,
	SPY: `${MV_BASE_URL}/foro/spy`,
	FORUM: `${MV_BASE_URL}/foro`,
	USERS_LIST: `${MV_BASE_URL}/usuarios/listado.php`,
	AVATAR_BASE: `${MV_BASE_URL}/img/users/avatar`,
	MESSAGES: `${MV_BASE_URL}/mensajes`,
	NOTIFICATIONS: `${MV_BASE_URL}/notificaciones`,
	FAVORITES: `${MV_BASE_URL}/foro/favoritos`,
	POST_PHP: `${MV_BASE_URL}/foro/post.php`,
	NEW_THREAD: `${MV_BASE_URL}/nuevo-hilo`,
	BOOKMARK_ACTION: `${MV_BASE_URL}/foro/action/bookmark.php`,
	FAVORITE_ACTION: `${MV_BASE_URL}/foro/action/topic_fav.php`,
	BOOKMARKS_PAGE: `${MV_BASE_URL}/foro/marcadores`,
} as const

/**
 * Build user profile URL
 */
export function getUserProfileUrl(username: string): string {
	return `${MV_BASE_URL}/id/${username}`
}

/**
 * Build user bookmarks URL
 */
export function getUserBookmarksUrl(username: string): string {
	return `${MV_BASE_URL}/id/${username}/marcadores`
}

/**
 * Build search URL with query
 */
export function getSearchUrl(query: string): string {
	return `${MV_URLS.SEARCH}?q=${encodeURIComponent(query)}`
}

/**
 * Build subforum URL
 */
export function getSubforumUrl(subforumSlug: string): string {
	return `${MV_URLS.FORUM}/${subforumSlug}`
}

/**
 * Build thread URL with optional page and post anchor
 */
export function getThreadUrl(threadPath: string, page?: number, postNum?: number): string {
	let url = threadPath.startsWith('http') ? threadPath : `${MV_BASE_URL}${threadPath}`
	if (page && page > 1) {
		url += `/${page}`
	}
	if (postNum) {
		url += `#${postNum}`
	}
	return url
}

/**
 * Build avatar URL from avatar ID
 */
export function getAvatarUrl(avatarId: string): string {
	if (!avatarId) return ''
	if (avatarId.startsWith('http')) return avatarId
	return `${MV_URLS.AVATAR_BASE}/${avatarId}`
}

// =============================================================================
// MEDIAVIDA COLORS
// =============================================================================

/**
 * Official Mediavida brand colors
 */
export const MV_COLORS = {
	/** Main orange accent color used for usernames, highlights */
	ORANGE: '#e67e22',
	/** Primary blue used for links and CTAs */
	BLUE: '#00a3d9',
	/** Background dark color */
	BG_DARK: '#1a1a1a',
	/** Card/panel background */
	BG_CARD: '#242526',
	/** Secondary background */
	BG_SECONDARY: '#2d2d2d',
	/** Border color */
	BORDER: 'rgba(255, 255, 255, 0.1)',
} as const

/**
 * Default role colors for user badges
 */
export const MV_ROLE_COLORS = {
	ADMIN: '#539be2',
	SUBADMIN: '#87ca02',
	MOD: '#dc6f5b',
	USER: '#b3c3d3',
} as const

// =============================================================================
// EXTENSION STORAGE KEYS
// =============================================================================

export * from './storage-keys'

// Style/Element IDs used in DOM
export const DOM_IDS = {
	THEME_STYLE: 'mvp-theme-style',
	GLOBAL_THEME_VARS: 'mvp-global-theme-vars',
	SCROLLBAR_OVERRIDE: 'mvp-global-scrollbar-override',
} as const

// Custom Event Names
export const EVENTS = {
	MUTED_WORDS_CHANGED: 'mvp-muted-words-changed',
	DATA_RESET: 'mvp-data-reset',
	PIN_CHANGED: 'mvp-pin-changed',
	CONTENT_INJECTED: 'mvp-content-injected',
} as const

// =============================================================================
// API ENDPOINTS
// =============================================================================

export const API_URLS = {
	STEAM_STORE: 'https://store.steampowered.com',
	TMDB_BASE: 'https://api.themoviedb.org/3',
	TMDB_IMAGE: 'https://image.tmdb.org/t/p',
	IMGBB: 'https://api.imgbb.com/1/upload',
	GIPHY: 'https://api.giphy.com/v1/gifs',
} as const
