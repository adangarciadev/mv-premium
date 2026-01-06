/**
 * Gallery Injection Logic
 *
 * Injects the gallery trigger button into the thread page.
 * Uses native DOM for seamless integration with MV's UI.
 *
 * OPTIMIZATION: GalleryCarousel is loaded dynamically to avoid bundling
 * jszip and other heavy dependencies in the main content script.
 */
import { getThreadMedia, isThreadPage, type ThreadMedia } from '../lib/thread-scraper'
import { mountFeature, unmountFeature, isFeatureMounted } from '@/lib/content-modules/utils/react-helpers'
import {
	createThreadActionButton,
	type ThreadActionButtonResult,
} from '@/lib/content-modules/utils/thread-action-button'
import { FEATURE_IDS, DOM_MARKERS } from '@/constants'
import { getSettings } from '@/store/settings-store'

// =============================================================================
// CONSTANTS
// =============================================================================

const BUTTON_ID = DOM_MARKERS.IDS.GALLERY_BTN
const CAROUSEL_FEATURE_ID = FEATURE_IDS.GALLERY_MODAL

// =============================================================================
// STATE
// =============================================================================

let currentMedia: ThreadMedia[] = []
let buttonRef: ThreadActionButtonResult | null = null
let contentInjectedHandler: (() => void) | null = null

// =============================================================================
// INJECTION
// =============================================================================

/**
 * Injects the gallery trigger button into the thread action bar.
 * Attaches listeners for infinite scroll updates to refresh the media count.
 */
export async function injectGalleryTrigger(): Promise<void> {
	// Only inject on thread pages
	if (!isThreadPage()) return

	// Check if already injected
	if (buttonRef) return

	// Check if user has disabled the gallery button
	const settings = await getSettings()
	if (settings.galleryButtonEnabled === false) return

	// Scan for media
	const media = getThreadMedia()
	if (media.length === 0) return // Don't show button if no media

	currentMedia = media

	// Create button using shared utility
	buttonRef = createThreadActionButton({
		id: BUTTON_ID,
		icon: 'fa-picture-o',
		text: formatCount(media.length),
		tooltip: `Ver galería (${media.length} imágenes)`,
		ariaLabel: `Abrir galería con ${media.length} imágenes`,
		onClick: () => openGallery(),
	})

	if (!buttonRef) return

	// Re-scan when new content is loaded via infinite scroll
	contentInjectedHandler = () => {
		const newMedia = getThreadMedia()
		currentMedia = newMedia
		buttonRef?.updateText(formatCount(newMedia.length))
		buttonRef?.updateTooltip(
			`Ver galería (${newMedia.length} imágenes)`,
			`Abrir galería con ${newMedia.length} imágenes`
		)
	}
	window.addEventListener(DOM_MARKERS.EVENTS.CONTENT_INJECTED, contentInjectedHandler)
}

/**
 * Removes the gallery trigger button and cleans up all associated event listeners.
 */
export function cleanupGalleryButton(): void {
	if (contentInjectedHandler) {
		window.removeEventListener(DOM_MARKERS.EVENTS.CONTENT_INJECTED, contentInjectedHandler)
		contentInjectedHandler = null
	}
	buttonRef?.remove()
	buttonRef = null
}

// =============================================================================
// HELPERS
// =============================================================================

function formatCount(count: number): string {
	return count > 99 ? '99+' : String(count)
}

/**
 * Open the gallery carousel using centralized Root Manager
 * OPTIMIZATION: Lazy loads GalleryCarousel to avoid bundling jszip in main.js
 */
async function openGallery(): Promise<void> {
	if (isFeatureMounted(CAROUSEL_FEATURE_ID)) return

	// Create root element for gallery
	let galleryRoot = document.getElementById(DOM_MARKERS.IDS.GALLERY_ROOT)
	if (!galleryRoot) {
		galleryRoot = document.createElement('div')
		galleryRoot.id = DOM_MARKERS.IDS.GALLERY_ROOT
		document.body.appendChild(galleryRoot)
	}

	// Lazy load GalleryCarousel component to avoid bundling jszip in main.js
	const { GalleryCarousel } = await import('../components/gallery-carousel')

	// Mount using Root Manager for proper lifecycle management
	mountFeature(
		CAROUSEL_FEATURE_ID,
		galleryRoot,
		<GalleryCarousel media={currentMedia} isOpen={true} onClose={closeGallery} />
	)
}

/**
 * Closes the gallery carousel and cleans up the temporary root element from the DOM.
 */
function closeGallery(): void {
	unmountFeature(CAROUSEL_FEATURE_ID)

	// Remove root element
	const galleryRoot = document.getElementById(DOM_MARKERS.IDS.GALLERY_ROOT)
	if (galleryRoot) {
		galleryRoot.remove()
	}
}
