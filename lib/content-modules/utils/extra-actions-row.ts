/**
 * Shared Extra Actions Row
 *
 * Creates and manages a dedicated row for extension buttons below the native
 * Mediavida #more-actions. All custom buttons (Save Thread, Gallery, Summarizer, Live)
 * should be inserted into this row for consistent placement.
 */

import { DOM_MARKERS } from '@/constants/dom-markers'
import { MV_SELECTORS } from '@/constants/mediavida-selectors'

const EXTRA_ACTIONS_ID = DOM_MARKERS.IDS.EXTRA_ACTIONS

/**
 * Get or create the extra actions row below #more-actions.
 * Returns null if #more-actions doesn't exist.
 */
export function getExtraActionsRow(): HTMLDivElement | null {
	// Check if already exists
	let extraActions = document.getElementById(EXTRA_ACTIONS_ID) as HTMLDivElement | null
	if (extraActions) return extraActions

	// Find #more-actions
	const moreActions = document.getElementById(MV_SELECTORS.GLOBAL.MORE_ACTIONS_ID)
	if (!moreActions) return null

	// Create the extra actions row
	extraActions = document.createElement('div')
	extraActions.id = EXTRA_ACTIONS_ID
	extraActions.style.cssText = `
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid rgba(128, 128, 128, 0.2);
		width: 100%;
	`

	// Append inside #more-actions (at the end) to maintain DOM hierarchy
	moreActions.appendChild(extraActions)

	return extraActions
}

/**
 * Check if the extra actions row exists
 */
export function hasExtraActionsRow(): boolean {
	return !!document.getElementById(EXTRA_ACTIONS_ID)
}
