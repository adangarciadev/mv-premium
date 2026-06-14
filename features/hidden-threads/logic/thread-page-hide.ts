/**
 * Thread-page "Ocultar hilo" action.
 *
 * Lets the user hide the thread they are currently reading from inside the
 * thread itself. The button DOM differs per platform (desktop uses the shared
 * extra-actions row; Mobile Lite injects an inline pill into #more-actions), so
 * this module owns the shared behaviour only:
 *
 * - `performThreadHide`: hide → countdown toast → redirect to the subforum.
 * - `setupHiddenThreadGuard`: bounce the user out of any hidden thread on load
 *   (and on bfcache restore), so a hidden thread can never be reopened — not
 *   even with the browser back button.
 *
 * Hiding the current thread can't make the page vanish (the list filter only
 * acts on thread rows), so we redirect away. We use `location.replace` so the
 * hidden thread is dropped from history; the load guard is the safety net for
 * every other way back in.
 */

import { logger } from '@/lib/logger'
import { isThreadPage } from '@/lib/content-modules/utils/page-detection'
import { createThreadActionButton, removeThreadActionButton } from '@/lib/content-modules/utils/thread-action-button'
import { useSettingsStore } from '@/store/settings-store'
import { hideThreadFromUrl, isThreadHidden } from './storage'
import { extractSubforumIdFromThreadPath, normalizeThreadPath } from './thread-utils'

const HIDE_BUTTON_ID = 'mvp-thread-page-hide-btn'

/** Seconds the confirmation toast counts down before redirecting. */
export const REDIRECT_COUNTDOWN_SECONDS = 3

export interface ThreadPageHideNotifier {
	/** Called once per second with the seconds left before the redirect. */
	onCountdown: (secondsLeft: number) => void
	/** Shown when the thread could not be hidden. */
	onError: () => void
}

let guardInitialized = false

function areHideThreadControlsEnabled(): boolean {
	return useSettingsStore.getState().hideThreadEnabled !== false
}

/**
 * Resolves where to send the user after leaving the thread they are reading.
 * Falls back to the forum index when the subforum can't be derived.
 */
export function resolveHiddenThreadRedirectTarget(url: string): string {
	return extractSubforumIdFromThreadPath(normalizeThreadPath(url)) ?? '/foro'
}

/**
 * Hides the current thread, then counts down and redirects to its subforum.
 * `lockElement` (the clicked button) is disabled so a double tap can't fire
 * two hides / redirects.
 */
export async function performThreadHide(notifier: ThreadPageHideNotifier, lockElement?: HTMLElement): Promise<void> {
	if (!areHideThreadControlsEnabled()) return

	const url = window.location.href
	const target = resolveHiddenThreadRedirectTarget(url)

	if (lockElement) {
		lockElement.style.pointerEvents = 'none'
		lockElement.style.opacity = '0.6'
	}

	const restore = () => {
		if (!lockElement) return
		lockElement.style.pointerEvents = ''
		lockElement.style.opacity = ''
	}

	try {
		const hidden = await hideThreadFromUrl(url)
		if (!hidden) {
			notifier.onError()
			restore()
			return
		}

		let remaining = REDIRECT_COUNTDOWN_SECONDS
		notifier.onCountdown(remaining)

		const interval = window.setInterval(() => {
			remaining -= 1
			if (remaining <= 0) {
				window.clearInterval(interval)
				window.location.replace(target)
				return
			}
			notifier.onCountdown(remaining)
		}, 1000)
	} catch (error) {
		logger.error('Failed to hide thread from thread page:', error)
		notifier.onError()
		restore()
	}
}

/**
 * Redirects away from the current thread if it is hidden. Returns true when a
 * redirect was triggered. Not gated by the hide-controls toggle: a hidden
 * thread stays inaccessible regardless of whether the button is shown (same as
 * how hidden rows are always filtered from listings).
 */
export async function redirectIfThreadHidden(): Promise<boolean> {
	if (!isThreadPage()) return false

	const url = window.location.href
	if (!(await isThreadHidden(url))) return false

	window.location.replace(resolveHiddenThreadRedirectTarget(url))
	return true
}

/**
 * Installs the hidden-thread guard: checks once on load and again whenever the
 * page is restored from the back/forward cache (where the content script does
 * not re-run). Idempotent.
 */
export function setupHiddenThreadGuard(): void {
	if (guardInitialized) return
	guardInitialized = true

	void redirectIfThreadHidden()
	window.addEventListener('pageshow', event => {
		if (event.persisted) void redirectIfThreadHidden()
	})
}

/**
 * Injects the desktop "Ocultar hilo" button into the shared thread-actions row
 * (next to Guardar / Galería / Resumir). Idempotent; removes the button when
 * the feature is disabled.
 */
export function injectThreadPageHideButton(notifier: ThreadPageHideNotifier): void {
	if (!isThreadPage()) return

	if (!areHideThreadControlsEnabled()) {
		removeThreadActionButton(HIDE_BUTTON_ID)
		return
	}

	createThreadActionButton({
		id: HIDE_BUTTON_ID,
		icon: 'fa-eye-slash',
		text: 'Ocultar',
		tooltip: 'Ocultar hilo',
		ariaLabel: 'Ocultar este hilo y volver al subforo',
		position: 'end',
		onClick: (_event, button) => {
			void performThreadHide(notifier, button)
		},
	})
}

export function cleanupThreadPageHideButton(): void {
	removeThreadActionButton(HIDE_BUTTON_ID)
	guardInitialized = false
}
