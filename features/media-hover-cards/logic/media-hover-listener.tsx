/**
 * Media Hover Cards Event Listener
 *
 * Desktop-only implementation as requested.
 * Detects mouseover on TMDB/IMDb links and mounts floating card.
 */
import { mountFeature, unmountFeature, isFeatureMounted } from '@/lib/content-modules/utils/react-helpers'
import { isSupportedUrl } from '@/services/media/unified-resolver'
import { FEATURE_IDS } from '@/constants/feature-ids'
import { DesktopCard } from '../components/media-hover-card-desktop'

// Tuned timings for "snappy but safe" feel
const SHOW_DELAY = 400
const HIDE_DELAY = 150 

let showTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null
let currentLink: HTMLAnchorElement | null = null
let cardContainer: HTMLDivElement | null = null
let isMouseOverCard = false
let isInitialized = false

function clearTimers() {
	if (showTimer) {
		clearTimeout(showTimer)
		showTimer = null
	}
	if (hideTimer) {
		clearTimeout(hideTimer)
		hideTimer = null
	}
}

function hideCard() {
	clearTimers()

	if (isFeatureMounted(FEATURE_IDS.MEDIA_HOVER_CARD)) {
		unmountFeature(FEATURE_IDS.MEDIA_HOVER_CARD)
	}

	if (cardContainer) {
		cardContainer.remove()
		cardContainer = null
	}

	currentLink = null
	isMouseOverCard = false
}

function showDesktopCard(link: HTMLAnchorElement) {
	if (currentLink && currentLink !== link) hideCard()
	currentLink = link

	const url = link.href
	const rect = link.getBoundingClientRect()

	cardContainer = document.createElement('div')
	cardContainer.id = 'mvp-media-hover-card-container'
	document.body.appendChild(cardContainer)

	mountFeature(
		FEATURE_IDS.MEDIA_HOVER_CARD,
		cardContainer,
		<DesktopCard
			url={url}
			anchorRect={rect}
			onMouseEnter={() => {
				isMouseOverCard = true
				clearTimers()
			}}
			onMouseLeave={() => {
				isMouseOverCard = false
				hideCard()
			}}
		/>
	)
}

function handleMouseOver(e: MouseEvent) {
	const target = e.target as HTMLElement
	const link = target.closest('a[href]') as HTMLAnchorElement | null
	if (!link) return

	const href = link.href
	if (!href || !isSupportedUrl(href)) return

	if (currentLink === link) {
		// If re-entering current link, immediately clear hide timer
		clearTimers()
		return
	}

	clearTimers()
	showTimer = setTimeout(() => {
		showDesktopCard(link)
	}, SHOW_DELAY)
}

function handleMouseOut(e: MouseEvent) {
	const target = e.target as HTMLElement
	const link = target.closest('a[href]') as HTMLAnchorElement | null

	if (!link || link !== currentLink) return

	clearTimers()
	hideTimer = setTimeout(() => {
		if (!isMouseOverCard) hideCard()
	}, HIDE_DELAY)
}

function handleScroll() {
	if (currentLink) hideCard()
}

const SHORT_DELAY = 100

function handleGlobalClick(e: MouseEvent) {
	// Immediate cleanup on any click (navigating, interacting)
	hideCard()
}

export function initMediaHoverCards(): void {
	if (isInitialized) return
	isInitialized = true

	document.addEventListener('mouseover', handleMouseOver)
	document.addEventListener('mouseout', handleMouseOut)
	
	// New: Capture phase click listener for immediate dismissal
	document.addEventListener('click', handleGlobalClick, { capture: true })
	
	window.addEventListener('scroll', handleScroll, { passive: true })
	window.addEventListener('beforeunload', cleanupMediaHoverCards)
}

export function cleanupMediaHoverCards(): void {
	hideCard()
	document.removeEventListener('mouseover', handleMouseOver)
	document.removeEventListener('mouseout', handleMouseOut)
	document.removeEventListener('click', handleGlobalClick, { capture: true })
	window.removeEventListener('scroll', handleScroll)
	window.removeEventListener('beforeunload', cleanupMediaHoverCards)
	isInitialized = false
}
