// features/user-customizations/logic/customizations-styles.ts
/**
 * Global CSS styles for user customizations.
 * Handles role-based colors, tooltips, muted user UI, and button states.
 */

import { DOM_MARKERS } from '@/constants'
import type { GlobalRoleSettings } from '../storage'

const STYLE_ID = DOM_MARKERS.IDS.USER_CUSTOMIZATIONS_STYLES

/**
 * Generates the CSS string for role-based colors.
 * In Mediavida, the .autor element IS the anchor tag itself.
 * Structure: <a class="autor user-card su_3" href="/id/Username">Username</a>
 */
function generateRoleColorCSS(settings: GlobalRoleSettings): string {
	const rules: string[] = []

	// Admin color (su_3)
	if (settings.adminColor) {
		rules.push(`a.autor.su_3, a.autor.user-card.su_3 { color: ${settings.adminColor} !important; }`)
	}

	// Subadmin color (su_25)
	if (settings.subadminColor) {
		rules.push(`a.autor.su_25, a.autor.user-card.su_25 { color: ${settings.subadminColor} !important; }`)
	}

	// Moderator color (su_2)
	if (settings.modColor) {
		rules.push(`a.autor.su_2, a.autor.user-card.su_2 { color: ${settings.modColor} !important; }`)
	}

	// Regular user color (no special su_X class)
	if (settings.userColor) {
		rules.push(`a.autor.user-card:not(.su_2):not(.su_3):not(.su_25) { color: ${settings.userColor} !important; }`)
	}

	return rules.join('\n    ')
}

/**
 * CSS for custom native labels (span.ct) from extension.
 */
const NATIVE_TAG_CSS = `
    /* Custom native labels (span.ct) from extension - inline display */
    .mvp-user-tag-native {
        display: inline !important;
        margin-left: 4px;
    }
`

/**
 * CSS for user notes tooltip system.
 */
const USER_NOTE_CSS = `
    /* User Notes Tooltip */
    .mvp-user-note {
      position: relative;
    }
    
    .mvp-user-note:hover::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      padding: 6px 10px;
      background-color: #1a1a1a;
      color: #fff;
      border: 1px solid #333;
      border-radius: var(--radius, 6px);
      font-size: 12px;
      line-height: 1.4;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      word-break: break-word;
      width: max-content;
      max-width: 280px;
      z-index: 9999;
      margin-bottom: 6px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
      pointer-events: none;
      text-align: left;
    }

    .mvp-user-note:hover::before {
      content: "";
      position: absolute;
      bottom: 100%;
      left: 50%;
      margin-left: -5px;
      margin-bottom: 1px;
      border-width: 5px;
      border-style: solid;
      border-color: #1a1a1a transparent transparent transparent;
      z-index: 9999;
      pointer-events: none;
    }
`

/**
 * CSS for muted user system.
 */
const MUTED_USER_CSS = `
    /* Muted User System */
    .mvp-muted-user {
      position: relative !important;
      min-height: auto !important;
    }
    /* Hide ALL children and their descendants except the placeholder and its sub-elements */
    .mvp-muted-user > *:not(.mvp-mute-placeholder) {
      display: none !important;
    }
    /* Ensure nested elements (like avatars in some views) are also hidden if they aren't direct children */
    .mvp-muted-user .post-avatar,
    .mvp-muted-user .wrap,
    .mvp-muted-user .pm-content {
      display: none !important;
    }
`

/**
 * CSS for active button states in user card.
 */
const BUTTON_STATE_CSS = `
    /* Active Button States for User Card - Light Mode (default) */
    .mvp-btn-active {
      background: rgba(46, 125, 50, 0.12) !important;
      border-color: #2E7D32 !important;
      color: #1B5E20 !important;
    }
    .mvp-btn-active:hover {
      background: rgba(46, 125, 50, 0.2) !important;
      border-color: #1B5E20 !important;
      color: #1B5E20 !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.12) !important;
      text-decoration: none !important;
    }
`

/**
 * Builds the complete CSS string for user customizations.
 */
function buildCustomizationsCSS(settings: GlobalRoleSettings): string {
	return `
    ${generateRoleColorCSS(settings)}
    ${NATIVE_TAG_CSS}
    ${USER_NOTE_CSS}
    ${MUTED_USER_CSS}
    ${BUTTON_STATE_CSS}
  `
}

/**
 * Injects a global <style> tag to apply role-based colors and tooltip behavior.
 * This is the primary method for skinning user links across the entire site.
 */
export function applyGlobalStyles(settings: GlobalRoleSettings): void {
	// Remove existing style element
	const existing = document.getElementById(STYLE_ID)
	if (existing) existing.remove()

	// Only add if we have settings with actual colors
	if (!settings.adminColor && !settings.subadminColor && !settings.modColor && !settings.userColor) return

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = buildCustomizationsCSS(settings)
	document.head.appendChild(style)
}

/**
 * Inline styles for the user note icon element.
 */
export const NOTE_ICON_STYLES = `
  display: flex;
  justify-content: center;
  margin-top: 4px;
  cursor: default !important;
  color: #eab308;
`

/**
 * SVG markup for the note icon.
 */
export const NOTE_ICON_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sticky-note"><path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/></svg>
`

/**
 * Inline styles for the user badge element.
 */
export function getBadgeStyles(badgeColor?: string, badgeTextColor?: string): string {
	return `
    margin-left: 6px;
    padding: 1px 6px;
    border-radius: var(--radius, 4px);
    font-size: 13px;
    font-weight: 500;
    background-color: ${badgeColor || '#3b82f6'};
    color: ${badgeTextColor || 'white'};
    vertical-align: middle;
    display: inline-block;
  `
}
