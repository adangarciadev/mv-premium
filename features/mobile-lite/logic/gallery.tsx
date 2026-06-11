import { DOM_MARKERS, FEATURE_IDS, MV_SELECTORS } from '@/constants'
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { logger } from '@/lib/logger'
import { getPlatformKind } from '@/lib/platform'
import { isThreadPage } from '@/lib/content-modules/utils/page-detection'
import { isFeatureMounted, mountFeatureWithBoundary, unmountFeature } from '@/lib/content-modules/utils/react-helpers'
import { getSettings } from '@/store/settings-store'
import { getThreadMedia } from '@/features/gallery/lib/thread-scraper'
import { getIsLiveActive } from '@/features/live-thread/logic/live-thread-polling'
import { getPremiumPillButtonCss } from './native-button-styles'

const STYLE_ID = 'mvp-mobile-lite-gallery-styles'
const BUTTON_ID = 'mvp-mobile-lite-gallery-button'
const LIVE_BUTTON_ID = 'mvp-mobile-lite-live-thread-button'
const SYNC_DEBOUNCE_MS = 100

let initialized = false
let contentObserver: MutationObserver | null = null
let syncTimeout: ReturnType<typeof setTimeout> | null = null

function isMobileLiteGalleryAllowed(): boolean {
	return getPlatformKind() === 'firefox-android' && isFeatureEnabled(FeatureFlag.MobileLite)
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
		#${BUTTON_ID}.btn.mvp-mobile-lite-gallery-busy {
			opacity: 0.72;
			pointer-events: none;
		}
		#${BUTTON_ID} .mvp-mobile-lite-gallery-count {
			background: rgba(0,0,0,0.35);
			border-radius: 999px;
			color: #f0a020;
			display: inline-block;
			font-size: 11px;
			font-weight: 700;
			line-height: 1;
			margin-right: 6px;
			padding: 3px 6px;
			vertical-align: middle;
		}
	`
	document.head.appendChild(style)
}

function formatCount(count: number): string {
	return count > 99 ? '99+' : String(count)
}

function closeGallery(): void {
	unmountFeature(FEATURE_IDS.GALLERY_MODAL)
	document.getElementById(DOM_MARKERS.IDS.GALLERY_ROOT)?.remove()
}

/**
 * Opens the shared GalleryCarousel (lazy-loaded, same component as desktop).
 * Media is re-scanned on tap so late-loaded posts are always included.
 */
async function openGallery(button: HTMLAnchorElement): Promise<void> {
	if (isFeatureMounted(FEATURE_IDS.GALLERY_MODAL)) return

	const media = getThreadMedia()
	if (media.length === 0) return

	button.classList.add('mvp-mobile-lite-gallery-busy')
	try {
		// Lazy load to keep jszip and Embla out of the initial mobile bundle
		const { GalleryCarousel } = await import('@/features/gallery/components/gallery-carousel')

		let galleryRoot = document.getElementById(DOM_MARKERS.IDS.GALLERY_ROOT)
		if (!galleryRoot) {
			galleryRoot = document.createElement('div')
			galleryRoot.id = DOM_MARKERS.IDS.GALLERY_ROOT
			document.body.appendChild(galleryRoot)
		}

		mountFeatureWithBoundary(
			FEATURE_IDS.GALLERY_MODAL,
			galleryRoot,
			<GalleryCarousel media={media} isOpen={true} onClose={closeGallery} />,
			'Galería'
		)
	} catch (error) {
		logger.error('Error opening Mobile Lite gallery:', error)
	} finally {
		button.classList.remove('mvp-mobile-lite-gallery-busy')
	}
}

function updateButtonState(button: HTMLAnchorElement, count: number): void {
	const label = `Abrir galería (${count} elementos)`
	const countBadge = button.querySelector('.mvp-mobile-lite-gallery-count')
	const formatted = formatCount(count)

	if (countBadge && countBadge.textContent !== formatted) {
		countBadge.textContent = formatted
	}
	if (button.getAttribute('aria-label') !== label) {
		button.setAttribute('aria-label', label)
		button.title = label
	}
}

function createButton(): HTMLAnchorElement {
	const button = document.createElement('a')
	button.id = BUTTON_ID
	button.href = '#'
	button.className = 'btn mvp-mobile-lite-gallery-btn'
	button.setAttribute('role', 'button')
	button.innerHTML = '<span class="mvp-mobile-lite-gallery-count" aria-hidden="true">0</span><span>Galería</span>'

	button.addEventListener('click', event => {
		event.preventDefault()
		void openGallery(button).catch(error => {
			logger.error('Error opening Mobile Lite gallery:', error)
		})
	})

	return button
}

function getMoreActions(): HTMLElement | null {
	return document.getElementById(MV_SELECTORS.GLOBAL.MORE_ACTIONS_ID)
}

function getInsertionReference(moreActions: HTMLElement): Element | null {
	return (
		// Right next to the Mobile Lite Live button when it is mounted
		moreActions.querySelector(`#${LIVE_BUTTON_ID}`) ??
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

function cleanupMobileLiteGalleryButton(): void {
	document.getElementById(BUTTON_ID)?.remove()
}

async function shouldShowMobileLiteGalleryButton(enabledOverride?: boolean): Promise<boolean> {
	if (!isMobileLiteGalleryAllowed() || !isThreadPage()) return false
	if (enabledOverride !== undefined) return enabledOverride

	const settings = await getSettings()
	return settings.galleryButtonEnabled !== false
}

export async function syncMobileLiteGalleryButton(enabledOverride?: boolean): Promise<void> {
	// Live mode owns the view (and moves the posts into its own container), so the
	// inline button disappears along with the rest of the thread actions row.
	if (getIsLiveActive()) {
		cleanupMobileLiteGalleryButton()
		return
	}

	const shouldShow = await shouldShowMobileLiteGalleryButton(enabledOverride)
	if (!shouldShow) {
		cleanupMobileLiteGalleryButton()
		return
	}

	const moreActions = getMoreActions()
	if (!moreActions) return

	const count = getThreadMedia().length
	if (count === 0) {
		cleanupMobileLiteGalleryButton()
		return
	}

	ensureStyles()

	let button = document.getElementById(BUTTON_ID) as HTMLAnchorElement | null
	if (!button) {
		button = createButton()
	}
	if (button.parentElement !== moreActions) {
		placeButton(moreActions, button)
	}
	updateButtonState(button, count)
}

/**
 * Same guard as the Live button: reacting to our own DOM writes (or to the open
 * carousel / Live container / editor) would create a sync feedback loop.
 */
function isInternalMutationTarget(node: Node | null): boolean {
	const element = node instanceof Element ? node : node?.parentElement ?? null
	if (!element?.closest) return false

	return Boolean(
		element.closest(`#${BUTTON_ID}`) ||
			element.closest(`#${DOM_MARKERS.IDS.GALLERY_ROOT}`) ||
			element.closest(`#${DOM_MARKERS.IDS.LIVE_MAIN_CONTAINER}`) ||
			element.closest(`#${MV_SELECTORS.EDITOR.POST_EDITOR_ID}`)
	)
}

function runSync(): void {
	syncTimeout = null
	void syncMobileLiteGalleryButton().catch(error => {
		logger.error('Error syncing Mobile Lite gallery button:', error)
	})
}

function scheduleSync(): void {
	if (syncTimeout) clearTimeout(syncTimeout)
	syncTimeout = setTimeout(runSync, SYNC_DEBOUNCE_MS)
}

function handleContentMutations(mutations: MutationRecord[]): void {
	if (!getIsLiveActive() && !mutations.some(mutation => !isInternalMutationTarget(mutation.target))) {
		return
	}

	scheduleSync()
}

export function initMobileLiteGallery(): void {
	if (!isMobileLiteGalleryAllowed()) return
	if (initialized) return
	if (!document.body) return

	initialized = true
	void syncMobileLiteGalleryButton().catch(error => {
		logger.error('Error initializing Mobile Lite gallery button:', error)
	})

	// #more-actions and the post images can render late; retry like the Live button.
	for (const delay of [300, 900, 2000]) {
		setTimeout(() => {
			if (!initialized) return
			void syncMobileLiteGalleryButton().catch(() => undefined)
		}, delay)
	}

	contentObserver = new MutationObserver(handleContentMutations)
	contentObserver.observe(document.body, { childList: true, subtree: true })
}

export function teardownMobileLiteGallery(): void {
	if (syncTimeout) {
		clearTimeout(syncTimeout)
		syncTimeout = null
	}

	contentObserver?.disconnect()
	contentObserver = null

	if (isFeatureMounted(FEATURE_IDS.GALLERY_MODAL)) {
		closeGallery()
	}
	cleanupMobileLiteGalleryButton()
	document.getElementById(STYLE_ID)?.remove()
	initialized = false
}
