/**
 * Dashboard Button Feature
 * Injects a button in Mediavida's navbar to open the options page
 * Position: After avatar, alongside the new-thread button
 *
 * Shows a notification badge when there are unseen changes (What's New)
 * Badge syncs across tabs via storage.watch()
 */
import { sendMessage } from '@/lib/messaging'
import { hasUnseenChanges, watchVersionChanges } from './lib/whats-new-storage'
import { browser } from 'wxt/browser'
import { DOM_MARKERS, MV_SELECTORS } from '@/constants'
import { getSettings } from '@/store/settings-store'
import { logger } from '@/lib/logger'
import type { DashboardIcon } from '@/store/settings-types'

const INJECTED_MARKER = DOM_MARKERS.CLASSES.DASHBOARD_INJECTED
const BADGE_ID = DOM_MARKERS.IDS.WHATS_NEW_BADGE

function getOptionsUrl(view?: string): string {
	let url = browser.runtime.getURL('/options.html')
	if (view) url += `#/${view}`
	return url
}

async function openDashboard(view?: string): Promise<void> {
	try {
		await sendMessage('openOptionsPage', view)
		return
	} catch (error) {
		logger.error('Dashboard open options via message failed:', error)
	}

	try {
		const url = getOptionsUrl(view)
		window.open(url, '_blank', 'noopener,noreferrer')
	} catch (error) {
		logger.error('Dashboard open options fallback failed:', error)
	}
}

/**
 * Returns the HTML for the dashboard icon based on user preference.
 * @param iconType - The icon type from settings
 * @returns HTML string for the icon
 */
function getDashboardIconHTML(iconType: DashboardIcon): string {
	const iconStyles = 'font-size: 18px; vertical-align: middle; transition: all 0.2s ease-in-out;'
	
	switch (iconType) {
		case 'user-shield':
			return `<i class="fa fa-shield mv-dashboard-icon" style="${iconStyles}"></i>`
		case 'dashboard':
			return `<i class="fa fa-th-large mv-dashboard-icon" style="${iconStyles}"></i>`
		case 'rocket':
			return `<i class="fa fa-rocket mv-dashboard-icon" style="${iconStyles}"></i>`
		case 'gears':
			return `<i class="fa fa-cogs mv-dashboard-icon" style="${iconStyles}"></i>`
		case 'logo':
		default:
			const iconUrl = browser.runtime.getURL('/icon/48.png')
			return `<img src="${iconUrl}" class="mv-dashboard-logo" style="width: 20px; height: 20px; vertical-align: middle; transition: all 0.2s ease-in-out;" />`
	}
}

/** CSS class defined in app.css */
const BADGE_CLASS = 'mvp-whats-new-badge'

/**
 * Checks for user authentication by detecting the existence of the navbar user menu.
 * @returns True if the user is authenticated
 */
function isUserLoggedIn(): boolean {
	return document.querySelector(MV_SELECTORS.GLOBAL.USERMENU) !== null
}

/**
 * Injects the extension dashboard entry point into Mediavida's global navigation bar.
 * Adapts to the presence of other injected or native elements for correct positioning.
 */
export async function injectDashboardButton(): Promise<void> {
	// Only inject for logged-in users
	if (!isUserLoggedIn()) return

	const usermenu = document.querySelector(MV_SELECTORS.GLOBAL.USERMENU)
	if (!usermenu) return

	// Check if already injected
	if (usermenu.querySelector(`[${INJECTED_MARKER}]`)) {
		// Already injected, just update badge
		await updateBadge()
		return
	}

	// Find insertion point - after avatar (where new-thread button also goes)
	const avatarItem = usermenu.querySelector(MV_SELECTORS.GLOBAL.USERMENU_AVATAR)
	if (!avatarItem) return

	// Prefer inserting after "Nuevo hilo" if present (extension or native), else after avatar.
	// TODO: Keep migration local for now; replace deprecated INJECTION markers incrementally across the codebase.
	const injectedNewThreadButton = usermenu.querySelector(`[${DOM_MARKERS.DATA_ATTRS.NEW_THREAD_INJECTED}]`)
	const anyNewThreadLink = usermenu.querySelector('a[title="Nuevo hilo"], a[aria-label="Crear nuevo hilo"]')
	const insertAfter = injectedNewThreadButton?.parentElement || anyNewThreadLink?.parentElement || avatarItem

	// Check if there are unseen changes
	const hasUnseen = await hasUnseenChanges()
	
	// Get user's preferred icon
	const settings = await getSettings()
	const iconType = settings.dashboardIcon || 'logo'

	// Create the button container (matching native navbar style)
	const li = document.createElement('li')
	li.className = 'mvp-dashboard-nav-item'
	li.setAttribute(INJECTED_MARKER, 'true')

	// Create the button (anchor to preserve native navbar layout/styles)
	const button = document.createElement('a')
	button.href = getOptionsUrl(hasUnseen ? 'whats-new' : undefined)
	button.className = 'flink mvp-dashboard-link'
	button.setAttribute('rel', 'noopener noreferrer')
	button.setAttribute('data-mvp-dashboard-link', 'true')
	button.setAttribute('aria-label', 'Abrir panel de MVPremium')
	button.style.position = 'relative'

	const iconHTML = getDashboardIconHTML(iconType)
	button.innerHTML = `
		${iconHTML}
		<span class="title">Dashboard</span>
		${hasUnseen ? `<span id="${BADGE_ID}" class="${BADGE_CLASS}">NEW</span>` : ''}
	`

	// Open options page on click (via typed messaging)
	// If there are unseen changes, open directly to whats-new view
	const suppressNativeHandlers = (event: Event) => {
		event.stopPropagation()
		if ('stopImmediatePropagation' in event) {
			event.stopImmediatePropagation()
		}
	}

	// Firefox: native Mediavida homepage handlers can intercept navbar interactions.
	button.addEventListener('pointerdown', suppressNativeHandlers, true)
	button.addEventListener('mousedown', suppressNativeHandlers, true)
	button.addEventListener(
		'click',
		e => {
			e.preventDefault()
			suppressNativeHandlers(e)
			void openDashboard(hasUnseen ? 'whats-new' : undefined)
		},
		true
	)

	li.appendChild(button)

	// Insert after the reference element
	insertAfter.insertAdjacentElement('afterend', li)

	// Setup cross-tab sync for badge visibility
	setupBadgeSync()
}

/** Flag to prevent multiple watchers */
let badgeSyncSetup = false

/**
 * Sets up a watcher to sync badge visibility across tabs when version is marked as seen.
 */
function setupBadgeSync(): void {
	if (badgeSyncSetup) return
	badgeSyncSetup = true

	watchVersionChanges(() => {
		void updateBadge()
	})
}

/**
 * Updates the visibility of the 'NEW' notification badge based on the current version tracking state.
 * Uses unified styles for consistency.
 */
async function updateBadge(): Promise<void> {
	const hasUnseen = await hasUnseenChanges()
	const badge = document.getElementById(BADGE_ID)
	const button = document.querySelector(`[${INJECTED_MARKER}] [data-mvp-dashboard-link]`) as HTMLElement | null

	if (button) {
		button.setAttribute('href', getOptionsUrl(hasUnseen ? 'whats-new' : undefined))
		button.setAttribute(
			'aria-label',
			hasUnseen ? 'Abrir panel de MVPremium (hay novedades)' : 'Abrir panel de MVPremium'
		)
	}

	if (hasUnseen && !badge) {
		// Add badge with unified styles
		if (button) {
			const badgeEl = document.createElement('span')
			badgeEl.id = BADGE_ID
			badgeEl.className = BADGE_CLASS
			badgeEl.textContent = 'NEW'
			button.appendChild(badgeEl)
		}
	} else if (!hasUnseen && badge) {
		// Remove badge with fade out
		badge.style.transition = 'opacity 0.3s ease-out'
		badge.style.opacity = '0'
		setTimeout(() => badge.remove(), 300)
	}
}

/**
 * Removes the notification badge from the dashboard button (e.g., after viewing updates).
 */
export function removeBadge(): void {
	const badge = document.getElementById(BADGE_ID)
	badge?.remove()
}
