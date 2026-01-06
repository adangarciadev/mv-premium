/**
 * Favorite Subforums Logic
 * Injects favorite star buttons into forum list and subforum pages
 * Also injects quick-access sidebar on subforum pages
 */
import { FavoriteSubforumButton } from '../components/favorite-subforum-button'
import { FavoriteSubforumsSidebar } from '../components/favorite-subforums-sidebar'
import {
	extractSubforumInfo,
	extractSubforumInfoFromPage,
	isSubforumFavorite,
} from '@/features/favorite-subforums/logic/storage'
import { mountFeature, isFeatureMounted, unmountFeature } from '@/lib/content-modules/utils/react-helpers'
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { MV_SELECTORS, FEATURE_IDS, Z_INDEXES, DOM_MARKERS } from '@/constants'

const INJECTED_MARKER = DOM_MARKERS.INJECTION.FAVORITE_SUBFORUM
const BUTTON_CONTAINER_CLASS = DOM_MARKERS.CLASSES.FAVORITE_SUBFORUM_BTN_CONTAINER
const SIDEBAR_CONTAINER_ID = DOM_MARKERS.IDS.FAVORITES_SIDEBAR_CONTAINER
const SIDEBAR_FEATURE_ID = FEATURE_IDS.SIDEBAR_FAVORITES

/**
 * Checks if the current page is the root forum index.
 */
function isForumListPage(): boolean {
	const path = window.location.pathname
	return path === '/foro' || path === '/foro/'
}

/**
 * Whitelist of valid subforum slugs from Mediavida
 * These are the ONLY pages where the favorite subforum button should appear
 * Extracted from actual /foro page HTML
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
 * Checks if the current page is a specific subforum view
 * Uses a whitelist to precisely match canonical subforums.
 */
function isSubforumPage(): boolean {
	const path = window.location.pathname
	// Match /foro/xxx pattern
	const match = path.match(/^\/foro\/([^/]+)\/?$/)
	if (!match) return false

	const slug = match[1].toLowerCase()
	return VALID_SUBFORUM_SLUGS.has(slug)
}

/**
 * Injects favorite star buttons into each forum row on the forum list page.
 * Uses Shadow DOM for the buttons to prevent CSS bleed.
 */
function injectOnForumListPage(): void {
	// Find all forum links
	const forumLinks = document.querySelectorAll<HTMLAnchorElement>(MV_SELECTORS.FORUM.FORUM_LINK)

	forumLinks.forEach((link, index) => {
		// Skip if already injected
		if (link.hasAttribute(INJECTED_MARKER)) return

		const subforumInfo = extractSubforumInfo(link)
		if (!subforumInfo) return

		// Mark as injected
		link.setAttribute(INJECTED_MARKER, 'true')

		const featureId = `${FEATURE_IDS.FAVORITE_SUBFORUM_BTN_PREFIX}${subforumInfo.id}`

		// Create button container
		const container = document.createElement('div')
		container.className = BUTTON_CONTAINER_CLASS
		container.setAttribute('data-feature-id', featureId)
		container.style.cssText = `
			position: absolute;
			top: 8px;
			right: 8px;
			z-index: ${Z_INDEXES.FAVORITE_BTN_CONTAINER};
		`

		// Add container to link (which has position relative)
		link.style.position = 'relative'
		link.appendChild(container)

		// Mount React component with ShadowWrapper for CSS isolation
		mountFeature(
			featureId,
			container,
			<ShadowWrapper>
				<FavoriteSubforumButton subforum={subforumInfo} size={18} />
			</ShadowWrapper>
		)
	})
}

/**
 * Injects the favorite star button into the header of a specific subforum page.
 */
function injectOnSubforumPage(): void {
	const featureId = FEATURE_IDS.FAVORITE_SUBFORUM_PAGE_BTN

	// Already mounted - skip
	if (isFeatureMounted(featureId)) return

	const subforumInfo = extractSubforumInfoFromPage()
	if (!subforumInfo) return

	// Find a good place to inject the button
	// Try forum navigation bar first
	const forumNav = document.querySelector(`${MV_SELECTORS.GLOBAL.FORUM_NAV}, ${MV_SELECTORS.GLOBAL.FORUM_NAV_ALT}`)

	if (!forumNav) {
		return
	}

	// Check if already injected
	if (forumNav.querySelector(`.${BUTTON_CONTAINER_CLASS}`)) return

	// Create container
	const container = document.createElement('div')
	container.className = BUTTON_CONTAINER_CLASS
	container.setAttribute('data-feature-id', featureId)
	container.style.cssText = `
		display: inline-flex;
		align-items: center;
		margin-left: 8px;
		vertical-align: middle;
	`

	// Find the pull-right section to insert before it
	const pullRight = forumNav.querySelector(MV_SELECTORS.GLOBAL.PULL_RIGHT)
	if (pullRight) {
		forumNav.insertBefore(container, pullRight)
	} else {
		forumNav.appendChild(container)
	}

	// Mount React component with ShadowWrapper for CSS isolation
	mountFeature(
		featureId,
		container,
		<ShadowWrapper>
			<FavoriteSubforumButton subforum={subforumInfo} size={18} />
		</ShadowWrapper>
	)
}

/**
 * Main entry point for injecting favorite buttons across the forum.
 * Automatically detects page type and applies the correct injection logic.
 */
export function injectFavoriteSubforumButtons(): void {
	if (isForumListPage()) {
		injectOnForumListPage()
	} else if (isSubforumPage()) {
		injectOnSubforumPage()
	}
}

/**
 * Cleanup function for unmounting buttons
 */
export function cleanupFavoriteSubforumButtons(): void {
	// Remove all mounted features
	const containers = document.querySelectorAll(`.${BUTTON_CONTAINER_CLASS}`)
	containers.forEach((container, index) => {
		const featureId = container.getAttribute('data-feature-id')
		if (featureId) {
			unmountFeature(featureId)
		}
		container.remove()
	})
}

/**
 * Extracts the current subforum slug from the URL path
 */
function getCurrentSubforumSlug(): string | null {
	const path = window.location.pathname
	const match = path.match(/^\/foro\/([^/]+)\/?$/)
	return match ? match[1] : null
}

/**
 * Injects the favorite subforums sidebar for quick navigation.
 * Places the sidebar in the 'thread-companion' for threads or generic sidebar for subforums.
 */
export function injectFavoriteSubforumsSidebar(): void {
	// Already mounted - skip
	if (isFeatureMounted(SIDEBAR_FEATURE_ID)) return

	// Check if already injected
	if (document.getElementById(SIDEBAR_CONTAINER_ID)) return

	// Detect page type by URL pattern
	// Thread URLs: /foro/subforum/thread-title-123456 (ends with numeric ID)
	const path = window.location.pathname
	const isThreadPage = /^\/foro\/[^/]+\/[^/]+-\d+\/?$/.test(path)

	// Create container
	const container = document.createElement('div')
	container.id = SIDEBAR_CONTAINER_ID

	if (isThreadPage) {
		// On thread pages, inject ONLY into #thread-companion (inside .c-side)
		// Do NOT fallback to #side-nav as it's positioned incorrectly on threads
		const threadCompanion = document.querySelector(MV_SELECTORS.GLOBAL.THREAD_COMPANION)
		if (!threadCompanion) {
			return // Can't inject on thread page without companion
		}

		container.style.cssText =
			'margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid rgba(128,128,128,0.2);'
		threadCompanion.insertBefore(container, threadCompanion.firstChild)
	} else {
		// On subforum/forum list pages
		// Try #side-nav first (forum list), then .c-side (subforum pages)
		const sideNav = document.querySelector(MV_SELECTORS.GLOBAL.SIDE_NAV)
		const cSide = document.querySelector(MV_SELECTORS.GLOBAL.C_SIDE)

		if (sideNav) {
			// Forum list page uses #side-nav
			container.className = 'b-side'
			const searchBox = sideNav.querySelector('.b-search')
			if (searchBox?.nextSibling) {
				sideNav.insertBefore(container, searchBox.nextSibling)
			} else {
				sideNav.insertBefore(container, sideNav.firstChild)
			}
		} else if (cSide) {
			// Subforum pages use .c-side > .b-side structure
			container.className = 'b-side'
			const searchBox = cSide.querySelector('.b-side.b-search')
			if (searchBox?.nextSibling) {
				cSide.insertBefore(container, searchBox.nextSibling)
			} else {
				cSide.insertBefore(container, cSide.firstChild)
			}
		} else {
			return // Can't inject without sidebar
		}
	}

	// Get current subforum slug
	const currentSlug = getCurrentSubforumSlug()

	// Mount React component
	mountFeature(SIDEBAR_FEATURE_ID, container, <FavoriteSubforumsSidebar currentSlug={currentSlug ?? undefined} />)
}

/**
 * Cleanup function for sidebar
 */
export function cleanupFavoriteSubforumsSidebar(): void {
	unmountFeature(SIDEBAR_FEATURE_ID)
	const container = document.getElementById(SIDEBAR_CONTAINER_ID)
	if (container) {
		container.remove()
	}
}
