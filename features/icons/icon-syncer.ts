import { ALL_SUBFORUMS } from '@/lib/subforums'
import { logger } from '@/lib/logger'
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'

export interface FidIconStyle {
	backgroundImage: string
	backgroundPosition: string
	width: string
	height: string
}

export const ICONS_STORAGE_KEY = `local:${STORAGE_KEYS.FID_ICONS_CACHE}` as `local:${string}`

/**
 * Extracts FID icon styles from the DOM and saves them to storage
 * This must run in the CONTENT SCRIPT context where Mediavida CSS is present
 */
export async function syncFidIcons() {
	// Only run if we are on the main site
	if (!document.body) return

	const cache: Record<number, FidIconStyle> = {}
	let hasUpdates = false

	// Create a container for our temp elements
	const container = document.createElement('div')
	container.style.position = 'absolute'
	container.style.visibility = 'hidden'
	container.style.pointerEvents = 'none'
	container.style.top = '-9999px'
	document.body.appendChild(container)

	try {
		// Collect all unique icon IDs
		const uniqueIconIds = new Set(ALL_SUBFORUMS.map(sf => sf.iconId))

		// Batch creation of elements
		const elements: Record<number, HTMLElement> = {}
		uniqueIconIds.forEach(id => {
			const el = document.createElement('i')
			el.className = `fid fid-${id}`
			container.appendChild(el)
			elements[id] = el
		})

		// Force layout (optional, usually browser does it on getComputedStyle)

		// Read styles
		uniqueIconIds.forEach(id => {
			const el = elements[id]
			const computed = window.getComputedStyle(el)

			// Validate we got something real (usually bg image is set)
			if (computed.backgroundImage && computed.backgroundImage !== 'none') {
				cache[id] = {
					backgroundImage: computed.backgroundImage,
					backgroundPosition: computed.backgroundPosition,
					width: '24px', // Standard fid size
					height: '24px',
				}
				hasUpdates = true
			}
		})

		if (hasUpdates) {
			await storage.setItem(ICONS_STORAGE_KEY, cache)
		}
	} catch (e) {
		logger.error('Failed to sync icons:', e)
	} finally {
		// Cleanup
		document.body.removeChild(container)
	}
}
