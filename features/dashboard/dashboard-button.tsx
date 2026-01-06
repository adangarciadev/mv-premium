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

const INJECTED_MARKER = DOM_MARKERS.CLASSES.DASHBOARD_INJECTED
const BADGE_ID = DOM_MARKERS.IDS.WHATS_NEW_BADGE

/** Unified badge styles */
const BADGE_STYLES = `
	position: absolute;
	top: -4px;
	right: -6px;
	padding: 2px 5px;
	background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
	border-radius: 4px;
	font-size: 8px;
	font-weight: 700;
	color: #000;
	text-transform: uppercase;
	letter-spacing: 0.3px;
	box-shadow: 0 2px 4px rgba(245, 158, 11, 0.4);
	animation: badge-pulse 2s ease-in-out infinite;
	pointer-events: none;
`

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

	// Check if new-thread button exists, if so insert after it
	const newThreadButton = usermenu.querySelector(`[${DOM_MARKERS.INJECTION.NEW_THREAD}]`)
	const insertAfter = newThreadButton?.parentElement || avatarItem

	// Check if there are unseen changes
	const hasUnseen = await hasUnseenChanges()

	// Create the button container (matching native navbar style)
	const li = document.createElement('li')
	li.className = 'dropdown'
	li.setAttribute(INJECTED_MARKER, 'true')

	// Create the button
	const button = document.createElement('a')
	button.href = '#'
	button.className = 'flink'
	button.setAttribute('title', hasUnseen ? '¡Hay novedades en MVPremium!' : 'MVPremium Dashboard')
	button.setAttribute('aria-label', 'Abrir panel de MVPremium')
	button.style.position = 'relative'

	const iconUrl = browser.runtime.getURL('/icon/48.png')
	button.innerHTML = `
		<img src="${iconUrl}" 
			class="mv-dashboard-logo"
			style="width: 20px; height: 20px; vertical-align: middle; transition: all 0.2s ease-in-out; filter: drop-shadow(0 0 0 rgba(255,165,0,0));" 
		/>
		<span class="title">Dashboard</span>
		${hasUnseen ? `<span id="${BADGE_ID}" style="${BADGE_STYLES}">NEW</span>` : ''}
		<style>
			.flink:hover .mv-dashboard-logo {
				filter: brightness(1.2) drop-shadow(0 0 4px rgba(255, 180, 0, 0.6)) !important;
				transform: scale(1.1);
			}
			@keyframes badge-pulse {
				0%, 100% { opacity: 1; transform: scale(1); }
				50% { opacity: 0.85; transform: scale(0.95); }
			}
		</style>
	`

	// Open options page on click (via typed messaging)
	// If there are unseen changes, open directly to whats-new view
	button.addEventListener('click', e => {
		e.preventDefault()
		sendMessage('openOptionsPage', hasUnseen ? 'whats-new' : undefined)
	})

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
	const button = document.querySelector(`[${INJECTED_MARKER}] .flink`) as HTMLElement | null

	// Update button title
	if (button) {
		button.setAttribute('title', hasUnseen ? '¡Hay novedades en MVPremium!' : 'MVPremium Dashboard')
	}

	if (hasUnseen && !badge) {
		// Add badge with unified styles
		if (button) {
			const badgeEl = document.createElement('span')
			badgeEl.id = BADGE_ID
			badgeEl.textContent = 'NEW'
			badgeEl.style.cssText = BADGE_STYLES
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
