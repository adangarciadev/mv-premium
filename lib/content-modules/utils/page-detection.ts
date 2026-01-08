/**
 * Page detection utilities for Mediavida
 */

/**
 * Whitelist of valid subforum slugs from Mediavida
 * These are the ONLY paths that should be considered subforum main pages
 * Extracted from actual /foro page HTML
 * Excludes: spy, top (not real subforums)
 */
const VALID_SUBFORUM_SLUGS = new Set([
	// General
	'off-topic',
	'feda',
	'club-hucha',
	'politica',
	'streamers',
	'criptomonedas',
	'compra-venta',
	'estudios-trabajo',
	'ciencia',
	'musica',
	'cine',
	'tv',
	'libros-comics',
	'anime-manga',
	'deportes',
	'motor',
	'fitness',
	'cocina',
	'mascotas',
	'viajes',
	// Juegos
	'juegos',
	'mmo',
	'juegos-lucha',
	'juegos-movil',
	'juegos-mesa-rol',
	'mafia',
	'intercambios',
	'counterstrike',
	'diablo',
	'lol',
	'poe',
	'pokemon',
	'valorant',
	'wow',
	// Tecnología
	'dev',
	'gamedev',
	'electronica-telefonia',
	'hard-soft',
	// Comunidad
	'mediavida',
])

/**
 * Check if we're on the main forum list page
 * Pattern: /foro or /foro/
 */
export function isForumListPage(): boolean {
	const path = window.location.pathname
	return path === '/foro' || path === '/foro/'
}

/**
 * Check if we're on a specific subforum page (not a thread)
 * Uses whitelist to exclude non-subforum pages like /foro/favoritos
 * Pattern: /foro/category (but not /foro/category/thread-name-123)
 */
export function isSubforumPage(): boolean {
	const path = window.location.pathname
	// Match /foro/xxx pattern
	const match = path.match(/^\/foro\/([^/]+)\/?$/)
	if (!match) return false

	const slug = match[1].toLowerCase()
	return VALID_SUBFORUM_SLUGS.has(slug)
}

/**
 * Check if we're on a thread page
 * Pattern: /foro/category/thread-name-123456
 */
export function isThreadPage(): boolean {
	const path = window.location.pathname
	return /^\/foro\/[^\/]+\/[^\/]+-\d+/.test(path)
}

/**
 * Check if we're on a new thread page
 * Pattern: /foro/{category}/nuevo-hilo
 */
export function isNewThreadPage(): boolean {
	const path = window.location.pathname
	return /^\/foro\/[^\/]+\/nuevo-hilo/.test(path)
}

/**
 * Check if we're on the cine subforum
 * Pattern: /foro/cine*
 */
export function isCineForum(): boolean {
	const path = window.location.pathname
	return path.startsWith('/foro/cine')
}

/**
 * Check if we're on the sports subforum
 * Pattern: /foro/deportes*
 */
export function isSportsForum(): boolean {
	const path = window.location.pathname
	return path.startsWith('/foro/deportes')
}

/**
 * Check if we're on the favorites page
 * Pattern: /foro/favoritos*
 */
export function isFavoritesPage(): boolean {
	const path = window.location.pathname
	return path.startsWith('/foro/favoritos')
}

/**
 * Check if we're on the spy page (recent activity)
 * Pattern: /foro/spy*
 */
export function isSpyPage(): boolean {
	const path = window.location.pathname
	return path.startsWith('/foro/spy')
}

/**
 * Check if we're on a global forum view page (not a specific subforum)
 * These pages have the sidebar but are not subforums
 * Includes: spy, new, unread, top, featured
 */
export function isForumGlobalViewPage(): boolean {
	const path = window.location.pathname
	const globalViews = ['/foro/spy', '/foro/new', '/foro/unread', '/foro/top', '/foro/featured']
	return globalViews.some(view => path.startsWith(view))
}

/**
 * Get the current forum category from URL
 * Returns null if not on a forum page
 */
export function getForumCategory(): string | null {
	const match = window.location.pathname.match(/^\/foro\/([^\/]+)/)
	return match ? match[1] : null
}

/**
 * Check if we're on the bookmarks page
 * Pattern: /id/{username}/marcadores
 */
export function isBookmarksPage(): boolean {
	const path = window.location.pathname
	return /^\/id\/[^\/]+\/marcadores/.test(path)
}

/**
 * Get thread ID from URL
 * Returns null if not on a thread page
 */
export function getThreadIdFromUrl(): string | null {
	const match = window.location.pathname.match(/^\/foro\/[^\/]+\/([^\/]+-\d+)/)
	return match ? match[1] : null
}

/**
 * Check if we're on a profile subpage
 * Pattern: /id/{username}/(posts|temas|noticias|firmas|me-gusta|marcadores|menciones)
 */
export function isProfileSubpage(): boolean {
	const path = window.location.pathname
	return /^\/id\/[^/]+\/(posts|temas|noticias|firmas|me-gusta|marcadores|menciones)/.test(path)
}

/**
 * Check if we're on a media-related forum (cine or tv)
 * Pattern: /foro/cine* or /foro/tv*
 */
export function isMediaForum(): boolean {
	const path = window.location.pathname
	return path.startsWith('/foro/cine') || path.startsWith('/foro/tv')
}

/**
 * Check if we're on a native Mediavida LIVE thread page
 * These are special thread views with real-time updates managed by MV itself.
 * Detection is based on DOM elements:
 * - #live header element (shows LIVE indicator and controls)
 * - #posts-wrap.live container (has .live class when in live mode)
 */
export function isNativeLiveThreadPage(): boolean {
	const hasLiveHeader = !!document.querySelector('#live.lv2-t')
	const hasLivePostsWrap = !!document.querySelector('#posts-wrap.live')
	return hasLiveHeader && hasLivePostsWrap
}
