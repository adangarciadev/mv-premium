/**
 * Injects "Guardar borrador" button next to submit buttons
 * This allows users to manually save drafts without auto-saving on every keystroke
 */

import { DOM_MARKERS } from '@/constants'

const INJECTED_MARKER = DOM_MARKERS.EDITOR.SAVE_DRAFT_BTN
const STATUS_CONTAINER_ID = DOM_MARKERS.IDS.DRAFT_STATUS_CONTAINER

/**
 * Injects a "Save Draft" button next to native submit buttons.
 * Orchestrates manual draft persistence and status reporting.
 */
export function injectSaveDraftButton(): void {
	// Target containers for the save button
	const targets = [
		// New thread / Edit thread: div.cf with submit button
		'.wpx form .cf button[type="submit"]',
		// Quick reply: .editor-meta with submit button
		'.editor-meta button[type="submit"]#btsubmit',
	]

	targets.forEach(selector => {
		const submitBtn = document.querySelector(selector)
		if (!submitBtn) return

		const container = submitBtn.parentElement
		if (!container || container.hasAttribute(INJECTED_MARKER)) return

		// Mark as injected
		container.setAttribute(INJECTED_MARKER, 'true')

		// Find the textarea in the form
		const form = container.closest('form')
		const textarea = form?.querySelector('textarea#cuerpo') as HTMLTextAreaElement | null
		if (!textarea) return

		// Create save draft button
		const saveDraftBtn = document.createElement('button')
		saveDraftBtn.type = 'button'
		saveDraftBtn.className = 'btn btn-large'
		saveDraftBtn.innerHTML = '<i class="fa fa-save"></i> Guardar borrador'
		saveDraftBtn.title = 'Guardar borrador (Ctrl+S)'
		saveDraftBtn.style.cssText = 'margin-left: 8px;'

		// Handle click - dispatch custom event to DraftManager
		saveDraftBtn.addEventListener('click', e => {
			e.preventDefault()
			e.stopPropagation()
			textarea.dispatchEvent(new CustomEvent(DOM_MARKERS.EVENTS.SAVE_DRAFT, { bubbles: true }))
		})

		// Insert after submit button for new thread, or before for quick reply
		if (selector.includes('editor-meta')) {
			// Quick reply: insert after submit button
			submitBtn.insertAdjacentElement('afterend', saveDraftBtn)
		} else {
			// New thread: insert after preview button or submit button
			const previewBtn = container.querySelector('#btpreview')
			if (previewBtn) {
				previewBtn.insertAdjacentElement('afterend', saveDraftBtn)
				saveDraftBtn.classList.add('right')
				saveDraftBtn.style.marginRight = '0'
				saveDraftBtn.style.marginLeft = '5px'
			} else {
				submitBtn.insertAdjacentElement('afterend', saveDraftBtn)
			}
		}

		// Create copy button
		const copyBtn = document.createElement('button')
		copyBtn.type = 'button'
		copyBtn.className = 'btn btn-large'
		copyBtn.innerHTML = '<i class="fa fa-copy"></i> Copiar'
		copyBtn.title = 'Copiar contenido al portapapeles'
		copyBtn.style.cssText = 'margin-left: 5px;'

		// Handle click - copy textarea content to clipboard
		copyBtn.addEventListener('click', e => {
			e.preventDefault()
			e.stopPropagation()
			navigator.clipboard.writeText(textarea.value).then(() => {
				import('@/lib/lazy-toast').then(({ toast }) => {
					toast.success('Contenido copiado al portapapeles')
				})
			})
		})

		// Insert copy button right after save draft button
		saveDraftBtn.insertAdjacentElement('afterend', copyBtn)

		// Create status container after copy button
		const statusContainer = document.createElement('span')
		statusContainer.id = STATUS_CONTAINER_ID
		statusContainer.style.cssText =
			'margin-left: 10px; display: inline-flex; align-items: center; vertical-align: middle;'
		copyBtn.insertAdjacentElement('afterend', statusContainer)
	})

	// Also setup Ctrl+S keyboard shortcut
	setupKeyboardShortcut()
}

let keyboardShortcutSetup = false

/**
 * Hooks the standard Ctrl+S (or Cmd+S) shortcut to trigger a draft save event.
 */
function setupKeyboardShortcut(): void {
	if (keyboardShortcutSetup) return
	keyboardShortcutSetup = true

	document.addEventListener('keydown', e => {
		// Ctrl+S or Cmd+S to save draft
		if ((e.ctrlKey || e.metaKey) && e.key === 's') {
			const activeElement = document.activeElement
			if (activeElement?.tagName === 'TEXTAREA' && activeElement.id === 'cuerpo') {
				e.preventDefault()
				activeElement.dispatchEvent(new CustomEvent(DOM_MARKERS.EVENTS.SAVE_DRAFT, { bubbles: true }))
			}
		}
	})
}

/**
 * Removes all injected "Save Draft" buttons and restores native UI state.
 */
export function cleanupSaveDraftButton(): void {
	const buttons = document.querySelectorAll(`[${INJECTED_MARKER}]`)
	buttons.forEach(container => {
		container.removeAttribute(INJECTED_MARKER)
		const saveBtn = container.querySelector('.btn:has(.fa-save)')
		saveBtn?.remove()
	})
}
