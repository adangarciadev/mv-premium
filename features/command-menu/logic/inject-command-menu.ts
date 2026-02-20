/**
 * Command Menu Lazy Loader
 *
 * Optimized to load the heavy CMDK component only when:
 * 1. User presses Ctrl+K / Cmd+K
 * 2. User clicks the search trigger button
 *
 * Initial load: Only vanilla JS event listeners (~2KB)
 * On-demand load: Full React + CMDK + components (~50KB)
 */

import { DOM_MARKERS, FEATURE_IDS, MV_SELECTORS } from '@/constants'
import { getSettings } from '@/store/settings-store'

const FEATURE_ID = FEATURE_IDS.COMMAND_MENU
const CONTAINER_ID = DOM_MARKERS.IDS.COMMAND_MENU
const EVENT_TRIGGER = DOM_MARKERS.EVENTS.COMMAND_MENU_TRIGGER
const EVENT_OPEN = DOM_MARKERS.EVENTS.COMMAND_MENU_OPEN
let initialized = false
let commandMenuLoaded = false
let loadPromise: Promise<void> | null = null

// Store handlers for cleanup
let keydownHandler: ((e: KeyboardEvent) => void) | null = null
let triggerHandler: (() => void) | null = null

/**
 * Lazily loads the CommandMenu dependencies and mounts the React root.
 * Ensures that heavy libraries are only loaded upon explicit user intent.
 * @returns Promise that resolves when the component is ready
 */
async function loadCommandMenu(): Promise<void> {
	if (commandMenuLoaded) return
	if (loadPromise) return loadPromise

	loadPromise = (async () => {
		// Dynamic imports - these chunks are NOT loaded until this function is called
		const [{ CommandMenu }, { ShadowWrapper }, { mountFeatureWithBoundary }] = await Promise.all([
			import('../components/command-menu'),
			import('@/components/shadow-wrapper'),
			import('@/lib/content-modules/utils/react-helpers'),
		])

		// Import React for createElement
		const { createElement } = await import('react')

		// Create container if not exists
		if (!document.getElementById(CONTAINER_ID)) {
			const container = document.createElement('div')
			container.id = CONTAINER_ID
			document.body.appendChild(container)
		}

		const container = document.getElementById(CONTAINER_ID)!

		// Mount the component using createElement (no JSX needed)
		mountFeatureWithBoundary(FEATURE_ID, container, createElement(ShadowWrapper, null, createElement(CommandMenu)), 'Menú de Comandos')

		commandMenuLoaded = true
	})()

	return loadPromise
}

/**
 * Triggers the command menu to open.
 * Orchestrates the loading sequence and dispatches the activation event.
 */
async function openCommandMenu(): Promise<void> {
	const wasAlreadyLoaded = commandMenuLoaded
	await loadCommandMenu()

	// If this is the first load, wait a bit longer for React to fully mount
	// If already loaded, dispatch immediately
	const delay = wasAlreadyLoaded ? 0 : 100

	setTimeout(() => {
		window.dispatchEvent(new CustomEvent(EVENT_OPEN))
	}, delay)
}

/**
 * Main entry point for the Command Menu.
 * Sets up lightweight global listeners for keyboard shortcuts and external triggers.
 */
export async function injectCommandMenu(): Promise<void> {
	if (initialized) return
	initialized = true

	// 1. Global keyboard shortcut (Ctrl+K / Cmd+K) - LIGHTWEIGHT
	keydownHandler = (e: KeyboardEvent) => {
		if ((e.key === 'k' || e.code === 'KeyK') && (e.metaKey || e.ctrlKey)) {
			e.preventDefault()
			e.stopPropagation()
			void openCommandMenu()
		}
	}

	document.addEventListener('keydown', keydownHandler, true)

	// 2. Listen for external trigger events (from header search button)
	triggerHandler = () => {
		void openCommandMenu()
	}

	window.addEventListener(EVENT_TRIGGER, triggerHandler)

	// 3. Replace native search with our trigger button (only if enabled)
	const settings = await getSettings()
	const navbarSearchEnabled = settings.navbarSearchEnabled ?? true

	if (navbarSearchEnabled) {
		injectHeaderSearchTrigger()
	}
}

/**
 * Removes global event listeners and resets the Command Menu initialization state.
 */
export function cleanupCommandMenu(): void {
	if (keydownHandler) {
		document.removeEventListener('keydown', keydownHandler, true)
		keydownHandler = null
	}

	if (triggerHandler) {
		window.removeEventListener(EVENT_TRIGGER, triggerHandler)
		triggerHandler = null
	}

	const container = document.getElementById(CONTAINER_ID)
	if (container) {
		// Defer import to keep initial bundle small
		void (async () => {
			const { unmountFeature } = await import('@/lib/content-modules/utils/react-helpers')
			unmountFeature(FEATURE_ID)
			container.remove()
		})()
	}

	commandMenuLoaded = false
	loadPromise = null

	initialized = false
}

/**
 * Injects a placeholder button into the native Mediavida header that triggers the
 * advanced command menu. Mimics the site's aesthetic for seamless integration.
 */
function injectHeaderSearchTrigger(): void {
	const nativeSearch = document.querySelector(MV_SELECTORS.GLOBAL.SEARCH)
	if (!nativeSearch || nativeSearch.hasAttribute(DOM_MARKERS.INJECTION.SEARCH_REPLACED)) return

	nativeSearch.setAttribute(DOM_MARKERS.INJECTION.SEARCH_REPLACED, 'true')

	// Completely hide ALL children of #buscar
	Array.from(nativeSearch.children).forEach(child => {
		;(child as HTMLElement).style.display = 'none'
	})

	// Create our trigger button
	const trigger = document.createElement('button')
	trigger.id = DOM_MARKERS.IDS.COMMAND_MENU_TRIGGER
	trigger.type = 'button'
	trigger.title = 'Super Buscador (Ctrl+K)'
	trigger.setAttribute('aria-label', 'Abrir buscador avanzado')
	trigger.innerHTML = `
    <i class="fa fa-search" style="font-size: 12px; opacity: 0.5;"></i>
    <span style="flex: 1; text-align: left; opacity: 0.5; font-size: 12px; font-weight: 400;">Buscar...</span>
    <kbd style="
      background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: var(--radius, 4px);
      padding: 2px 5px;
      font-size: 10px;
      font-family: system-ui, -apple-system, sans-serif;
      color: rgba(255,255,255,0.4);
      font-weight: 500;
    ">⌘ K</kbd>
  `

	// Apply styles to match MV header aesthetic - more compact and subtle
	Object.assign(trigger.style, {
		display: 'flex',
		alignItems: 'center',
		gap: '8px',
		width: '200px',
		height: '28px',
		padding: '0 10px',
		marginTop: '7px',
		background: 'rgba(0,0,0,0.25)',
		border: '1px solid rgba(255,255,255,0.12)',
		borderRadius: 'var(--radius, 6px)',
		cursor: 'pointer',
		color: 'rgba(255,255,255,0.6)',
	})

	// Hover effect
	trigger.addEventListener('mouseenter', () => {
		trigger.style.background = 'rgba(0,0,0,0.3)'
		trigger.style.borderColor = 'rgba(255,255,255,0.15)'
		trigger.style.color = 'rgba(255,255,255,0.8)'
	})
	trigger.addEventListener('mouseleave', () => {
		trigger.style.background = 'rgba(0,0,0,0.2)'
		trigger.style.borderColor = 'rgba(255,255,255,0.08)'
		trigger.style.color = 'rgba(255,255,255,0.6)'
	})

	// Click opens Command Menu via trigger event
	trigger.addEventListener('click', e => {
		e.preventDefault()
		e.stopPropagation()
		// Use trigger event instead of direct open event
		window.dispatchEvent(new CustomEvent(EVENT_TRIGGER))
	})

	// Append to the search container
	nativeSearch.appendChild(trigger)
}
