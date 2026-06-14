/**
 * Mobile Lite — editor content actions
 *
 * Mirrors the desktop editor's "Copiar" / "Limpiar" buttons
 * (features/drafts/logic/save-draft-button-inject.ts) but icon-only so they stay
 * compact next to the mobile upload control. Both disable while the editor is
 * empty; copy flashes a check + a toast, clear asks for confirmation through our
 * own alertdialog sheet (never the native window.confirm).
 */

import { logger } from '@/lib/logger'
import { showMobileLiteActionToast } from './action-toast'

const COPY_FEEDBACK_MS = 1300
const COPY_ICON_CLASS = 'fa fa-copy'
const CHECK_ICON_CLASS = 'fa fa-check'
const CLEAR_ICON_CLASS = 'fa fa-trash-o'

const CLEAR_DIALOG_ATTR = 'data-mvp-mobile-lite-clear-dialog'
const CLEAR_DIALOG_STYLE_ID = 'mvp-mobile-lite-clear-dialog-styles'

// Mirror the upload button (`uploadControlStyles.button`): icon + label in a
// native `.btn btn-large`, so all three controls share the same height and look.
const BUTTON_STYLE = [
	'display: inline-flex',
	'align-items: center',
	'justify-content: center',
	'gap: 6px',
	'box-sizing: border-box',
	'white-space: nowrap',
	'min-width: 0',
	'touch-action: manipulation',
	'transition: opacity 120ms ease',
].join(';')

function dispatchTextareaChange(textarea: HTMLTextAreaElement): void {
	textarea.dispatchEvent(new Event('input', { bubbles: true }))
	textarea.dispatchEvent(new Event('change', { bubbles: true }))
}

function createActionButton(iconClass: string, label: string, title: string): { button: HTMLButtonElement; icon: HTMLElement } {
	const button = document.createElement('button')
	button.type = 'button'
	button.className = 'btn btn-large'
	button.style.cssText = BUTTON_STYLE
	button.title = title
	button.setAttribute('aria-label', title)

	const icon = document.createElement('i')
	icon.className = iconClass
	icon.setAttribute('aria-hidden', 'true')

	const text = document.createElement('span')
	text.textContent = label

	button.append(icon, text)
	return { button, icon }
}

function ensureClearDialogStyles(): void {
	if (document.getElementById(CLEAR_DIALOG_STYLE_ID)) return

	const style = document.createElement('style')
	style.id = CLEAR_DIALOG_STYLE_ID
	// Tokens come from DESIGN.md: dialog surface #242a36, radius L (24px), text
	// #eef1f6 / muted #9aa5b4, primary amber #f0a020 (pressed #d98e12), neutral
	// pressed surface #2e3543. §7 "confirm sheet": Cancelar secondary / primary.
	style.textContent = `
		.mvp-ml-clear-overlay {
			position: fixed;
			inset: 0;
			z-index: 100001;
			display: flex;
			align-items: flex-end;
			justify-content: center;
			box-sizing: border-box;
			background: rgba(0, 0, 0, 0.6);
			color: #eef1f6;
			font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
			animation: mvpMlClearFade 160ms ease;
		}
		.mvp-ml-clear-overlay *,
		.mvp-ml-clear-overlay *::before,
		.mvp-ml-clear-overlay *::after {
			box-sizing: border-box;
		}
		.mvp-ml-clear-sheet {
			width: min(100%, 460px);
			background: #242a36;
			border-radius: 24px 24px 0 0;
			padding: 22px 18px calc(18px + env(safe-area-inset-bottom, 0px));
			box-shadow: 0 -14px 44px rgba(0, 0, 0, 0.55);
			animation: mvpMlClearUp 220ms ease;
		}
		.mvp-ml-clear-title {
			margin: 0;
			font-size: 16px;
			font-weight: 700;
			line-height: 1.25;
		}
		.mvp-ml-clear-message {
			margin: 8px 0 0;
			color: #9aa5b4;
			font-size: 13px;
			line-height: 1.45;
		}
		.mvp-ml-clear-actions {
			display: flex;
			gap: 10px;
			margin-top: 22px;
		}
		.mvp-ml-clear-actions button {
			flex: 1;
			height: 44px;
			border: 0;
			border-radius: 12px;
			font-size: 14px;
			font-weight: 700;
			cursor: pointer;
			touch-action: manipulation;
		}
		.mvp-ml-clear-cancel {
			background: #2e3543;
			color: #eef1f6;
		}
		.mvp-ml-clear-cancel:active {
			background: #39414f;
		}
		.mvp-ml-clear-accept {
			background: #f0a020;
			color: #221604;
		}
		.mvp-ml-clear-accept:active {
			background: #d98e12;
		}
		@keyframes mvpMlClearFade {
			from { opacity: 0; }
			to { opacity: 1; }
		}
		@keyframes mvpMlClearUp {
			from { transform: translateY(18px); }
			to { transform: translateY(0); }
		}
	`
	document.head.appendChild(style)
}

/**
 * Our own confirmation sheet for clearing the editor (DESIGN.md §7 alertdialog
 * confirm). Resolves true if the user confirms, false on Cancel / backdrop /
 * Escape. Replaces the native window.confirm so the prompt matches the app.
 */
function confirmMobileLiteClear(): Promise<boolean> {
	return new Promise(resolve => {
		if (!document.body) {
			resolve(false)
			return
		}

		ensureClearDialogStyles()
		document.querySelector(`[${CLEAR_DIALOG_ATTR}]`)?.remove()

		const overlay = document.createElement('div')
		overlay.className = 'mvp-ml-clear-overlay'
		overlay.setAttribute(CLEAR_DIALOG_ATTR, 'true')
		overlay.setAttribute('role', 'alertdialog')
		overlay.setAttribute('aria-modal', 'true')
		overlay.setAttribute('aria-label', 'Vaciar editor')
		overlay.innerHTML = `
			<div class="mvp-ml-clear-sheet">
				<p class="mvp-ml-clear-title">Vaciar editor</p>
				<p class="mvp-ml-clear-message">¿Seguro que quieres vaciar el contenido del editor? Esta acción no se puede deshacer.</p>
				<div class="mvp-ml-clear-actions">
					<button type="button" class="mvp-ml-clear-cancel">Cancelar</button>
					<button type="button" class="mvp-ml-clear-accept">Vaciar</button>
				</div>
			</div>
		`

		let settled = false
		const close = (result: boolean) => {
			if (settled) return
			settled = true
			document.removeEventListener('keydown', onKeyDown, true)
			overlay.remove()
			resolve(result)
		}

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault()
				close(false)
			}
		}

		overlay.addEventListener('click', event => {
			if (event.target === overlay) close(false)
		})
		overlay.querySelector('.mvp-ml-clear-cancel')?.addEventListener('click', () => close(false))
		overlay.querySelector('.mvp-ml-clear-accept')?.addEventListener('click', () => close(true))
		document.addEventListener('keydown', onKeyDown, true)

		document.body.appendChild(overlay)
		overlay.querySelector<HTMLButtonElement>('.mvp-ml-clear-accept')?.focus()
	})
}

/**
 * Builds the editor's copy + clear icon buttons for the given textarea.
 * Returns them in display order (copy, then clear) to append into the controls.
 */
export function createMobileLiteEditorContentActions(textarea: HTMLTextAreaElement): HTMLButtonElement[] {
	const { button: copyButton, icon: copyIcon } = createActionButton(COPY_ICON_CLASS, 'Copiar', 'Copiar contenido al portapapeles')
	const { button: clearButton } = createActionButton(CLEAR_ICON_CLASS, 'Limpiar', 'Limpiar contenido del editor')

	let copyFeedbackTimeout: number | null = null

	const updateState = () => {
		const hasContent = textarea.value.length > 0
		for (const button of [copyButton, clearButton]) {
			button.disabled = !hasContent
			button.style.opacity = hasContent ? '' : '0.5'
		}
	}

	copyButton.addEventListener('click', async event => {
		event.preventDefault()
		event.stopPropagation()
		if (!textarea.value) return

		try {
			await navigator.clipboard.writeText(textarea.value)
			if (copyFeedbackTimeout !== null) window.clearTimeout(copyFeedbackTimeout)
			copyIcon.className = CHECK_ICON_CLASS
			copyFeedbackTimeout = window.setTimeout(() => {
				copyFeedbackTimeout = null
				copyIcon.className = COPY_ICON_CLASS
			}, COPY_FEEDBACK_MS)
			showMobileLiteActionToast('Copiado al portapapeles')
		} catch (error) {
			logger.error('Mobile Lite: failed to copy editor content', error)
			showMobileLiteActionToast('No se pudo copiar', 'fa-exclamation-triangle')
		}
	})

	clearButton.addEventListener('click', async event => {
		event.preventDefault()
		event.stopPropagation()
		if (!textarea.value) return
		if (!(await confirmMobileLiteClear())) return

		textarea.value = ''
		dispatchTextareaChange(textarea)
		updateState()
		textarea.focus()
	})

	textarea.addEventListener('input', updateState)
	updateState()

	return [copyButton, clearButton]
}
