/**
 * Thread Action Button Utility
 *
 * Creates standardized buttons for the thread actions row (extra-actions-row).
 * Handles common patterns: injection guards, accessibility, styling.
 *
 * Used by: Gallery button, Save Thread button, Summarizer button, Live Thread button
 */

import { getMainActionsRow } from './extra-actions-row'

// =============================================================================
// TYPES
// =============================================================================

export interface ThreadActionButtonConfig {
	/** Unique ID for the button element */
	id: string
	/** FontAwesome icon class (e.g., 'fa-picture-o') */
	icon: string
	/** Button text (can be empty) */
	text?: string
	/** Tooltip text */
	tooltip: string
	/** Aria-label for accessibility */
	ariaLabel: string
	/** Click handler */
	onClick: (e: MouseEvent, button: HTMLAnchorElement) => void
	/** Optional: Insert position ('start' | 'end'), defaults to 'end' */
	position?: 'start' | 'end'
	/** Optional: Additional inline styles */
	style?: Partial<CSSStyleDeclaration>
}

export interface ThreadActionButtonResult {
	/** The button element */
	button: HTMLAnchorElement
	/** Remove the button from DOM */
	remove: () => void
	/** Update button text */
	updateText: (text: string) => void
	/** Update tooltip and aria-label */
	updateTooltip: (tooltip: string, ariaLabel?: string) => void
	/** Update icon */
	updateIcon: (iconClass: string) => void
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Creates and injects a thread action button into the extra-actions row.
 *
 * @returns ThreadActionButtonResult if successful, null if row not found or already exists
 *
 * @example
 * ```ts
 * const result = createThreadActionButton({
 *   id: 'mvp-my-button',
 *   icon: 'fa-star',
 *   text: '5',
 *   tooltip: 'My Feature (5 items)',
 *   ariaLabel: 'Open my feature with 5 items',
 *   onClick: (e) => openFeature()
 * })
 *
 * // Update later
 * result?.updateText('10')
 * result?.updateTooltip('My Feature (10 items)')
 *
 * // Cleanup
 * result?.remove()
 * ```
 */
export function createThreadActionButton(config: ThreadActionButtonConfig): ThreadActionButtonResult | null {
	const { id, icon, text = '', tooltip, ariaLabel, onClick, position = 'end', style = {} } = config

	// Check if already exists
	if (document.getElementById(id)) return null

	// Get the main actions row
	const extraActions = getMainActionsRow()
	if (!extraActions) return null

	// Create button
	const button = document.createElement('a')
	button.id = id
	button.href = 'javascript:void(0);'
	button.className = 'btn'
	button.title = tooltip
	button.setAttribute('aria-label', ariaLabel)
	button.setAttribute('role', 'button')

	// Build inner HTML
	const textHtml = text ? `<span style="margin-left: 5px;">${text}</span>` : ''
	button.innerHTML = `<i class="fa ${icon}"></i>${textHtml}`

	// Apply custom styles
	Object.assign(button.style, style)

	// Click handler
	button.addEventListener('click', (e: MouseEvent) => {
		e.preventDefault()
		onClick(e, button)
	})

	// Insert into DOM
	if (position === 'start') {
		extraActions.insertAdjacentElement('afterbegin', button)
	} else {
		extraActions.appendChild(button)
	}

	// Build result
	return {
		button,
		remove: () => {
			button.remove()
		},
		updateText: (newText: string) => {
			const span = button.querySelector('span')
			if (span) {
				span.textContent = newText
			} else if (newText) {
				button.insertAdjacentHTML('beforeend', `<span style="margin-left: 5px;">${newText}</span>`)
			}
		},
		updateTooltip: (newTooltip: string, newAriaLabel?: string) => {
			button.title = newTooltip
			button.setAttribute('aria-label', newAriaLabel || newTooltip)
		},
		updateIcon: (iconClass: string) => {
			const iconEl = button.querySelector('i')
			if (iconEl) {
				iconEl.className = `fa ${iconClass}`
			}
		},
	}
}

/**
 * Check if a thread action button with the given ID exists
 */
export function isThreadActionButtonInjected(id: string): boolean {
	return !!document.getElementById(id)
}

/**
 * Remove a thread action button by ID
 */
export function removeThreadActionButton(id: string): boolean {
	const button = document.getElementById(id)
	if (button) {
		button.remove()
		return true
	}
	return false
}
