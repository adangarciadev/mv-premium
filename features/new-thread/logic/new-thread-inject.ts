/**
 * New Thread Button Injection
 * Injects a "+" button into the user menu that shows a dropdown to create new threads
 * Replicates native Mediavida dropdown styling
 * Shows favorite subforums first with a star icon
 */

import {
	SUBFORUMS,
	SUBFORUMS_JUEGOS,
	SUBFORUMS_TECNOLOGIA,
	SUBFORUMS_COMUNIDAD,
	ALL_SUBFORUMS,
	getNewThreadUrl,
	type SubforumInfo,
} from '@/lib/subforums'
import { getFavoriteSubforums } from '@/features/favorite-subforums/logic/storage'
import { DOM_MARKERS, MV_SELECTORS } from '@/constants'

const INJECTED_MARKER = DOM_MARKERS.INJECTION.NEW_THREAD
const BUTTON_CONTAINER_ID = DOM_MARKERS.IDS.NEW_THREAD_BUTTON

// Store handlers for cleanup
let clickOutsideHandler: ((e: Event) => void) | null = null
let escapeHandler: ((e: KeyboardEvent) => void) | null = null
let favoritesChangeHandler: (() => void) | null = null

/**
 * Check if user is logged in (user menu exists)
 */
function isUserLoggedIn(): boolean {
	return document.querySelector(MV_SELECTORS.GLOBAL.USERMENU) !== null
}

/**
 * Create a subforum list item for the dropdown
 * @param subforum - The subforum info
 * @param isFavorite - Whether to show the star icon
 */
function createSubforumItem(subforum: SubforumInfo, isFavorite: boolean = false): HTMLLIElement {
	const li = document.createElement('li')
	const a = document.createElement('a')
	a.href = getNewThreadUrl(subforum.slug)

	// Force flexbox with !important to overcome native styles
	a.style.setProperty('display', 'flex', 'important')
	a.style.setProperty('align-items', 'center', 'important')
	a.style.setProperty('width', '100%', 'important')
	a.style.setProperty('padding', '5px 12px', 'important') // Reduced padding
	a.style.setProperty('box-sizing', 'border-box', 'important')
	a.style.setProperty('line-height', '1.2', 'important') // Tighter line height

	const starIcon = isFavorite
		? '<i class="fa fa-star" style="color: #f1c40f; flex-shrink: 0; font-size: 11px; margin-left: auto;"></i>' // Smaller star
		: ''

	// Wrap text and icon in a span that takes use of flex-grow if needed
	a.innerHTML = `
		<span style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
			<i class="fid fid-${subforum.iconId}"></i> 
			<span style="overflow: hidden; text-overflow: ellipsis;">${subforum.name}</span>
		</span>
		${starIcon}
	`

	li.appendChild(a)
	return li
}

/**
 * Create a separator for the dropdown
 */
function createSeparator(): HTMLLIElement {
	const li = document.createElement('li')
	li.setAttribute('role', 'separator')
	li.className = 'divider'
	return li
}

/**
 * Builds the dropdown menu structure, prioritizing favorite subforums at the top.
 */
async function buildDropdownMenu(): Promise<HTMLUListElement> {
	const ul = document.createElement('ul')
	ul.className = 'dropdown-menu dropdown-menu-lg pull-right'
	ul.id = DOM_MARKERS.IDS.NEW_THREAD_DROPDOWN

	// Force container styles
	ul.style.setProperty('max-height', '450px', 'important')
	ul.style.setProperty('overflow-y', 'auto', 'important')
	ul.style.setProperty('overflow-x', 'hidden', 'important')
	ul.style.setProperty('width', '320px', 'important') // Fixed width to prevent scroll
	ul.style.setProperty('min-width', '320px', 'important')
	ul.style.setProperty('padding', '5px 0', 'important')

	// Get favorite subforums
	const favorites = await getFavoriteSubforums()
	const favoriteIds = new Set(favorites.map(f => f.id))

	// Add favorites first (if any)
	if (favorites.length > 0) {
		// Find matching SubforumInfo for each favorite
		favorites.forEach(fav => {
			const subforumInfo = ALL_SUBFORUMS.find(s => s.slug === fav.id)
			if (subforumInfo) {
				ul.appendChild(createSubforumItem(subforumInfo, true))
			}
		})
		ul.appendChild(createSeparator())
	}

	// General subforums (excluding favorites)
	SUBFORUMS.filter(s => !favoriteIds.has(s.slug)).forEach(subforum => {
		ul.appendChild(createSubforumItem(subforum, false))
	})

	// Separator + Juegos (excluding favorites)
	const juegosFiltered = SUBFORUMS_JUEGOS.filter(s => !favoriteIds.has(s.slug))
	if (juegosFiltered.length > 0) {
		ul.appendChild(createSeparator())
		juegosFiltered.forEach(subforum => {
			ul.appendChild(createSubforumItem(subforum, false))
		})
	}

	// Separator + Tecnología (excluding favorites)
	const techFiltered = SUBFORUMS_TECNOLOGIA.filter(s => !favoriteIds.has(s.slug))
	if (techFiltered.length > 0) {
		ul.appendChild(createSeparator())
		techFiltered.forEach(subforum => {
			ul.appendChild(createSubforumItem(subforum, false))
		})
	}

	// Separator + Comunidad (excluding favorites)
	const comFiltered = SUBFORUMS_COMUNIDAD.filter(s => !favoriteIds.has(s.slug))
	if (comFiltered.length > 0) {
		ul.appendChild(createSeparator())
		comFiltered.forEach(subforum => {
			ul.appendChild(createSubforumItem(subforum, false))
		})
	}

	return ul
}

/**
 * Injects the "+" (New Thread) button into the user navigation menu.
 * Handles the dropdown lifecycle and automatic updates when favorites change.
 */
export async function injectNewThreadButton(): Promise<void> {
	// Only inject for logged-in users
	if (!isUserLoggedIn()) return

	const usermenu = document.querySelector(MV_SELECTORS.GLOBAL.USERMENU)
	if (!usermenu) return

	// Early guard before async work
	if (usermenu.querySelector(`[${INJECTED_MARKER}]`)) return

	// Find insertion point - after avatar, before notifications
	const avatarItem = usermenu.querySelector(MV_SELECTORS.GLOBAL.USERMENU_AVATAR)
	if (!avatarItem) return

	// Build dropdown menu (async) - do this BEFORE creating container
	const dropdown = await buildDropdownMenu()

	// DOM guard AFTER await to prevent async race condition
	if (document.getElementById(BUTTON_CONTAINER_ID)) return
	if (usermenu.querySelector(`[${INJECTED_MARKER}]`)) return

	// Create the button container
	const li = document.createElement('li')
	li.id = BUTTON_CONTAINER_ID
	li.className = 'dropdown'
	li.setAttribute(INJECTED_MARKER, 'true')

	// Create the button
	const button = document.createElement('a')
	button.href = '#'
	button.className = 'flink dropdown-toggle'
	button.setAttribute('data-toggle', 'dropdown')
	button.setAttribute('title', 'Nuevo hilo')
	button.setAttribute('aria-label', 'Crear nuevo hilo')
	button.setAttribute('aria-haspopup', 'true')
	button.setAttribute('aria-expanded', 'false')
	button.innerHTML = `
		<i class="fa fa-plus-circle"></i>
		<span class="title">Nuevo hilo</span>
	`

	// Store dropdown reference for updates
	let currentDropdown = dropdown

	// Toggle dropdown on click
	button.addEventListener('click', e => {
		e.preventDefault()
		e.stopPropagation()
		const isOpen = li.classList.toggle('open')
		button.setAttribute('aria-expanded', String(isOpen))
	})

	// Close dropdown when clicking outside
	clickOutsideHandler = (e: Event) => {
		if (!li.contains(e.target as Node)) {
			li.classList.remove('open')
			button.setAttribute('aria-expanded', 'false')
		}
	}
	document.addEventListener('click', clickOutsideHandler)

	// Close dropdown on Escape
	escapeHandler = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			li.classList.remove('open')
			button.setAttribute('aria-expanded', 'false')
		}
	}
	document.addEventListener('keydown', escapeHandler)

	// Assemble
	li.appendChild(button)
	li.appendChild(currentDropdown)

	// Insert after avatar
	avatarItem.insertAdjacentElement('afterend', li)

	// Listen for favorites changes and rebuild dropdown
	favoritesChangeHandler = async () => {
		const newDropdown = await buildDropdownMenu()
		currentDropdown.replaceWith(newDropdown)
		currentDropdown = newDropdown
	}
	window.addEventListener(DOM_MARKERS.EVENTS.FAVORITE_SUBFORUMS_CHANGED, favoritesChangeHandler)
}

/**
 * Cleanup function - removes DOM and event listeners
 */
export function cleanupNewThreadButton(): void {
	// Remove DOM element
	const button = document.querySelector(`[${INJECTED_MARKER}]`)
	if (button) {
		button.remove()
	}

	// Remove event listeners
	if (clickOutsideHandler) {
		document.removeEventListener('click', clickOutsideHandler)
		clickOutsideHandler = null
	}

	if (escapeHandler) {
		document.removeEventListener('keydown', escapeHandler)
		escapeHandler = null
	}

	if (favoritesChangeHandler) {
		window.removeEventListener(DOM_MARKERS.EVENTS.FAVORITE_SUBFORUMS_CHANGED, favoritesChangeHandler)
		favoritesChangeHandler = null
	}
}
