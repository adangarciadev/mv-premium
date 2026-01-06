/**
 * Ultrawide Mode Feature
 *
 * Provides multiple width options for page content:
 * - off: Default Mediavida width
 * - wide: 1400px max-width
 * - extra-wide: 1800px max-width
 * - full: Full screen with 30px side padding
 */

import { storage } from '@wxt-dev/storage'
import { logger } from '@/lib/logger'
import { STORAGE_KEYS, MV_SELECTORS } from '@/constants'
import { DOM_MARKERS } from '@/constants/dom-markers'
import type { UltrawideMode } from '@/store/settings-types'

const STYLE_ID = DOM_MARKERS.IDS.ULTRAWIDE_STYLES
const SETTINGS_KEY = `local:${STORAGE_KEYS.SETTINGS}` as `local:${string}`

interface SettingsState {
	state: {
		ultrawideMode: UltrawideMode
	}
}

/**
 * Generates a CSS string containing the necessary overrides for the selected width mode.
 * @param mode - The target width mode ('off', 'wide', 'extra-wide', 'full')
 */
function generateStyles(mode: UltrawideMode): string | null {
	if (mode === 'off') return null

	const widthConfig = {
		wide: { maxWidth: '1400px', padding: '0' },
		'extra-wide': { maxWidth: '1800px', padding: '0' },
		full: { maxWidth: 'none', padding: '30px' },
	}

	const config = widthConfig[mode]

	return `
    /* MVP Ultrawide Mode - ${mode} */
    
    /* Main wrapper */
    ${MV_SELECTORS.GLOBAL.MAIN_WRAPPER},
    ${MV_SELECTORS.GLOBAL.WRAPPER} {
      max-width: ${config.maxWidth} !important;
      width: 100% !important;
      padding-left: ${config.padding} !important;
      padding-right: ${config.padding} !important;
    }
    
    /* Content wrapper */
    ${MV_SELECTORS.GLOBAL.CONTENT_WRAPPER} {
      max-width: ${config.maxWidth} !important;
    }
    
    /* Content container */
    ${MV_SELECTORS.GLOBAL.CONTENT_CONTAINER} {
      max-width: ${config.maxWidth} !important;
      width: 100% !important;
    }
    
    /* Main content area */
    ${MV_SELECTORS.GLOBAL.MAIN_CONTENT} {
      max-width: ${config.maxWidth} !important;
      flex: 1 !important;
    }
    
    /* Full width tables */
    ${MV_SELECTORS.GLOBAL.FULL_WIDTH_TABLE} {
      width: 100% !important;
    }
    
    /* Thread content area */
    ${MV_SELECTORS.THREAD.POST_BODY_LEGACY} {
      max-width: ${config.maxWidth} !important;
      width: 100% !important;
      padding-left: ${config.padding} !important;
      padding-right: ${config.padding} !important;
    }
    
    /* Posts container */
    ${MV_SELECTORS.GLOBAL.POSTS_ALT} {
      max-width: ${config.maxWidth} !important;
    }
  `
}

/**
 * Injects or removes the ultrawide CSS styles from the document head.
 * @param mode - The desired width mode
 */
function applyUltrawide(mode: UltrawideMode): void {
	// Remove existing styles
	const existingStyle = document.getElementById(STYLE_ID)
	if (existingStyle) {
		existingStyle.remove()
	}

	const css = generateStyles(mode)
	if (!css) return

	// Create and inject styles
	const styleEl = document.createElement('style')
	styleEl.id = STYLE_ID
	styleEl.textContent = css
	document.head.appendChild(styleEl)
}

/**
 * Initializes the ultrawide feature by loading settings and setting up storage watches.
 */
export async function initUltrawide(): Promise<void> {
	try {
		// Get initial settings
		const raw = await storage.getItem<string | SettingsState>(SETTINGS_KEY)

		if (raw) {
			const parsed: SettingsState = typeof raw === 'string' ? JSON.parse(raw) : raw
			const mode = parsed?.state?.ultrawideMode ?? 'off'
			applyUltrawide(mode)
		}

		// Watch for changes
		storage.watch<string | SettingsState>(SETTINGS_KEY, newValue => {
			if (!newValue) return

			try {
				const parsed: SettingsState = typeof newValue === 'string' ? JSON.parse(newValue) : newValue
				const mode = parsed?.state?.ultrawideMode ?? 'off'
				applyUltrawide(mode)
			} catch (e) {
				logger.error('Ultrawide error parsing settings:', e)
			}
		})
	} catch (error) {
		logger.error('Ultrawide failed to initialize:', error)
	}
}
