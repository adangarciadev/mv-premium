/**
 * Theme Utilities
 * Detects the current Mediavida theme (light/dark) based on loaded stylesheets
 */

/**
 * Detects if Mediavida is currently in dark mode
 * MV uses /style/XXX/dark_v7.css for dark and /style/XXX/light.css for light
 */
export function isMVDarkMode(): boolean {
	return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
		.some(link => (link as HTMLLinkElement).href.includes('dark'))
}
