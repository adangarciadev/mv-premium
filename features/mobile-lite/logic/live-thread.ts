import { DOM_MARKERS, MV_SELECTORS } from '@/constants'
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { logger } from '@/lib/logger'
import { getPlatformKind } from '@/lib/platform'
import { isThreadPage } from '@/lib/content-modules/utils/page-detection'
import { getSettings } from '@/store/settings-store'
import { cleanupLiveThreadButton, configureLiveThreadRuntime, startLiveMode } from '@/features/live-thread'
import { getIsLiveActive } from '@/features/live-thread/logic/live-thread-polling'

const STYLE_ID = 'mvp-mobile-lite-live-thread-styles'
const BUTTON_ID = 'mvp-mobile-lite-live-thread-button'
const SYNC_DEBOUNCE_MS = 100

let initialized = false
let contentObserver: MutationObserver | null = null
let syncTimeout: ReturnType<typeof setTimeout> | null = null

function isMobileLiteLiveThreadAllowed(): boolean {
	return getPlatformKind() === 'firefox-android' && isFeatureEnabled(FeatureFlag.MobileLite)
}

function ensureStyles(): void {
	if (document.getElementById(STYLE_ID)) return

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = `
		#${BUTTON_ID}.btn {
			background: linear-gradient(180deg, #416390 0%, #36557d 100%) !important;
			border-color: #587aa8 !important;
			box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 2px rgba(0,0,0,0.2) !important;
			color: #fff !important;
			letter-spacing: 0 !important;
			margin-left: 4px !important;
			margin-right: 0 !important;
			text-decoration: none !important;
			text-transform: none !important;
		}
		#${BUTTON_ID}.btn:active,
		#${BUTTON_ID}.btn.mvp-mobile-lite-live-thread-active {
			background: linear-gradient(180deg, #9a6d00 0%, #7d5900 100%) !important;
			border-color: #d89016 !important;
		}
		#${BUTTON_ID}.btn.mvp-mobile-lite-live-thread-busy {
			opacity: 0.72;
			pointer-events: none;
		}
		#${BUTTON_ID} .mvp-mobile-lite-live-thread-dot {
			background: #f0a020;
			border-radius: 999px;
			box-shadow: 0 0 0 2px rgba(240,160,32,0.18), 0 0 8px rgba(240,160,32,0.55);
			display: inline-block;
			height: 7px;
			line-height: 1;
			margin-right: 6px;
			vertical-align: middle;
			width: 7px;
		}
		#${BUTTON_ID}.mvp-mobile-lite-live-thread-active .mvp-mobile-lite-live-thread-dot {
			background: #fff2b3;
			box-shadow: 0 0 0 2px rgba(255,242,179,0.22), 0 0 10px rgba(255,242,179,0.58);
		}
	`
	document.head.appendChild(style)
}

function cleanupEmptyExtraActionsRow(): void {
	const extraActions = document.getElementById(DOM_MARKERS.IDS.EXTRA_ACTIONS)
	const mainActions = document.getElementById(DOM_MARKERS.IDS.MAIN_ACTIONS)
	const statusActions = document.getElementById(DOM_MARKERS.IDS.STATUS_ACTIONS)
	if (!extraActions || !mainActions || !statusActions) return
	if (mainActions.childElementCount > 0 || statusActions.childElementCount > 0) return

	extraActions.remove()
}

function cleanupLegacyMobileLiteLiveThreadContainer(): void {
	document.getElementById('mvp-mobile-lite-live-thread-container')?.remove()
}

function cleanupMobileLiteLiveThreadButton(): void {
	document.getElementById(BUTTON_ID)?.remove()
	cleanupLegacyMobileLiteLiveThreadContainer()
	cleanupLiveThreadButton()
	cleanupEmptyExtraActionsRow()
}

function renderButtonState(button: HTMLAnchorElement): void {
	const isActive = getIsLiveActive()
	button.classList.toggle('mvp-mobile-lite-live-thread-active', isActive)
	button.setAttribute('aria-label', isActive ? 'Modo Live activo' : 'Activar modo Live')
	button.title = isActive ? 'Modo Live activo' : 'Activar modo Live'
}

function createButton(): HTMLAnchorElement {
	const button = document.createElement('a')
	button.id = BUTTON_ID
	button.href = '#'
	button.className = 'btn mvp-mobile-lite-live-thread-btn'
	button.setAttribute('role', 'button')
	button.innerHTML = '<span class="mvp-mobile-lite-live-thread-dot" aria-hidden="true"></span><span>Live</span>'
	renderButtonState(button)

	button.addEventListener('click', event => {
		event.preventDefault()
		if (getIsLiveActive()) return

		button.classList.add('mvp-mobile-lite-live-thread-busy')
		void configureLiveThreadRuntime({ requireEnabled: false })
			.then(ready => {
				if (!ready) return
				return startLiveMode({ variant: 'mobile-lite' })
			})
			.then(() => renderButtonState(button))
			.catch(error => {
				logger.error('Error starting Mobile Lite live thread:', error)
			})
			.finally(() => {
				button.classList.remove('mvp-mobile-lite-live-thread-busy')
			})
	})

	return button
}

function getMoreActions(): HTMLElement | null {
	return document.getElementById(MV_SELECTORS.GLOBAL.MORE_ACTIONS_ID)
}

function getInsertionReference(moreActions: HTMLElement): Element | null {
	return (
		moreActions.querySelector('.quickreply, #topic-reply, a[href$="/responder"], a[href*="/responder"]') ??
		moreActions.querySelector('.btn')
	)
}

function placeButton(moreActions: HTMLElement, button: HTMLAnchorElement): void {
	const reference = getInsertionReference(moreActions)
	if (reference && moreActions.contains(reference)) {
		reference.insertAdjacentElement('afterend', button)
		return
	}

	moreActions.insertAdjacentElement('afterbegin', button)
}

async function shouldShowMobileLiteLiveThreadButton(enabledOverride?: boolean): Promise<boolean> {
	if (!isMobileLiteLiveThreadAllowed() || !isThreadPage()) return false
	if (enabledOverride !== undefined) return enabledOverride

	const settings = await getSettings()
	return settings.liveThreadEnabled === true
}

export async function syncMobileLiteLiveThreadButton(enabledOverride?: boolean): Promise<void> {
	// Never (re)mount the inline button while Live mode owns the view.
	if (getIsLiveActive()) {
		cleanupMobileLiteLiveThreadButton()
		return
	}

	const shouldShow = await shouldShowMobileLiteLiveThreadButton(enabledOverride)
	cleanupLiveThreadButton()
	cleanupLegacyMobileLiteLiveThreadContainer()
	cleanupEmptyExtraActionsRow()

	if (!shouldShow) {
		cleanupMobileLiteLiveThreadButton()
		return
	}

	const moreActions = getMoreActions()
	if (!moreActions) return

	const ready = await configureLiveThreadRuntime({ requireEnabled: false })
	if (!ready) {
		cleanupMobileLiteLiveThreadButton()
		return
	}

	ensureStyles()
	cleanupEmptyExtraActionsRow()

	let button = document.getElementById(BUTTON_ID) as HTMLAnchorElement | null
	if (!button) {
		button = createButton()
	}
	if (button.parentElement !== moreActions) {
		placeButton(moreActions, button)
	}
	renderButtonState(button)
}

/**
 * True when a mutation originates inside the Live container, the moved native
 * editor, or our own button. Reacting to these causes a feedback loop: syncing
 * the button mutates the DOM, which re-triggers the observer, which re-syncs —
 * the churn (and React unmount/remount of the button) steals focus from the
 * editor textarea on Firefox Android, producing the "flash but can't type" bug.
 */
function isInternalMutationTarget(node: Node | null): boolean {
	const element = node instanceof Element ? node : node?.parentElement ?? null
	if (!element?.closest) return false

	return Boolean(
		element.closest(`#${BUTTON_ID}`) ||
			element.closest(`#${DOM_MARKERS.IDS.LIVE_MAIN_CONTAINER}`) ||
			element.closest(`#${MV_SELECTORS.EDITOR.POST_EDITOR_ID}`)
	)
}

function runSync(): void {
	syncTimeout = null

	// In Live mode the React header replaces the inline button. Remove the button
	// (idempotent once gone) and stop touching the DOM so we never compete with
	// the open editor for focus.
	if (getIsLiveActive()) {
		cleanupMobileLiteLiveThreadButton()
		return
	}

	void syncMobileLiteLiveThreadButton().catch(error => {
		logger.error('Error syncing Mobile Lite live thread button:', error)
	})
}

function handleContentMutations(mutations: MutationRecord[]): void {
	// While Live is active, always funnel through runSync (which just ensures the
	// button is gone). Otherwise, ignore self-inflicted / editor-internal mutations.
	if (!getIsLiveActive() && !mutations.some(mutation => !isInternalMutationTarget(mutation.target))) {
		return
	}

	scheduleSync()
}

function scheduleSync(): void {
	if (syncTimeout) clearTimeout(syncTimeout)
	syncTimeout = setTimeout(runSync, SYNC_DEBOUNCE_MS)
}

export function initMobileLiteLiveThread(): void {
	if (!isMobileLiteLiveThreadAllowed()) return
	if (initialized) return
	if (!document.body) return

	initialized = true
	void syncMobileLiteLiveThreadButton().catch(error => {
		logger.error('Error initializing Mobile Lite live thread button:', error)
	})

	// The thread actions row (#more-actions) can render late on some pages, so the
	// Live button sometimes didn't appear. Retry a few times after init to catch it.
	for (const delay of [300, 900, 2000]) {
		setTimeout(() => {
			if (!initialized) return
			void syncMobileLiteLiveThreadButton().catch(() => undefined)
		}, delay)
	}

	contentObserver = new MutationObserver(handleContentMutations)
	contentObserver.observe(document.body, { childList: true, subtree: true })
}

export function teardownMobileLiteLiveThread(): void {
	if (syncTimeout) {
		clearTimeout(syncTimeout)
		syncTimeout = null
	}

	contentObserver?.disconnect()
	contentObserver = null
	cleanupMobileLiteLiveThreadButton()
	document.getElementById(STYLE_ID)?.remove()
	initialized = false
}
