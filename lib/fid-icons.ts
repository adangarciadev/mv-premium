/**
 * Subforum Icon Helper for Shadow DOM
 *
 * Extracts computed styles from native Mediavida fid icons (in Light DOM)
 * and returns inline styles that can be used inside Shadow DOM.
 */

// Cache for extracted icon styles
const iconStyleCache = new Map<number, { backgroundImage: string; backgroundPosition: string }>()

/**
 * Extract computed styles for a fid icon from the Light DOM
 * Creates a temporary element, gets computed styles, then removes it
 */
export function getFidIconStyles(iconId: number): React.CSSProperties {
	// Check cache first
	if (iconStyleCache.has(iconId)) {
		const cached = iconStyleCache.get(iconId)!
		return {
			backgroundImage: cached.backgroundImage,
			backgroundPosition: cached.backgroundPosition,
			backgroundRepeat: 'no-repeat',
			width: 24,
			height: 24,
			display: 'inline-block',
			verticalAlign: 'middle',
		}
	}

	// Create temporary element in Light DOM to extract computed styles
	const temp = document.createElement('i')
	temp.className = `fid fid-${iconId}`
	temp.style.position = 'absolute'
	temp.style.visibility = 'hidden'
	temp.style.pointerEvents = 'none'
	document.body.appendChild(temp)

	// Get computed styles
	const computed = window.getComputedStyle(temp)
	const backgroundImage = computed.backgroundImage
	const backgroundPosition = computed.backgroundPosition

	// Clean up
	document.body.removeChild(temp)

	// Cache the result
	iconStyleCache.set(iconId, { backgroundImage, backgroundPosition })

	return {
		backgroundImage,
		backgroundPosition,
		backgroundRepeat: 'no-repeat',
		width: 24,
		height: 24,
		display: 'inline-block',
		verticalAlign: 'middle',
	}
}

/**
 * Pre-cache icon styles for commonly used subforums
 * Call this once when the feature initializes
 */
export function precacheFidIcons(iconIds: number[]): void {
	iconIds.forEach(id => getFidIconStyles(id))
}

/**
 * Clear the icon style cache (useful if page styles change)
 */
export function clearFidIconCache(): void {
	iconStyleCache.clear()
}
