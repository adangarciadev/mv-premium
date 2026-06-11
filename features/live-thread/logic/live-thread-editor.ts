/**
 * Live Thread Editor
 *
 * Handles form interception and submission in live mode.
 */
import { POLL_INTERVALS } from './live-thread-state'
import { toggleFormVisibility, type LiveThreadVariant } from './live-thread-dom'
import { pollForNewPosts, getIsLiveActive, setLastPostTimestamp } from './live-thread-polling'
import { logger } from '@/lib/logger'

// =============================================================================
// STATE
// =============================================================================

let currentPollInterval: number = POLL_INTERVALS.NORMAL

interface LiveThreadEditorOptions {
	variant?: LiveThreadVariant
}

// =============================================================================
// FORM INTERCEPTOR
// =============================================================================

export function setupFormInterceptor(options: LiveThreadEditorOptions = {}): void {
	const form = document.querySelector('#postform') as HTMLFormElement
	if (!form) return

	const variant = options.variant ?? 'desktop'
	const handler = async (e: Event) => {
		if (!getIsLiveActive()) return

		e.preventDefault()
		e.stopPropagation()

		// On mobile, the live editor uses OUR OWN #cuerpo placed OUTSIDE #post-editor
		// (so the Android keyboard works), so it may not be inside the form. Read it by
		// id and inject its value into the POST body explicitly.
		const textarea =
			(document.getElementById('cuerpo') as HTMLTextAreaElement | null) ??
			(form.querySelector('textarea#cuerpo, textarea[name="cuerpo"], .editor-body textarea') as HTMLTextAreaElement | null)
		if (!textarea?.value?.trim()) return

		const submitBtn = form.querySelector('#btsubmit') as HTMLButtonElement
		const originalText = submitBtn?.innerHTML || ''
		if (submitBtn) {
			submitBtn.disabled = true
			submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Enviando...'
		}

		try {
			const body = new FormData(form)
			body.set('cuerpo', textarea.value)
			const response = await fetch(form.action, {
				method: 'POST',
				body,
				credentials: 'same-origin',
			})

			if (response.ok) {
				textarea.value = ''
				textarea.dispatchEvent(new Event('input', { bubbles: true }))
				setLastPostTimestamp(Date.now())
				currentPollInterval = POLL_INTERVALS.HIGH_ACTIVITY
				toggleFormVisibility(false, { variant })
				setTimeout(() => void pollForNewPosts(), 100)
			}
		} catch (error) {
			logger.error('LiveThread submit error:', error)
			form.submit()
		} finally {
			if (submitBtn) {
				submitBtn.disabled = false
				submitBtn.innerHTML = originalText
			}
		}
	}

	form.addEventListener('submit', handler, true)
	window.__mvLiveFormHandler = handler
}

export function cleanupFormInterceptor(): void {
	const form = document.querySelector('#postform') as HTMLFormElement
	const handler = window.__mvLiveFormHandler
	if (form && handler) {
		form.removeEventListener('submit', handler, true)
		delete window.__mvLiveFormHandler
	}
}
