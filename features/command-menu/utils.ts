/**
 * Command Menu Utilities
 * Helper functions for the command menu feature
 */

import { sendMessage } from '@/lib/messaging'
import { MV_BASE_URL } from '@/constants'

/**
 * Get current username from the Mediavida DOM
 */
export function getCurrentUsername(): string | null {
	const userLink = document.querySelector<HTMLAnchorElement>('#user-data')
	if (userLink?.href) {
		return userLink.href.split('/id/')[1] || null
	}
	return null
}

/**
 * Open the dashboard/options page at a specific view
 */
export function openDashboard(view?: string): void {
	sendMessage('openOptionsPage', view)
}

/**
 * Normalize string for accent-insensitive search
 */
export function normalizeString(str: string): string {
	return str
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
}

/**
 * Check if text matches query (accent-insensitive)
 */
export function matchesQuery(text: string, query: string): boolean {
	return normalizeString(text).includes(normalizeString(query))
}

/**
 * Extract numeric FID from iconClass string
 */
export function getIconId(iconClass?: string): number {
	if (!iconClass) return 0
	const match = iconClass.match(/fid-(\d+)/)
	return match ? parseInt(match[1]) : 0
}

/**
 * Check if currently in dashboard context
 */
export function isDashboardContext(): boolean {
	return window.location.href.includes('options.html') || window.location.pathname.includes('options.html')
}

/**
 * Get page context information
 */
export function getPageContext() {
	const pathname = window.location.pathname
	const isThread = /\/foro\/[^/]+\/\d+/.test(pathname)

	return {
		isDashboard: isDashboardContext(),
		pathname,
		isThread,
		isSubforum: pathname.startsWith('/foro/') && !isThread,
		isHome: pathname === '/' || pathname === '',
		isMessages: pathname.startsWith('/mensajes'),
	}
}

/**
 * Navigate to a URL, handling dashboard vs MV context
 */
export function navigateTo(path: string, isDashboard: boolean): void {
	const isExternal =
		path.startsWith('http') ||
		path.startsWith('/foro') ||
		path.startsWith('/id/') ||
		path.startsWith('/mensajes') ||
		path === '/'

	if (isDashboard) {
		if (isExternal) {
			// From dashboard to MV: always absolute and new tab
			const absoluteUrl = path.startsWith('http') ? path : `${MV_BASE_URL}${path}`
			window.open(absoluteUrl, '_blank')
		} else {
			// Internal dashboard navigation (SPA)
			window.location.hash = `#${path.startsWith('/') ? path : '/' + path}`
		}
	} else {
		// From MV to MV: standard location change
		window.location.href = path
	}
}
