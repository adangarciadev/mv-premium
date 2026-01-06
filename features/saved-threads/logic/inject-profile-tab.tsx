/**
 * Profile Tabs (Saved Threads + Pinned Posts)
 *
 * Injects "Guardados" and "Posts Anclados" tabs in the user's own profile page
 * and mounts React components to display saved threads and pinned posts.
 *
 * OPTIMIZATION: Table components are loaded dynamically to avoid bundling
 * TanStack Table in the main content script bundle.
 */

import { mountFeature, isFeatureMounted } from '@/lib/content-modules/utils/react-helpers'
import { createElement } from 'react'
import { FEATURE_IDS } from '@/constants'
import { DOM_MARKERS } from '@/constants/dom-markers'

// ============================================================================
// CONSTANTS
// ============================================================================

// Saved Threads
const SAVED_BUTTON_ID = DOM_MARKERS.IDS.SAVED_THREADS_TAB
const SAVED_CONTENT_ID = DOM_MARKERS.IDS.SAVED_THREADS_CONTENT
const SAVED_FEATURE_ID = FEATURE_IDS.SAVED_THREADS_PROFILE

// Pinned Posts (Posts Anclados)
const PINNED_BUTTON_ID = DOM_MARKERS.IDS.WIKI_POSTS_TAB
const PINNED_CONTENT_ID = DOM_MARKERS.IDS.WIKI_POSTS_CONTENT
const PINNED_FEATURE_ID = FEATURE_IDS.WIKI_POSTS_PROFILE

// ============================================================================
// DETECTION HELPERS
// ============================================================================

/**
 * Detects if the current view is a profile sub-section (posts, threads, etc.).
 */
function isProfileSubpage(): boolean {
	const path = window.location.pathname
	return /^\/id\/[^/]+\/(posts|temas|noticias|firmas|me-gusta|marcadores|menciones)/.test(path)
}

/**
 * Determines if the current profile belongs to the authenticated user.
 */
function isOwnProfile(): boolean {
	return !!document.querySelector('.hero-controls a[href="/configuracion"]')
}

/**
 * Extracts the profile owner's username from the URL path.
 */
function getProfileUsername(): string | null {
	const match = window.location.pathname.match(/^\/id\/([^/]+)/)
	return match ? match[1] : null
}

/**
 * Check active tab based on hash
 */
function getActiveTab(): 'saved' | 'anclados' | null {
	const hash = window.location.hash
	if (hash === '#guardados') return 'saved'
	if (hash === '#anclados') return 'anclados'
	return null
}

// ============================================================================
// BUTTON FACTORY
// ============================================================================

interface TabButtonConfig {
	id: string
	href: string
	icon: string
	label: string
	hash: string
	onShow: () => void
}

function createTabButton(config: TabButtonConfig, tabsContainer: Element, username: string): HTMLAnchorElement {
	// Add a space before each button to mimic native HTML whitespace separation
	tabsContainer.appendChild(document.createTextNode(' '))

	const btn = document.createElement('a')
	btn.id = config.id
	btn.className = 'btn'
	btn.href = `/id/${username}/temas${config.hash}`
	btn.innerHTML = `<i class="fa ${config.icon}"></i><span class="ddi"> ${config.label}</span>`
	btn.style.display = 'inline-block'
	btn.style.verticalAlign = 'top'

	btn.addEventListener('click', e => {
		e.preventDefault()
		history.pushState(null, '', `/id/${username}/temas${config.hash}`)
		config.onShow()
		updateTabActiveStates()
	})

	tabsContainer.appendChild(btn)
	return btn
}

// ============================================================================
// VIEW LOGIC
// ============================================================================

/**
 * Shows the Saved Threads view
 */
async function showSavedThreadsView(): Promise<void> {
	// 1. Hide Pinned Posts view
	hidePinnedPostsView()

	// 2. Hide Native Content
	const nativeContent = document.querySelector('.c-main > .wpx')
	if (nativeContent) {
		;(nativeContent as HTMLElement).style.display = 'none'
	}

	// 3. Create/Show Saved Threads Container
	let container = document.getElementById(SAVED_CONTENT_ID)
	if (!container) {
		container = document.createElement('div')
		container.id = SAVED_CONTENT_ID
		const tabsContainer = document.querySelector('.c-main > .cf.mpad.mg-b')
		if (tabsContainer) {
			tabsContainer.after(container)
		}
	}
	if (container) container.style.display = ''

	// 4. Mount Component
	if (!isFeatureMounted(SAVED_FEATURE_ID) && container) {
		const { SavedThreadsTable } = await import('../components/saved-threads-table')
		mountFeature(SAVED_FEATURE_ID, container, createElement(SavedThreadsTable))
	}
}

function hideSavedThreadsView(): void {
	const container = document.getElementById(SAVED_CONTENT_ID)
	if (container) container.style.display = 'none'
}

/**
 * Shows the Pinned Posts view
 */
async function showPinnedPostsView(): Promise<void> {
	// 1. Hide Saved Threads view
	hideSavedThreadsView()

	// 2. Hide Native Content
	const nativeContent = document.querySelector('.c-main > .wpx')
	if (nativeContent) {
		;(nativeContent as HTMLElement).style.display = 'none'
	}

	// 3. Create/Show Pinned Posts Container
	let container = document.getElementById(PINNED_CONTENT_ID)
	if (!container) {
		container = document.createElement('div')
		container.id = PINNED_CONTENT_ID
		const tabsContainer = document.querySelector('.c-main > .cf.mpad.mg-b')
		if (tabsContainer) {
			tabsContainer.after(container)
		}
	}
	if (container) container.style.display = ''

	// 4. Mount Component
	if (!isFeatureMounted(PINNED_FEATURE_ID) && container) {
		const { WikiPostsTable } = await import('../components/wiki-posts-table')
		mountFeature(PINNED_FEATURE_ID, container, createElement(WikiPostsTable))
	}
}

function hidePinnedPostsView(): void {
	const container = document.getElementById(PINNED_CONTENT_ID)
	if (container) container.style.display = 'none'
}

function hideAllCustomViews(): void {
	hideSavedThreadsView()
	hidePinnedPostsView()

	// Show native content
	const nativeContent = document.querySelector('.c-main > .wpx')
	if (nativeContent) {
		;(nativeContent as HTMLElement).style.display = ''
	}
}

// ============================================================================
// TAB STATE MANAGEMENT
// ============================================================================

function updateTabActiveStates(): void {
	const activeTab = getActiveTab()

	const savedBtn = document.getElementById(SAVED_BUTTON_ID)
	const pinnedBtn = document.getElementById(PINNED_BUTTON_ID)

	if (savedBtn) {
		savedBtn.classList.toggle('btn-primary', activeTab === 'saved')
	}
	if (pinnedBtn) {
		pinnedBtn.classList.toggle('btn-primary', activeTab === 'anclados')
	}
}

function handleHashChange(): void {
	const activeTab = getActiveTab()

	if (activeTab === 'saved') {
		showSavedThreadsView()
	} else if (activeTab === 'anclados') {
		showPinnedPostsView()
	} else {
		hideAllCustomViews()
	}

	updateTabActiveStates()
}

let initialized = false

/**
 * Initializes the profile tab injection logic.
 * Arms custom tabs and handles initial Routing based on hash.
 */
export function initProfileSavedThreadsTab(): void {
	if (!isProfileSubpage()) return
	if (!isOwnProfile()) return
	if (initialized) return
	if (document.getElementById(SAVED_BUTTON_ID)) {
		initialized = true
		return
	}

	initialized = true

	const tabsContainer = document.querySelector('.c-main > .cf.mpad.mg-b')
	if (!tabsContainer) {
		initialized = false
		return
	}

	const username = getProfileUsername()
	if (!username) {
		initialized = false
		return
	}

	// Create Saved Threads button
	createTabButton(
		{
			id: SAVED_BUTTON_ID,
			href: `/id/${username}/temas#guardados`,
			icon: 'fa-folder-open',
			label: 'Threads Guardados',
			hash: '#guardados',
			onShow: showSavedThreadsView,
		},
		tabsContainer,
		username
	)

	// Create Pinned Posts (Anclados) button
	createTabButton(
		{
			id: PINNED_BUTTON_ID,
			href: `/id/${username}/temas#anclados`,
			icon: 'fa-thumb-tack',
			label: 'Posts Anclados',
			hash: '#anclados',
			onShow: showPinnedPostsView,
		},
		tabsContainer,
		username
	)

	// Handle initial state
	handleHashChange()

	// Listen for hash changes
	window.addEventListener('hashchange', handleHashChange)
}
