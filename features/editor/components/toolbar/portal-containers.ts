// features/editor/components/toolbar/portal-containers.ts
/**
 * Portal Container Factory
 *
 * Creates and manages portal containers for distributing toolbar buttons
 * into specific positions within the native Mediavida toolbar.
 */

import { DOM_MARKERS } from '@/constants'

/**
 * Factory for creating or retrieving a portal container within the native toolbar.
 * Implements a precise positioning strategy to integrate seamlessly with Mediavida's legacy DOM.
 *
 * @param id - Unique identifier for the container
 * @param parent - The native toolbar container
 * @param afterSelector - CSS selector to insert after (fallback)
 * @param beforeSelector - CSS selector to insert before (fallback)
 * @param addSpacer - Whether to inject a native '.spacer' element
 * @param iconClassOrId - Target button identifier (icon class or element ID)
 * @param position - Whether to place 'before' or 'after' the target
 * @returns The container element for React Portals
 */
export function getOrCreatePortalContainer(
	id: string,
	parent: Element,
	afterSelector: string | null,
	beforeSelector: string | null,
	addSpacer: boolean,
	iconClassOrId: string | null = null,
	position: 'before' | 'after' = 'after'
): HTMLElement {
	let container = document.getElementById(id)
	if (container) return container

	container = document.createElement('div')
	container.id = id
	container.className = DOM_MARKERS.CLASSES.TOOLBAR_GROUP
	container.style.display = 'inline-flex'
	container.style.alignItems = 'center'

	// Apply float: left to align with native buttons, unless it's history or PM toolbar
	const isPmToolbar = parent.classList.contains('mvp-pm-toolbar')
	if (id !== 'mvp-group-history' && !isPmToolbar) {
		container.style.float = 'left'
	}

	container.setAttribute(DOM_MARKERS.DATA_ATTRS.INJECTED, 'true')

	// Helper to find target by icon class or element ID
	let target: Element | null = null

	if (iconClassOrId) {
		// First try to find by ID (for our own containers)
		target = document.getElementById(iconClassOrId)

		// If not found by ID, try by icon class
		if (!target) {
			const icon = parent.querySelector(`.${iconClassOrId.replace(/ /g, '.')}`)
			if (icon) {
				target = icon.closest('button') || icon.closest('.btn')
			}
		}
	}

	// Fallback to legacy selectors if icon not found
	if (!target) {
		if (afterSelector) {
			target = parent.querySelector(afterSelector)
			if (target) position = 'after'
		} else if (beforeSelector) {
			target = parent.querySelector(beforeSelector)
			if (target) position = 'before'
		}
	}

	// Logic to insert based on target and position
	if (target) {
		if (position === 'after') {
			if (target.nextSibling) {
				parent.insertBefore(container, target.nextSibling)
			} else {
				parent.appendChild(container)
			}
			// Add spacer after if requested
			if (addSpacer) {
				const nextSibling = container.nextElementSibling
				if (!nextSibling || !nextSibling.classList.contains('spacer')) {
					const spacer = document.createElement('div')
					spacer.className = 'spacer'
					if (container.nextSibling) {
						parent.insertBefore(spacer, container.nextSibling)
					} else {
						parent.appendChild(spacer)
					}
				}
			}
			return container
		} else {
			// Position 'before'
			if (addSpacer) {
				const prevSibling = target.previousElementSibling
				if (!prevSibling || !prevSibling.classList.contains('spacer')) {
					const spacer = document.createElement('div')
					spacer.className = 'spacer'
					parent.insertBefore(spacer, target)
				}
			}
			parent.insertBefore(container, target)
			return container
		}
	}

	// Fallback: append
	if (addSpacer) {
		const spacer = document.createElement('div')
		spacer.className = 'spacer'
		parent.appendChild(spacer)
	}
	parent.appendChild(container)
	return container
}

/** Icon class for the Italic button (anchor point 1) */
export const ITALIC_BUTTON_CLASS = 'fa-italic'

/** Icon class for the Smiley button (anchor point 2) */
export const SMILEY_BUTTON_CLASS = 'fa-smile-o'

/**
 * Container IDs for the portal groups.
 */
export const PORTAL_IDS = {
	FORMATTING: 'mvp-group-formatting',
	STRUCTURE_DROPDOWNS: 'mvp-group-structure-dropdowns',
	MEDIA: 'mvp-group-media',
	CODE: 'mvp-group-code',
	STRUCTURE: 'mvp-group-structure',
	TOOLS: 'mvp-group-tools',
	HISTORY: 'mvp-group-history',
} as const

/**
 * Configuration for creating all toolbar portal containers.
 */
export interface PortalContainerConfig {
	id: string
	addSpacer: boolean
	anchorTo: string
	position: 'before' | 'after'
}

/**
 * Creates all portal containers for the distributed toolbar.
 * Returns an object with references to each container.
 */
export function createAllPortalContainers(toolbarContainer: Element): Record<string, HTMLElement> {
	// GROUP 1: Formatting (U, S, Center) - Insert after Italic
	const formattingContainer = getOrCreatePortalContainer(
		PORTAL_IDS.FORMATTING,
		toolbarContainer,
		null,
		null,
		false,
		ITALIC_BUTTON_CLASS,
		'after'
	)

	// GROUP 2: Dropdowns (Header, List) - After Formatting
	const structureDropdownsContainer = getOrCreatePortalContainer(
		PORTAL_IDS.STRUCTURE_DROPDOWNS,
		toolbarContainer,
		null,
		null,
		true,
		PORTAL_IDS.FORMATTING,
		'after'
	)

	// GROUP 3: Media Extra (Upload, Gif, Cine) - After Smiley
	const mediaContainer = getOrCreatePortalContainer(
		PORTAL_IDS.MEDIA,
		toolbarContainer,
		null,
		null,
		true,
		SMILEY_BUTTON_CLASS,
		'after'
	)

	// GROUP 4: Code - After Media
	const codeContainer = getOrCreatePortalContainer(
		PORTAL_IDS.CODE,
		toolbarContainer,
		null,
		null,
		false,
		PORTAL_IDS.MEDIA,
		'after'
	)

	// GROUP 5: Structure (Table, Index, Poll) - After Code
	const structureContainer = getOrCreatePortalContainer(
		PORTAL_IDS.STRUCTURE,
		toolbarContainer,
		null,
		null,
		true,
		PORTAL_IDS.CODE,
		'after'
	)

	// GROUP 6: Tools (Template, Drafts, Preview) - After Structure
	const toolsContainer = getOrCreatePortalContainer(
		PORTAL_IDS.TOOLS,
		toolbarContainer,
		null,
		null,
		false,
		PORTAL_IDS.STRUCTURE,
		'after'
	)

	// GROUP 7: History - At the absolute right edge
	const historyContainer = getOrCreatePortalContainer(
		PORTAL_IDS.HISTORY,
		toolbarContainer,
		null,
		null,
		false,
		PORTAL_IDS.TOOLS,
		'after'
	)

	return {
		formatting: formattingContainer,
		structureDropdowns: structureDropdownsContainer,
		media: mediaContainer,
		code: codeContainer,
		structure: structureContainer,
		tools: toolsContainer,
		history: historyContainer,
	}
}

/**
 * Configures the history container for absolute positioning at the right edge.
 */
export function configureHistoryContainer(historyContainer: HTMLElement): void {
	historyContainer.style.position = 'absolute'
	historyContainer.style.right = '0'
	historyContainer.style.top = '0'
	historyContainer.style.height = '100%'
	historyContainer.style.paddingLeft = '8px'
	historyContainer.style.display = 'inline-flex'
	historyContainer.style.alignItems = 'center'
	historyContainer.style.float = 'none'
}

/**
 * Ensures the toolbar container is positioned for absolute child elements.
 */
export function ensureRelativePositioning(toolbarContainer: HTMLElement): void {
	if (getComputedStyle(toolbarContainer).position === 'static') {
		toolbarContainer.style.position = 'relative'
	}
}

/**
 * Relocates the native Smiley button next to media group.
 */
export function relocateSmileyButton(toolbarContainer: Element): void {
	const smileyButton = toolbarContainer.querySelector('#emoji-menu') as HTMLElement
	if (smileyButton) {
		smileyButton.style.setProperty('float', 'left', 'important')
		smileyButton.style.marginRight = '0'
	}
}
