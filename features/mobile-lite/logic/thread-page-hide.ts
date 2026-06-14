/**
 * Mobile Lite "Ocultar hilo" button.
 *
 * Mirrors the Live/Galería buttons: an inline pill injected directly into
 * #more-actions (not the column-style extra-actions row), styled with the
 * premium pill recipe so it matches the rest of the mobile action bar. It
 * reuses the shared hide behaviour and the Mobile Lite DOM toast for the
 * redirect countdown, since the sonner Toaster isn't mounted on the mobile path.
 */

import { DOM_MARKERS, MV_SELECTORS } from '@/constants'
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { getPlatformKind } from '@/lib/platform'
import { isThreadPage } from '@/lib/content-modules/utils/page-detection'
import { useSettingsStore } from '@/store/settings-store'
import {
	performThreadHide,
	setupHiddenThreadGuard,
	type ThreadPageHideNotifier,
} from '@/features/hidden-threads/logic/thread-page-hide'
import { showMobileLiteActionToast, updateMobileLiteActionToast } from './action-toast'
import { getPremiumPillButtonCss } from './native-button-styles'

const STYLE_ID = 'mvp-mobile-lite-thread-page-hide-styles'
const BUTTON_ID = 'mvp-mobile-lite-thread-page-hide-button'
const RETRY_DELAYS_MS = [300, 900, 2000]

let retriesScheduled = false

function isAllowed(): boolean {
	return getPlatformKind() === 'firefox-android' && isFeatureEnabled(FeatureFlag.MobileLite)
}

function areHideThreadControlsEnabled(): boolean {
	return useSettingsStore.getState().hideThreadEnabled !== false
}

function ensureStyles(): void {
	if (document.getElementById(STYLE_ID)) return

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = `
		${getPremiumPillButtonCss(`#${BUTTON_ID}.btn`)}
		#${BUTTON_ID}.btn {
			margin-left: 4px !important;
			margin-right: 0 !important;
		}
		#${BUTTON_ID} i {
			margin-right: 6px;
		}
	`
	document.head.appendChild(style)
}

/** Fresh notifier per click so the countdown's "first tick" state is isolated. */
function createNotifier(): ThreadPageHideNotifier {
	let started = false
	return {
		onCountdown: secondsLeft => {
			const message = `Hilo oculto · Redirigiendo en ${secondsLeft}s`
			if (!started) {
				started = true
				showMobileLiteActionToast(message, 'fa-eye-slash')
				return
			}
			updateMobileLiteActionToast(message)
		},
		onError: () => showMobileLiteActionToast('No se pudo ocultar el hilo', 'fa-exclamation-triangle'),
	}
}

function createButton(): HTMLAnchorElement {
	const button = document.createElement('a')
	button.id = BUTTON_ID
	button.href = '#'
	button.className = 'btn'
	button.setAttribute('role', 'button')
	button.title = 'Ocultar hilo'
	button.setAttribute('aria-label', 'Ocultar este hilo y volver al subforo')
	button.innerHTML = '<i class="fa fa-eye-slash" aria-hidden="true"></i><span>Ocultar</span>'

	button.addEventListener('click', event => {
		event.preventDefault()
		void performThreadHide(createNotifier(), button)
	})

	return button
}

/**
 * Places the button inline among the action pills, right before the column-style
 * extra-actions row (Resumir, etc.) so it sits next to Live/Galería/Ignorar
 * instead of dropping below them.
 */
function placeButton(moreActions: HTMLElement, button: HTMLAnchorElement): void {
	const extraActions = moreActions.querySelector(`#${DOM_MARKERS.IDS.EXTRA_ACTIONS}`)
	if (extraActions) {
		extraActions.insertAdjacentElement('beforebegin', button)
		return
	}

	moreActions.appendChild(button)
}

function injectButton(): void {
	if (!isAllowed() || !isThreadPage()) return

	if (!areHideThreadControlsEnabled()) {
		document.getElementById(BUTTON_ID)?.remove()
		return
	}

	const moreActions = document.getElementById(MV_SELECTORS.GLOBAL.MORE_ACTIONS_ID)
	if (!moreActions) return

	ensureStyles()

	let button = document.getElementById(BUTTON_ID) as HTMLAnchorElement | null
	if (!button) {
		button = createButton()
	}
	if (button.parentElement !== moreActions) {
		placeButton(moreActions, button)
	}
}

export function initMobileLiteThreadPageHide(): void {
	if (!isAllowed()) return

	setupHiddenThreadGuard()
	injectButton()

	// #more-actions can render late on some pages; retry a few times to catch it.
	if (!retriesScheduled) {
		retriesScheduled = true
		for (const delay of RETRY_DELAYS_MS) {
			setTimeout(() => injectButton(), delay)
		}
	}
}

export function teardownMobileLiteThreadPageHide(): void {
	document.getElementById(BUTTON_ID)?.remove()
	document.getElementById(STYLE_ID)?.remove()
	retriesScheduled = false
}
