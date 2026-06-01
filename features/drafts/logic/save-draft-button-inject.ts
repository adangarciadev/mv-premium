/**
 * Injects "Guardar borrador" button next to submit buttons
 * This allows users to manually save drafts without auto-saving on every keystroke
 */

import { DOM_MARKERS } from '@/constants'
import { logger } from '@/lib/logger'

const INJECTED_MARKER = DOM_MARKERS.EDITOR.SAVE_DRAFT_BTN
const STATUS_CONTAINER_ID = DOM_MARKERS.IDS.DRAFT_STATUS_CONTAINER
const SAVE_DRAFT_BUTTON_CLASS = 'mvp-save-draft-action'
const COPY_BUTTON_CLASS = 'mvp-copy-content-action'
const CLEAR_BUTTON_CLASS = 'mvp-clear-content-action'
const COPY_BUTTON_DEFAULT_HTML = '<i class="fa fa-copy"></i> Copiar'
const COPY_BUTTON_SUCCESS_HTML = '<i class="fa fa-check"></i> Copiado'
const COPY_FEEDBACK_MS = 1000

function dispatchTextareaChange(textarea: HTMLTextAreaElement): void {
	textarea.dispatchEvent(new Event('input', { bubbles: true }))
	textarea.dispatchEvent(new Event('change', { bubbles: true }))
}

function updateContentActionState(textarea: HTMLTextAreaElement, ...buttons: HTMLButtonElement[]): void {
	const hasContent = textarea.value.length > 0
	buttons.forEach(button => {
		button.disabled = !hasContent
		button.style.opacity = hasContent ? '' : '0.55'
		button.style.cursor = hasContent ? '' : 'not-allowed'
	})
}

function lockCopyButtonFeedback(copyBtn: HTMLButtonElement): void {
	copyBtn.disabled = true
	copyBtn.style.opacity = ''
	copyBtn.style.cursor = 'default'
}

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
		saveDraftBtn.className = `btn btn-large ${SAVE_DRAFT_BUTTON_CLASS}`
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
		copyBtn.className = `btn btn-large ${COPY_BUTTON_CLASS}`
		copyBtn.innerHTML = COPY_BUTTON_DEFAULT_HTML
		copyBtn.title = 'Copiar contenido al portapapeles'
		copyBtn.style.cssText = 'margin-left: 5px;'
		let copyFeedbackActive = false
		let copyFeedbackTimeout: number | null = null

		// Handle click - copy textarea content to clipboard
		copyBtn.addEventListener('click', async e => {
			e.preventDefault()
			e.stopPropagation()
			try {
				await navigator.clipboard.writeText(textarea.value)
				if (copyFeedbackTimeout !== null) {
					window.clearTimeout(copyFeedbackTimeout)
				}
				copyFeedbackActive = true
				copyBtn.innerHTML = COPY_BUTTON_SUCCESS_HTML
				lockCopyButtonFeedback(copyBtn)
				copyFeedbackTimeout = window.setTimeout(() => {
					copyFeedbackActive = false
					copyFeedbackTimeout = null
					copyBtn.innerHTML = COPY_BUTTON_DEFAULT_HTML
					updateContentActionState(textarea, copyBtn, clearBtn)
				}, COPY_FEEDBACK_MS)
				import('@/lib/lazy-toast').then(({ toast }) => {
					toast.success('Contenido copiado al portapapeles')
				})
			} catch (error) {
				logger.error('Failed to copy editor content:', error)
				import('@/lib/lazy-toast').then(({ toast }) => {
					toast.error('No se pudo copiar el contenido')
				})
			}
		})

		// Create clear button
		const clearBtn = document.createElement('button')
		clearBtn.type = 'button'
		clearBtn.className = `btn btn-large ${CLEAR_BUTTON_CLASS}`
		clearBtn.innerHTML = '<i class="fa fa-trash-o"></i> Limpiar'
		clearBtn.title = 'Limpiar contenido del editor'
		clearBtn.style.cssText = 'margin-left: 5px;'

		clearBtn.addEventListener('click', e => {
			e.preventDefault()
			e.stopPropagation()
			if (!textarea.value) return
			if (!window.confirm('¿Seguro que quieres vaciar el contenido del editor?')) return

			textarea.value = ''
			dispatchTextareaChange(textarea)
			updateContentActionState(textarea, copyBtn, clearBtn)
			textarea.focus()
			import('@/lib/lazy-toast').then(({ toast }) => {
				toast.success('Contenido limpiado')
			})
		})

		const updateActionButtons = () => {
			updateContentActionState(textarea, copyBtn, clearBtn)
			if (copyFeedbackActive) {
				lockCopyButtonFeedback(copyBtn)
			}
		}
		textarea.addEventListener('input', updateActionButtons)
		updateActionButtons()

		// Insert content actions right after save draft button
		saveDraftBtn.insertAdjacentElement('afterend', copyBtn)
		copyBtn.insertAdjacentElement('afterend', clearBtn)

		// Create status container after content actions
		const statusContainer = document.createElement('span')
		statusContainer.id = STATUS_CONTAINER_ID
		statusContainer.style.cssText =
			'margin-left: 10px; display: inline-flex; align-items: center; vertical-align: middle;'
		clearBtn.insertAdjacentElement('afterend', statusContainer)
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
		container.querySelector(`.${SAVE_DRAFT_BUTTON_CLASS}`)?.remove()
		container.querySelector(`.${COPY_BUTTON_CLASS}`)?.remove()
		container.querySelector(`.${CLEAR_BUTTON_CLASS}`)?.remove()
		container.querySelector(`#${STATUS_CONTAINER_ID}`)?.remove()
	})
}
