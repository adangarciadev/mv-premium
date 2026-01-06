/**
 * Live Thread Editor
 *
 * Handles form interception and submission in live mode.
 */
import { POLL_INTERVALS } from './live-thread-state'
import { toggleFormVisibility } from './live-thread-dom'
import { pollForNewPosts, getIsLiveActive, setLastPostTimestamp } from './live-thread-polling'
import { logger } from '@/lib/logger'

// =============================================================================
// STATE
// =============================================================================

let currentPollInterval: number = POLL_INTERVALS.NORMAL

// =============================================================================
// FORM INTERCEPTOR
// =============================================================================

export function setupFormInterceptor(): void {
	const form = document.querySelector('#postform') as HTMLFormElement
	if (!form) return

	const handler = async (e: Event) => {
		if (!getIsLiveActive()) return

		e.preventDefault()
		e.stopPropagation()

		const textarea = form.querySelector('#cuerpo') as HTMLTextAreaElement
		if (!textarea?.value?.trim()) return

		const submitBtn = form.querySelector('#btsubmit') as HTMLButtonElement
		const originalText = submitBtn?.innerHTML || ''
		if (submitBtn) {
			submitBtn.disabled = true
			submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Enviando...'
		}

		try {
			const response = await fetch(form.action, {
				method: 'POST',
				body: new FormData(form),
				credentials: 'same-origin',
			})

			if (response.ok) {
				textarea.value = ''
				textarea.dispatchEvent(new Event('input', { bubbles: true }))
				setLastPostTimestamp(Date.now())
				currentPollInterval = POLL_INTERVALS.HIGH_ACTIVITY
				toggleFormVisibility(false)
				setTimeout(() => void pollForNewPosts(), 500)
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
