/**
 * Main Content Script
 *
 * Single content script that loads on all Mediavida pages.
 * Contains React ecosystem + all features (~1.5MB).
 */
import { defineContentScript } from '#imports'
import { runContentMain } from './content/main'

// CSS imports for global injection (manifest mode)
import '@/assets/content.css'

// =============================================================================
// Global Window Type Extension
// =============================================================================
declare global {
	interface Window {
		/** Debug function to inspect extension storage */
		mvpDebug?: () => Promise<{ keys: string[]; data: Record<string, unknown> }>
		/** Flag to prevent double injection */
		__MVP_MAIN_LOADED?: boolean
	}
}

export default defineContentScript({
	// Load on all Mediavida pages
	matches: ['*://www.mediavida.com/*'],

	// Inject CSS globally so features using Light DOM get styles
	cssInjectionMode: 'manifest',

	async main(ctx) {
		// Prevent double injection (e.g., from iframe or navigation)
		if (window.__MVP_MAIN_LOADED) {
			return
		}
		window.__MVP_MAIN_LOADED = true

		await runContentMain(ctx)
	},
})
