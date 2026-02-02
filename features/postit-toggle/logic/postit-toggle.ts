/**
 * Postit Toggle Fix
 * 
 * Fixes the native toggle button for postits that contain embedded videos.
 * The native toggle button gets covered by iframes, so we simply reposition it
 * to a dedicated area above the video content.
 * 
 * NO visual changes to the button - just repositions it.
 */

import { logger } from '@/lib/logger'

const INJECTED_MARKER = 'mvp-postit-fixed'

/**
 * Injects minimal CSS to reposition the native toggle button
 */
export function injectPostitToggleStyles(): void {
	const styleId = 'mvp-postit-toggle-styles'
	
	// Avoid duplicate injection
	if (document.getElementById(styleId)) return
	
	const styles = document.createElement('style')
	styles.id = styleId
	styles.textContent = `
		/* Add padding to postit for button area */
		.postit[${INJECTED_MARKER}] {
			padding-top: 48px !important;
			position: relative !important;
		}
		
		/* Reposition native toggle button to the dedicated area */
		.postit[${INJECTED_MARKER}] > a.toggle {
			position: absolute !important;
			top: 8px !important;
			right: 8px !important;
			z-index: 10 !important;
		}
		
		/* Collapsed state */
		.postit[${INJECTED_MARKER}].oculto {
			padding-top: 0 !important;
		}
	`
	
	document.head.appendChild(styles)
}

/**
 * Marks postits with iframes so CSS can target them
 */
export function markPostitsWithIframes(): void {
	const postits = document.querySelectorAll<HTMLElement>('#postit.postit, .postit')
	
	let markedCount = 0
	
	postits.forEach(postit => {
		if (postit.hasAttribute(INJECTED_MARKER)) return
		
		const hasIframe = postit.querySelector('iframe') !== null
		if (!hasIframe) return
		
		postit.setAttribute(INJECTED_MARKER, 'true')
		markedCount++
	})
	
	if (markedCount > 0) {
		logger.debug(`Fixed ${markedCount} postit toggle button(s)`)
	}
}

/**
 * Initialize the postit toggle fix
 */
export function initPostitToggle(): void {
	injectPostitToggleStyles()
	markPostitsWithIframes()
}
