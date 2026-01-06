/**
 * Navbar Button Utility
 *
 * Creates standardized buttons for the Mediavida navbar (#usermenu).
 * Handles common patterns: injection guards, accessibility, click handlers, cleanup.
 *
 * Used by: Dashboard button, New Thread button
 */

import { MV_SELECTORS } from '@/constants/mediavida-selectors'

// =============================================================================
// TYPES
// =============================================================================

export interface NavbarButtonConfig {
	/** Unique identifier for the button (used as data attribute marker) */
	id: string
	/** FontAwesome icon class (e.g., 'fa-plus-circle') or custom HTML */
	icon: string
	/** Button title/label shown in navbar */
	title: string
	/** Tooltip text */
	tooltip: string
	/** Aria-label for accessibility */
	ariaLabel: string
	/** Click handler */
	onClick: (e: MouseEvent, button: HTMLAnchorElement) => void
	/** Optional: Insert after this selector (defaults to 'li.avw') */
	insertAfterSelector?: string
	/** Optional: Additional classes for the button */
	buttonClasses?: string
	/** Optional: Dropdown menu element to attach */
	dropdown?: HTMLElement
}

export interface NavbarButtonResult {
	/** The container <li> element */
	container: HTMLLIElement
	/** The button <a> element */
	button: HTMLAnchorElement
	/** Cleanup function to remove button and event listeners */
	cleanup: () => void
	/** Update button content */
	updateContent: (html: string) => void
	/** Update tooltip */
	updateTooltip: (text: string) => void
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_INSERT_AFTER = MV_SELECTORS.GLOBAL.USERMENU_AVATAR

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Creates and injects a navbar button into #usermenu.
 *
 * @returns NavbarButtonResult if successful, null if injection point not found or already exists
 *
 * @example
 * ```ts
 * const result = createNavbarButton({
 *   id: 'my-feature',
 *   icon: '<i class="fa fa-star"></i>',
 *   title: 'My Feature',
 *   tooltip: 'Open My Feature',
 *   ariaLabel: 'Open My Feature panel',
 *   onClick: (e) => openFeaturePanel()
 * })
 *
 * // Later, cleanup
 * result?.cleanup()
 * ```
 */
export function createNavbarButton(config: NavbarButtonConfig): NavbarButtonResult | null {
	const {
		id,
		icon,
		title,
		tooltip,
		ariaLabel,
		onClick,
		insertAfterSelector = DEFAULT_INSERT_AFTER,
		buttonClasses = '',
		dropdown,
	} = config

	const marker = `mvp-${id}-injected`

	// Find usermenu
	const usermenu = document.querySelector(MV_SELECTORS.GLOBAL.USERMENU)
	if (!usermenu) return null

	// Check if already injected
	if (usermenu.querySelector(`[${marker}]`)) return null

	// Find insertion point
	const insertAfterEl = usermenu.querySelector(insertAfterSelector)
	if (!insertAfterEl) return null

	// Create container
	const container = document.createElement('li')
	container.className = dropdown ? 'dropdown' : ''
	container.setAttribute(marker, 'true')

	// Create button
	const button = document.createElement('a')
	button.href = '#'
	button.className = `flink ${buttonClasses}`.trim()
	button.setAttribute('title', tooltip)
	button.setAttribute('aria-label', ariaLabel)

	if (dropdown) {
		button.className += ' dropdown-toggle'
		button.setAttribute('data-toggle', 'dropdown')
		button.setAttribute('aria-haspopup', 'true')
		button.setAttribute('aria-expanded', 'false')
	}

	// Set content
	const iconHtml = icon.startsWith('<') ? icon : `<i class="fa ${icon}"></i>`
	button.innerHTML = `${iconHtml}<span class="title">${title}</span>`

	// Event handlers storage for cleanup
	let clickHandler: ((e: MouseEvent) => void) | null = null
	let clickOutsideHandler: ((e: Event) => void) | null = null
	let escapeHandler: ((e: KeyboardEvent) => void) | null = null

	// Click handler
	clickHandler = (e: MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()

		if (dropdown) {
			const isOpen = container.classList.toggle('open')
			button.setAttribute('aria-expanded', String(isOpen))
		}

		onClick(e, button)
	}
	button.addEventListener('click', clickHandler)

	// Dropdown-specific handlers
	if (dropdown) {
		clickOutsideHandler = (e: Event) => {
			if (!container.contains(e.target as Node)) {
				container.classList.remove('open')
				button.setAttribute('aria-expanded', 'false')
			}
		}
		document.addEventListener('click', clickOutsideHandler)

		escapeHandler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				container.classList.remove('open')
				button.setAttribute('aria-expanded', 'false')
			}
		}
		document.addEventListener('keydown', escapeHandler)
	}

	// Assemble
	container.appendChild(button)
	if (dropdown) {
		container.appendChild(dropdown)
	}

	// Insert into DOM
	insertAfterEl.insertAdjacentElement('afterend', container)

	// Build result
	const result: NavbarButtonResult = {
		container,
		button,
		cleanup: () => {
			if (clickHandler) {
				button.removeEventListener('click', clickHandler)
				clickHandler = null
			}
			if (clickOutsideHandler) {
				document.removeEventListener('click', clickOutsideHandler)
				clickOutsideHandler = null
			}
			if (escapeHandler) {
				document.removeEventListener('keydown', escapeHandler)
				escapeHandler = null
			}
			container.remove()
		},
		updateContent: (html: string) => {
			button.innerHTML = html
		},
		updateTooltip: (text: string) => {
			button.setAttribute('title', text)
		},
	}

	return result
}

/**
 * Check if a navbar button with the given ID is already injected
 */
export function isNavbarButtonInjected(id: string): boolean {
	const marker = `mvp-${id}-injected`
	const usermenu = document.querySelector(MV_SELECTORS.GLOBAL.USERMENU)
	return !!usermenu?.querySelector(`[${marker}]`)
}

/**
 * Remove a navbar button by ID
 */
export function removeNavbarButton(id: string): boolean {
	const marker = `mvp-${id}-injected`
	const usermenu = document.querySelector(MV_SELECTORS.GLOBAL.USERMENU)
	const button = usermenu?.querySelector(`[${marker}]`)
	if (button) {
		button.remove()
		return true
	}
	return false
}
