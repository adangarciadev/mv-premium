/**
 * User Card Injector
 * Injects MVP action buttons into MV's native #user-card popover
 */

import { getUserCustomizations, saveUserCustomizations } from '@/features/user-customizations/storage'
import { openNoteDialog } from './components/note-editor-dialog'
import { isMVDarkMode } from '@/lib/theme-utils'
import { DOM_MARKERS } from '@/constants'

const INJECTED_MARKER = DOM_MARKERS.EDITOR.GENERIC_INJECTED
const MVP_ACTIONS_CLASS = DOM_MARKERS.CLASSES.USER_CARD_ACTIONS

/**
 * Initialize the user card observer
 * Watches for the native #user-card to appear and injects buttons
 */
export function initUserCardInjector(): void {
	const observer = new MutationObserver(mutations => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (node instanceof HTMLElement) {
					if (node.id === 'user-card' && node.classList.contains('show')) {
						injectButtons(node)
					}
					const card = node.querySelector?.('#user-card.show')
					if (card instanceof HTMLElement) {
						injectButtons(card)
					}
				}
			}

			if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
				const target = mutation.target as HTMLElement
				if (target.id === 'user-card' && target.classList.contains('show')) {
					injectButtons(target)
				}
			}
		}
	})

	observer.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['class'],
	})
}

/**
 * Injects the custom action buttons into the user card
 */
async function injectButtons(card: HTMLElement): Promise<void> {
	if (card.hasAttribute(INJECTED_MARKER)) return
	card.setAttribute(INJECTED_MARKER, 'true')

	const usernameLink = card.querySelector('.user-info h4 a') as HTMLAnchorElement | null
	if (!usernameLink) return

	const username = usernameLink.textContent?.trim()
	if (!username) return

	const avatarImg = card.querySelector('.user-avatar img') as HTMLImageElement | null
	const avatarUrl = avatarImg?.src || ''

	const data = await getUserCustomizations()
	const userCustomization = data.users[username] || {}

	const controlsContainer = card.querySelector('.user-controls')
	if (!controlsContainer) return

	const isDark = isMVDarkMode()
	injectButtonStyles(isDark)

	const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.1)'

	const actionsDiv = document.createElement('div')
	actionsDiv.className = MVP_ACTIONS_CLASS
	actionsDiv.style.cssText = `
		display: flex !important;
		flex-direction: row !important;
		gap: 6px !important;
		padding: 8px 10px !important;
		border-top: 1px solid ${borderColor} !important;
		background: transparent !important;
		width: 100% !important;
		box-sizing: border-box !important;
		clear: both !important;
	`

	const isIgnoredHide = userCustomization.isIgnored && userCustomization.ignoreType === 'hide'
	const isIgnoredMute = userCustomization.isIgnored && userCustomization.ignoreType === 'mute'
	let currentNote = userCustomization.note || ''

	const hideBtn = createButton('fa-eye-slash', isIgnoredHide ? 'Oculto' : 'Ocultar',
		'Oculta completamente los posts de este usuario', !!isIgnoredHide)
	const muteBtn = createButton('fa-volume-off', isIgnoredMute ? 'Silenciado' : 'Silenciar',
		'Colapsa los mensajes pero permite verlos con un clic', !!isIgnoredMute)
	const noteBtn = createButton('fa-sticky-note-o', currentNote ? 'Nota ✓' : 'Nota',
		'Añade una nota privada a este usuario', !!currentNote)

	hideBtn.addEventListener('click', async e => {
		e.preventDefault()
		await toggleIgnore(username, avatarUrl, 'hide', hideBtn, muteBtn)
	})

	muteBtn.addEventListener('click', async e => {
		e.preventDefault()
		await toggleIgnore(username, avatarUrl, 'mute', hideBtn, muteBtn)
	})

	noteBtn.addEventListener('click', async e => {
		e.preventDefault()
		const newNote = await openNoteEditor(username, currentNote, avatarUrl)
		if (newNote !== null) {
			currentNote = newNote
			updateButtonState(noteBtn, !!currentNote, 'Nota ✓', 'Nota')
		}
	})

	actionsDiv.append(hideBtn, muteBtn, noteBtn)
	card.appendChild(actionsDiv)
}

/** Injects theme-specific active button CSS */
function injectButtonStyles(isDark: boolean): void {
	const styleId = isDark ? DOM_MARKERS.IDS.BTN_STYLES_DARK : DOM_MARKERS.IDS.BTN_STYLES_LIGHT
	const oppositeId = isDark ? DOM_MARKERS.IDS.BTN_STYLES_LIGHT : DOM_MARKERS.IDS.BTN_STYLES_DARK

	document.getElementById(oppositeId)?.remove()

	if (document.getElementById(styleId)) return

	const style = document.createElement('style')
	style.id = styleId
	style.textContent = isDark
		? `.mvp-btn-active { background: rgba(76,175,80,0.25) !important; border-color: #4CAF50 !important; color: #81C784 !important; }
		   .mvp-btn-active:hover { background: rgba(76,175,80,0.35) !important; border-color: #43A047 !important; color: #A5D6A7 !important; box-shadow: 0 0 8px rgba(76,175,80,0.4) !important; text-decoration: none !important; }`
		: `.mvp-btn-active { background: rgba(46,125,50,0.12) !important; border-color: #2E7D32 !important; color: #1B5E20 !important; }
		   .mvp-btn-active:hover { background: rgba(46,125,50,0.2) !important; border-color: #1B5E20 !important; color: #1B5E20 !important; box-shadow: 0 1px 3px rgba(0,0,0,0.12) !important; text-decoration: none !important; }`
	document.head.appendChild(style)
}

/** Creates an action button */
function createButton(icon: string, label: string, tooltip: string, isActive: boolean): HTMLAnchorElement {
	const btn = document.createElement('a')
	btn.href = '#'
	btn.className = `btn ${isActive ? DOM_MARKERS.CLASSES.BTN_ACTIVE : ''}`
	btn.innerHTML = `<i class="fa ${icon}"></i> <span>${label}</span>`
	btn.title = tooltip
	btn.style.cssText = `
		flex: 1 !important; display: flex !important; align-items: center !important;
		justify-content: center !important; gap: 4px !important; margin: 0 !important;
		padding: 6px 4px !important; white-space: nowrap !important; text-decoration: none !important;
	`
	return btn
}

/** Toggle ignore status for a user */
async function toggleIgnore(
	username: string, avatarUrl: string, type: 'hide' | 'mute',
	hideBtn: HTMLElement, muteBtn: HTMLElement
): Promise<void> {
	const data = await getUserCustomizations()
	const existing = data.users[username] || {}

	if (existing.isIgnored && existing.ignoreType === type) {
		delete existing.isIgnored
		delete existing.ignoreType
		if (!Object.values(existing).some(v => v !== undefined && v !== '')) {
			delete data.users[username]
		} else {
			data.users[username] = existing
		}
	} else {
		data.users[username] = { ...existing, isIgnored: true, ignoreType: type, avatarUrl: avatarUrl || existing.avatarUrl }
	}

	await saveUserCustomizations(data)

	const newState = data.users[username]
	updateButtonState(hideBtn, !!(newState?.isIgnored && newState?.ignoreType === 'hide'), 'Oculto', 'Ocultar')
	updateButtonState(muteBtn, !!(newState?.isIgnored && newState?.ignoreType === 'mute'), 'Silenciado', 'Silenciar')

	if (data.users[username]?.isIgnored) {
		setTimeout(() => location.reload(), 300)
	}
}

/** Update button visual state */
function updateButtonState(btn: HTMLElement, isActive: boolean, activeLabel: string, inactiveLabel: string): void {
	btn.querySelector('span')!.textContent = isActive ? activeLabel : inactiveLabel
	btn.classList.toggle('mvp-btn-active', isActive)
	;(btn as HTMLAnchorElement).blur()
}

/** Opens note editor and persists result */
async function openNoteEditor(username: string, currentNote: string, avatarUrl: string): Promise<string | null> {
	const newNote = await openNoteDialog(username, currentNote, avatarUrl)
	if (newNote === null) return null

	const data = await getUserCustomizations()
	const existing = data.users[username] || {}
	const trimmed = newNote.trim()

	if (trimmed) {
		data.users[username] = { ...existing, note: trimmed, avatarUrl: avatarUrl || existing.avatarUrl }
	} else {
		delete existing.note
		if (!Object.values(existing).some(v => v !== undefined && v !== '')) {
			delete data.users[username]
		} else {
			data.users[username] = existing
		}
	}

	await saveUserCustomizations(data)
	return trimmed
}
