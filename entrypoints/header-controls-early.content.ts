/**
 * Early Header Controls
 *
 * Reserves the Mediavida header slots used by MV Premium before the regular
 * content script finishes loading, preventing navbar layout shifts on refresh.
 */
import { defineContentScript } from '#imports'
import { browser } from 'wxt/browser'
import { DOM_MARKERS, MV_SELECTORS, RUNTIME_CACHE_KEYS, STORAGE_KEYS } from '@/constants'

const SEARCH_TRIGGER_ID = DOM_MARKERS.IDS.COMMAND_MENU_TRIGGER
const SEARCH_REPLACED_ATTR = DOM_MARKERS.INJECTION.SEARCH_REPLACED
const EVENT_TRIGGER = DOM_MARKERS.EVENTS.COMMAND_MENU_TRIGGER
const SEARCH_TRIGGER_BOUND_ATTR = 'data-mvp-command-menu-trigger-bound'
const NEW_THREAD_PLACEHOLDER_ATTR = DOM_MARKERS.INJECTION.NEW_THREAD_PLACEHOLDER
const DASHBOARD_PLACEHOLDER_ATTR = 'data-mvp-dashboard-placeholder'
const DASHBOARD_LINK_ATTR = 'data-mvp-dashboard-link'
const OBSERVER_TIMEOUT_MS = 5000

interface SettingsState {
	state?: {
		navbarSearchEnabled?: boolean
	}
}

function readCachedNavbarSearchEnabled(): boolean | null {
	try {
		const cached = localStorage.getItem(RUNTIME_CACHE_KEYS.NAVBAR_SEARCH_ENABLED)
		if (cached === 'true') return true
		if (cached === 'false') return false
		return null
	} catch {
		return null
	}
}

function writeNavbarSearchCache(enabled: boolean): void {
	try {
		localStorage.setItem(RUNTIME_CACHE_KEYS.NAVBAR_SEARCH_ENABLED, String(enabled))
	} catch {
		// Ignore restricted localStorage contexts.
	}
}

function parseNavbarSearchEnabled(raw: unknown): boolean {
	try {
		const parsed: SettingsState = typeof raw === 'string' ? JSON.parse(raw) : (raw as SettingsState)
		return parsed?.state?.navbarSearchEnabled ?? true
	} catch {
		return true
	}
}

function waitForElement(selector: string, callback: (element: HTMLElement) => void): void {
	const existing = document.querySelector<HTMLElement>(selector)
	if (existing) {
		callback(existing)
		return
	}

	const observer = new MutationObserver(() => {
		const element = document.querySelector<HTMLElement>(selector)
		if (!element) return

		observer.disconnect()
		callback(element)
	})

	observer.observe(document.documentElement, {
		childList: true,
		subtree: true,
	})

	setTimeout(() => observer.disconnect(), OBSERVER_TIMEOUT_MS)
}

function createSearchTrigger(): HTMLButtonElement {
	const trigger = document.createElement('button')
	trigger.id = SEARCH_TRIGGER_ID
	trigger.type = 'button'
	trigger.title = 'Super Buscador (Ctrl+K)'
	trigger.setAttribute('aria-label', 'Abrir buscador avanzado')
	trigger.setAttribute(SEARCH_TRIGGER_BOUND_ATTR, 'true')
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

	trigger.addEventListener('click', e => {
		e.preventDefault()
		e.stopPropagation()
		window.dispatchEvent(new CustomEvent(EVENT_TRIGGER))
	})

	return trigger
}

function installSearchTrigger(): void {
	const nativeSearch = document.querySelector<HTMLElement>(MV_SELECTORS.GLOBAL.SEARCH)
	if (!nativeSearch || document.getElementById(SEARCH_TRIGGER_ID)) return

	nativeSearch.setAttribute(SEARCH_REPLACED_ATTR, 'true')
	Array.from(nativeSearch.children).forEach(child => {
		if (child instanceof HTMLElement) {
			child.style.setProperty('display', 'none', 'important')
		}
	})

	nativeSearch.appendChild(createSearchTrigger())
}

function removeSearchTrigger(): void {
	const nativeSearch = document.querySelector<HTMLElement>(MV_SELECTORS.GLOBAL.SEARCH)
	document.getElementById(SEARCH_TRIGGER_ID)?.remove()
	nativeSearch?.removeAttribute(SEARCH_REPLACED_ATTR)

	nativeSearch?.querySelectorAll<HTMLElement>(':scope > *').forEach(child => {
		child.style.removeProperty('display')
	})
}

function verifyNavbarSearchSetting(): void {
	browser.storage.local
		.get(STORAGE_KEYS.SETTINGS)
		.then(data => {
			const enabled = parseNavbarSearchEnabled(data[STORAGE_KEYS.SETTINGS])
			writeNavbarSearchCache(enabled)
			if (enabled) {
				installSearchTrigger()
			} else {
				removeSearchTrigger()
			}
		})
		.catch(() => {
			// Keep cache/default decision if storage read fails.
		})
}

function createNewThreadPlaceholder(): HTMLLIElement {
	const li = document.createElement('li')
	li.id = DOM_MARKERS.IDS.NEW_THREAD_BUTTON
	li.className = 'dropdown'
	li.setAttribute(NEW_THREAD_PLACEHOLDER_ATTR, 'true')

	const button = document.createElement('a')
	button.href = '#'
	button.className = 'flink dropdown-toggle'
	button.setAttribute('title', 'Nuevo hilo')
	button.setAttribute('aria-label', 'Crear nuevo hilo')
	button.innerHTML = `
		<i class="fa fa-plus-circle"></i>
		<span class="title">Nuevo hilo</span>
	`
	button.addEventListener('click', e => {
		e.preventDefault()
		e.stopPropagation()
	})

	li.appendChild(button)
	return li
}

function createDashboardPlaceholder(): HTMLLIElement {
	const li = document.createElement('li')
	li.id = DOM_MARKERS.IDS.DASHBOARD_BUTTON
	li.className = 'mvp-dashboard-nav-item'
	li.setAttribute(DASHBOARD_PLACEHOLDER_ATTR, 'true')

	const button = document.createElement('a')
	button.href = browser.runtime.getURL('/options.html')
	button.className = 'flink mvp-dashboard-link'
	button.setAttribute(DASHBOARD_LINK_ATTR, 'true')
	button.setAttribute('rel', 'noopener noreferrer')
	button.setAttribute('aria-label', 'Abrir panel de MVPremium')
	button.style.position = 'relative'
	button.innerHTML = `
		<img src="${browser.runtime.getURL('/icon/48.png')}" class="mv-dashboard-logo" style="width: 20px; height: 20px; vertical-align: middle; transition: all 0.2s ease-in-out;" />
		<span class="title">Dashboard</span>
	`

	li.appendChild(button)
	return li
}

function installUserMenuPlaceholders(): void {
	const usermenu = document.querySelector<HTMLElement>(MV_SELECTORS.GLOBAL.USERMENU)
	const avatarItem = usermenu?.querySelector<HTMLElement>(MV_SELECTORS.GLOBAL.USERMENU_AVATAR)
	if (!usermenu || !avatarItem) return

	if (!document.getElementById(DOM_MARKERS.IDS.NEW_THREAD_BUTTON)) {
		avatarItem.insertAdjacentElement('afterend', createNewThreadPlaceholder())
	}

	const newThreadButton = document.getElementById(DOM_MARKERS.IDS.NEW_THREAD_BUTTON)
	if (!document.getElementById(DOM_MARKERS.IDS.DASHBOARD_BUTTON)) {
		;(newThreadButton ?? avatarItem).insertAdjacentElement('afterend', createDashboardPlaceholder())
	}
}

export default defineContentScript({
	matches: ['*://www.mediavida.com/*'],
	runAt: 'document_start',

	main() {
		const cachedNavbarSearchEnabled = readCachedNavbarSearchEnabled()
		if (cachedNavbarSearchEnabled !== false) {
			waitForElement(MV_SELECTORS.GLOBAL.SEARCH, installSearchTrigger)
		}
		verifyNavbarSearchSetting()

		waitForElement(MV_SELECTORS.GLOBAL.USERMENU, installUserMenuPlaceholders)
	},
})
