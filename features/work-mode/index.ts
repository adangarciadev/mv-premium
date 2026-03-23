/**
 * Work Mode Feature
 *
 * Hides visual/media content (avatars, images, videos, social embeds, Steam cards)
 * so users can browse the forum discreetly in work environments.
 *
 * Each content type can be toggled independently via workModeOptions.
 * Uses the same pattern as hide-header: localStorage cache + storage watcher.
 */

import { storage } from '@wxt-dev/storage'
import { logger } from '@/lib/logger'
import { STORAGE_KEYS, EARLY_STYLE_IDS, RUNTIME_CACHE_KEYS } from '@/constants'
import { DOM_MARKERS } from '@/constants/dom-markers'
import type { WorkModeOptions } from '@/store/settings-types'
import { DEFAULT_SETTINGS } from '@/store/settings-defaults'

const STYLE_ID = DOM_MARKERS.IDS.WORK_MODE_STYLES
const EARLY_STYLE_ID = EARLY_STYLE_IDS.WORK_MODE
const CACHE_KEY = RUNTIME_CACHE_KEYS.WORK_MODE
const OPTIONS_CACHE_KEY = RUNTIME_CACHE_KEYS.WORK_MODE_OPTIONS
const TAB_TITLE_CACHE_KEY = RUNTIME_CACHE_KEYS.WORK_MODE_TAB_TITLE
const SETTINGS_KEY = `local:${STORAGE_KEYS.SETTINGS}` as `local:${string}`

/** Generic document favicon as SVG data URI — light style to look natural in browser tabs */
const NEUTRAL_FAVICON = 'data:image/svg+xml,' + encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">' +
	'<path d="M4 1h5l4 4v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2z" fill="#fff" stroke="#4a90d9" stroke-width="1"/>' +
	'<path d="M9 1v3a1 1 0 0 0 1 1h3" fill="none" stroke="#4a90d9" stroke-width="1"/>' +
	'<line x1="5" y1="7.5" x2="11" y2="7.5" stroke="#8ab4f0" stroke-width="1" stroke-linecap="round"/>' +
	'<line x1="5" y1="9.5" x2="10" y2="9.5" stroke="#8ab4f0" stroke-width="1" stroke-linecap="round"/>' +
	'<line x1="5" y1="11.5" x2="8" y2="11.5" stroke="#8ab4f0" stroke-width="1" stroke-linecap="round"/>' +
	'</svg>'
)

interface SettingsState {
	state: {
		workModeEnabled: boolean
		workModeOptions: WorkModeOptions
		workModeTabTitle: string
	}
}

const DEFAULT_OPTIONS = DEFAULT_SETTINGS.workModeOptions
const DEFAULT_TAB_TITLE = DEFAULT_SETTINGS.workModeTabTitle

// Tab disguise state
let originalTitle: string | null = null
let originalFaviconHref: string | null = null
let titleObserver: MutationObserver | null = null

/**
 * Updates the localStorage cache for instant access on next page load.
 */
function updateCache(enabled: boolean, options: WorkModeOptions, tabTitle: string): void {
	try {
		if (enabled) {
			localStorage.setItem(CACHE_KEY, 'true')
			localStorage.setItem(OPTIONS_CACHE_KEY, JSON.stringify(options))
			localStorage.setItem(TAB_TITLE_CACHE_KEY, tabTitle)
		} else {
			localStorage.removeItem(CACHE_KEY)
			localStorage.removeItem(OPTIONS_CACHE_KEY)
			localStorage.removeItem(TAB_TITLE_CACHE_KEY)
		}
	} catch {
		// localStorage might be disabled
	}
}

/**
 * Builds CSS rules based on which sub-options are enabled.
 */
export function buildWorkModeCSS(options: WorkModeOptions): string {
	const rules: string[] = []

	if (options.hideAvatars) {
		rules.push(`
			/* Work Mode: Hide avatars */
			.post-avatar img,
			.post-avatar-reply img,
			.post-avatar .letter,
			.avatar-list img,
			.avatar-list .letter,
			.col-av img,
			.col-av .letter,
			#usermenu .avw img,
			.m-btn.m-nav-user img,
			#cover .user-avatar img,
			.group-list img,
			.firma-avatar img,
			.firma-avatar .letter {
				visibility: hidden !important;
			}
		`)
	}

	if (options.hideImages) {
		rules.push(`
			/* Work Mode: Hide images in posts */
			.post-contents a.img-zoom,
			.post-contents img:not(.avatar):not(.emoji):not([src*="/smileys/"]):not([src*="/smilies/"]):not([src*="/emoji/"]):not([src*="/style/img/"]):not([src*="/misc/"]) {
				display: none !important;
			}
			/* Work Mode: Hide sidebar, homepage & groups images */
			.c-side img.itemimg,
			.c-side .featured-side img,
			.news-media img,
			#social img,
			.group-avatar-new img {
				display: none !important;
			}
			/* Work Mode: Hide news post count badge (orphaned when image hidden) */
			.news-media div {
				display: none !important;
			}
			/* Work Mode: Hide social network section on profile */
			#social {
				display: none !important;
			}
			/* Work Mode: Hide background images (homepage splash, profile cover) */
			#splash-3 .splash,
			#cover {
				background-image: none !important;
			}
		`)
	}

	if (options.hideVideos) {
		rules.push(`
			/* Work Mode: Hide video embeds */
			[data-s9e-mediaembed="youtube"],
			.youtube_lite,
			.post-contents video,
			.post-contents .embed.yt,
			.post-contents .embed.r16-9:not([data-s9e-mediaembed="twitter"]):not([data-s9e-mediaembed="instagram"]):not([data-s9e-mediaembed="reddit"]):not([data-s9e-mediaembed="tiktok"]):not([data-s9e-mediaembed="facebook"]):not([data-s9e-mediaembed="bluesky"]) {
				display: none !important;
			}
		`)
	}

	if (options.hideSocialEmbeds) {
		rules.push(`
			/* Work Mode: Hide social embeds (Twitter, Instagram, Reddit, TikTok, Facebook, Bluesky) */
			[data-s9e-mediaembed="twitter"],
			[data-s9e-mediaembed="instagram"],
			[data-s9e-mediaembed="reddit"],
			[data-s9e-mediaembed="tiktok"],
			[data-s9e-mediaembed="facebook"],
			[data-s9e-mediaembed="bluesky"],
			.mvp-twitter-lite-card {
				display: none !important;
			}
		`)
	}

	if (options.hideSteamCards) {
		rules.push(`
			/* Work Mode: Hide Steam cards (native embeds + extension bundle cards) */
			[data-s9e-mediaembed="steamstore"],
			[data-mvp-steam-bundle-card],
			.steam-embed-placeholder {
				display: none !important;
			}
		`)
	}

	if (options.hideForumIcons) {
		rules.push(`
			/* Work Mode: Hide forum/subforum icons */
			i.fid {
				display: none !important;
			}
		`)
	}

	if (rules.length === 0) return ''

	return `/* MVP Work Mode */\n${rules.join('\n')}`
}

/**
 * Gets the current favicon <link> element, or creates one if it doesn't exist.
 */
function getFaviconLink(): HTMLLinkElement {
	let link = document.querySelector<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]')
	if (!link) {
		link = document.createElement('link')
		link.rel = 'icon'
		document.head.appendChild(link)
	}
	return link
}

/**
 * Applies tab disguise: overrides title and favicon.
 */
function applyTabDisguise(tabTitle: string): void {
	// Save originals (only once)
	if (originalTitle === null) {
		originalTitle = document.title
	}
	if (originalFaviconHref === null) {
		const link = document.querySelector<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]')
		originalFaviconHref = link?.href ?? ''
	}

	// Override title
	document.title = tabTitle

	// Override favicon
	const faviconLink = getFaviconLink()
	faviconLink.href = NEUTRAL_FAVICON

	// Watch for title changes (Mediavida updates title dynamically)
	if (!titleObserver) {
		const titleEl = document.querySelector('title')
		if (titleEl) {
			titleObserver = new MutationObserver(() => {
				if (document.title !== tabTitle) {
					document.title = tabTitle
				}
			})
			titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true })
		}
	}
}

/**
 * Removes tab disguise: restores original title and favicon.
 */
function removeTabDisguise(): void {
	if (titleObserver) {
		titleObserver.disconnect()
		titleObserver = null
	}

	if (originalTitle !== null) {
		document.title = originalTitle
		originalTitle = null
	}
	// If originalTitle is null, the early injection script handles title restoration.

	if (originalFaviconHref !== null) {
		const faviconLink = getFaviconLink()
		faviconLink.href = originalFaviconHref
		originalFaviconHref = null
	}
}

function applyWorkMode(enabled: boolean, options: WorkModeOptions, tabTitle: string): void {
	updateCache(enabled, options, tabTitle)

	// Remove existing styles (both main and early-inject to avoid duplication)
	document.getElementById(STYLE_ID)?.remove()
	document.getElementById(EARLY_STYLE_ID)?.remove()

	// Handle tab disguise
	if (enabled && options.disguiseTab && tabTitle) {
		applyTabDisguise(tabTitle)
	} else {
		removeTabDisguise()
	}

	if (!enabled) return

	const css = buildWorkModeCSS(options)
	if (!css) return

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = css
	document.head.appendChild(style)
}

function parseSettings(raw: string | SettingsState): { enabled: boolean; options: WorkModeOptions; tabTitle: string } {
	const parsed: SettingsState = typeof raw === 'string' ? JSON.parse(raw) : raw
	return {
		enabled: parsed?.state?.workModeEnabled ?? false,
		options: parsed?.state?.workModeOptions ?? DEFAULT_OPTIONS,
		tabTitle: parsed?.state?.workModeTabTitle ?? DEFAULT_TAB_TITLE,
	}
}

/**
 * Toggle work mode on/off. Used by keyboard shortcuts.
 */
export async function toggleWorkMode(): Promise<void> {
	try {
		const raw = await storage.getItem<string | SettingsState>(SETTINGS_KEY)
		if (!raw) return

		const parsed: SettingsState = typeof raw === 'string' ? JSON.parse(raw) : raw
		const current = parsed?.state?.workModeEnabled ?? false
		parsed.state.workModeEnabled = !current

		await storage.setItem(SETTINGS_KEY, typeof raw === 'string' ? JSON.stringify(parsed) : parsed)
	} catch (e) {
		logger.error('Work mode toggle error:', e)
	}
}

export async function initWorkMode(): Promise<void> {
	try {
		const raw = await storage.getItem<string | SettingsState>(SETTINGS_KEY)

		if (raw) {
			const { enabled, options, tabTitle } = parseSettings(raw)
			applyWorkMode(enabled, options, tabTitle)
		}

		storage.watch<string | SettingsState>(SETTINGS_KEY, newValue => {
			if (!newValue) return

			try {
				const { enabled, options, tabTitle } = parseSettings(newValue)
				applyWorkMode(enabled, options, tabTitle)
			} catch (e) {
				logger.error('Work mode error parsing settings:', e)
			}
		})
	} catch (error) {
		logger.error('Work mode failed to initialize:', error)
	}
}
