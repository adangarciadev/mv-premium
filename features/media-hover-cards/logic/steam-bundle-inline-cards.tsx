/**
 * Steam Bundle Inline Cards
 *
 * Injects a visible inline card under Steam bundle links found in:
 * - Thread post bodies
 * - Mediavida native preview modal (#preview)
 * - MVP live preview (shadow DOM)
 */
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { DOM_MARKERS, FEATURE_IDS, MV_SELECTORS } from '@/constants'
import { mountFeature, unmountFeature } from '@/lib/content-modules/utils/react-helpers'
import { extractSteamBundleId, isSteamBundleUrl } from '@/services/api/steam'
import { SteamBundleInlineCard } from '../components/steam-bundle-inline-card'

const INJECTED_ATTR = DOM_MARKERS.DATA_ATTRS.STEAM_BUNDLE_CARD
const FEATURE_ID_PREFIX = FEATURE_IDS.STEAM_BUNDLE_INLINE_CARD_PREFIX
const ORIGINAL_DISPLAY_ATTR = 'data-mvp-steam-bundle-original-display'
const STEAM_BUNDLE_URL_FRAGMENT = 'store.steampowered.com/bundle/'
const BUNDLE_LINK_CONTEXT_SELECTORS = [
	MV_SELECTORS.THREAD.POST_BODY,
	MV_SELECTORS.THREAD.POST_BODY_ALT,
	MV_SELECTORS.THREAD.POST_BODY_LEGACY,
	`${MV_SELECTORS.GLOBAL.PREVIEW_CONTAINER} ${MV_SELECTORS.THREAD.POST_CONTENTS}`,
]
const BUNDLE_LINK_SELECTOR = BUNDLE_LINK_CONTEXT_SELECTORS
	.map(selector => `${selector} a[href*="${STEAM_BUNDLE_URL_FRAGMENT}"]`)
	.join(', ')
const BUNDLE_LINK_SELECTOR_IN_SHADOW = `${MV_SELECTORS.THREAD.POST_CONTENTS} a[href*="${STEAM_BUNDLE_URL_FRAGMENT}"]`
const LIVE_PREVIEW_HOST_SELECTOR = '.mv-live-preview__content'

const SCAN_DEBOUNCE_MS = 80

let observer: MutationObserver | null = null
const livePreviewObservers = new Map<HTMLElement, MutationObserver>()
let scanTimer: ReturnType<typeof setTimeout> | null = null
let isInitialized = false
let cardCounter = 0
const mountedFeatureIds = new Set<string>()

function nextFeatureId(): string {
	cardCounter += 1
	return `${FEATURE_ID_PREFIX}${cardCounter}`
}

function clearScanTimer(): void {
	if (!scanTimer) return
	clearTimeout(scanTimer)
	scanTimer = null
}

function mountInlineCard(link: HTMLAnchorElement, bundleId: number): void {
	if (link.hasAttribute(INJECTED_ATTR)) return

	link.setAttribute(ORIGINAL_DISPLAY_ATTR, link.style.display)
	link.style.display = 'none'
	link.setAttribute(INJECTED_ATTR, 'true')

	const container = document.createElement('div')
	container.style.marginTop = '8px'
	container.style.marginBottom = '8px'
	container.style.maxWidth = '680px'

	const featureId = nextFeatureId()
	container.setAttribute('data-feature-id', featureId)

	link.insertAdjacentElement('afterend', container)

	mountedFeatureIds.add(featureId)

	mountFeature(
		featureId,
		container,
		<ShadowWrapper>
			<SteamBundleInlineCard bundleId={bundleId} url={link.href} />
		</ShadowWrapper>
	)
}

function scanLinkCollection(links: NodeListOf<HTMLAnchorElement>): void {
	links.forEach(link => {
		if (!(link instanceof HTMLAnchorElement)) return
		if (!link.href) return
		if (!isSteamBundleUrl(link.href)) return

		const bundleId = extractSteamBundleId(link.href)
		if (!bundleId) return

		mountInlineCard(link, bundleId)
	})
}

function scanBundleLinks(): void {
	const links = document.querySelectorAll<HTMLAnchorElement>(BUNDLE_LINK_SELECTOR)
	scanLinkCollection(links)

	const livePreviewHosts = document.querySelectorAll<HTMLElement>(LIVE_PREVIEW_HOST_SELECTOR)
	livePreviewHosts.forEach(host => {
		const shadowRoot = host.shadowRoot
		if (!shadowRoot) return
		const shadowLinks = shadowRoot.querySelectorAll<HTMLAnchorElement>(BUNDLE_LINK_SELECTOR_IN_SHADOW)
		scanLinkCollection(shadowLinks)
	})
}

function syncLivePreviewObservers(): void {
	const hosts = new Set(document.querySelectorAll<HTMLElement>(LIVE_PREVIEW_HOST_SELECTOR))

	livePreviewObservers.forEach((shadowObserver, host) => {
		if (hosts.has(host) && host.isConnected) return
		shadowObserver.disconnect()
		livePreviewObservers.delete(host)
	})

	hosts.forEach(host => {
		if (livePreviewObservers.has(host)) return
		const shadowRoot = host.shadowRoot
		if (!shadowRoot) return

		const shadowObserver = new MutationObserver(() => {
			scheduleScan()
		})

		shadowObserver.observe(shadowRoot, {
			childList: true,
			subtree: true,
		})

		livePreviewObservers.set(host, shadowObserver)
	})
}

function scheduleScan(): void {
	clearScanTimer()
	scanTimer = setTimeout(() => {
		syncLivePreviewObservers()
		scanBundleLinks()
	}, SCAN_DEBOUNCE_MS)
}

function observeDynamicPosts(): void {
	const root = document.body

	observer = new MutationObserver(() => {
		scheduleScan()
	})

	observer.observe(root, {
		childList: true,
		subtree: true,
	})
}

function disconnectLivePreviewObservers(): void {
	livePreviewObservers.forEach(shadowObserver => {
		shadowObserver.disconnect()
	})
	livePreviewObservers.clear()
}

function clearInjectedMarkers(): void {
	document.querySelectorAll<HTMLElement>(`[${INJECTED_ATTR}]`).forEach(link => {
		const originalDisplay = link.getAttribute(ORIGINAL_DISPLAY_ATTR)
		link.style.display = originalDisplay ?? ''
		link.removeAttribute(ORIGINAL_DISPLAY_ATTR)
		link.removeAttribute(INJECTED_ATTR)
	})

	document.querySelectorAll<HTMLElement>(LIVE_PREVIEW_HOST_SELECTOR).forEach(host => {
		const shadowRoot = host.shadowRoot
		if (!shadowRoot) return
		shadowRoot.querySelectorAll<HTMLElement>(`[${INJECTED_ATTR}]`).forEach(link => {
			const originalDisplay = link.getAttribute(ORIGINAL_DISPLAY_ATTR)
			link.style.display = originalDisplay ?? ''
			link.removeAttribute(ORIGINAL_DISPLAY_ATTR)
			link.removeAttribute(INJECTED_ATTR)
		})
	})
}

export function initSteamBundleInlineCards(): void {
	if (isInitialized) {
		scheduleScan()
		return
	}

	isInitialized = true

	syncLivePreviewObservers()
	scanBundleLinks()
	observeDynamicPosts()

	window.addEventListener('beforeunload', cleanupSteamBundleInlineCards)
}

export function cleanupSteamBundleInlineCards(): void {
	clearScanTimer()

	if (observer) {
		observer.disconnect()
		observer = null
	}

	disconnectLivePreviewObservers()

	mountedFeatureIds.forEach(featureId => {
		unmountFeature(featureId)
	})
	mountedFeatureIds.clear()

	clearInjectedMarkers()

	window.removeEventListener('beforeunload', cleanupSteamBundleInlineCards)
	isInitialized = false
}
