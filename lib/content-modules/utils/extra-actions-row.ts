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

	// Create the main extra actions container
	extraActions = document.createElement('div')
	extraActions.id = EXTRA_ACTIONS_ID
	extraActions.style.cssText = `
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid rgba(128, 128, 128, 0.2);
		width: 100%;
	`

	// 1. Create Main Actions container (Gallery, Save, Summarize)
	const mainActions = document.createElement('div')
	mainActions.id = DOM_MARKERS.IDS.MAIN_ACTIONS
	mainActions.style.cssText = `
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
	`
	extraActions.appendChild(mainActions)

	// 2. Create Separator (hidden by default if no status actions)
	const separator = document.createElement('div')
	separator.id = DOM_MARKERS.IDS.EXTRA_ACTIONS_SEPARATOR
	separator.style.cssText = `
		border-top: 1px solid rgba(128, 128, 128, 0.1);
		width: 100%;
		display: none;
	`
	extraActions.appendChild(separator)

	// 3. Create Status Actions container (Live, Infinite Scroll)
	const statusActions = document.createElement('div')
	statusActions.id = DOM_MARKERS.IDS.STATUS_ACTIONS
	statusActions.style.cssText = `
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	`
	extraActions.appendChild(statusActions)

	// Append inside #more-actions (at the end) to maintain DOM hierarchy
	moreActions.appendChild(extraActions)

	return extraActions
}

/**
 * Get the main actions row (the top one)
 */
export function getMainActionsRow(): HTMLDivElement | null {
	getExtraActionsRow()
	return document.getElementById(DOM_MARKERS.IDS.MAIN_ACTIONS) as HTMLDivElement | null
}

/**
 * Get the status actions row (the bottom one)
 */
export function getStatusActionsRow(): HTMLDivElement | null {
	getExtraActionsRow()
	const statusRow = document.getElementById(DOM_MARKERS.IDS.STATUS_ACTIONS) as HTMLDivElement | null
	if (statusRow) {
		// Show separator if we access the status row
		const separator = document.getElementById(DOM_MARKERS.IDS.EXTRA_ACTIONS_SEPARATOR)
		if (separator) separator.style.display = 'block'
	}
	return statusRow
}

/**
 * Check if the extra actions row exists
 */
export function hasExtraActionsRow(): boolean {
	return !!document.getElementById(EXTRA_ACTIONS_ID)
}
