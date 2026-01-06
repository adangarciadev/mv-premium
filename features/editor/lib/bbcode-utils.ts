/**
 * BBCode Utilities
 *
 * Functions to detect and manipulate BBCode formatting in text.
 */

// ============================================================================
// Types
// ============================================================================

export interface FormatTag {
	id: string // Toolbar button ID (e.g., 'bold', 'italic')
	openTag: string // Opening tag (e.g., '[b]')
	closeTag: string // Closing tag (e.g., '[/b]')
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Mapping of toolbar button IDs to their BBCode tags
 */
export const FORMAT_TAGS: FormatTag[] = [
	{ id: 'bold', openTag: '[b]', closeTag: '[/b]' },
	{ id: 'italic', openTag: '[i]', closeTag: '[/i]' },
	{ id: 'underline', openTag: '[u]', closeTag: '[/u]' },
	{ id: 'strikethrough', openTag: '[s]', closeTag: '[/s]' },
	{ id: 'quote', openTag: '[quote]', closeTag: '[/quote]' },
	{ id: 'spoiler', openTag: '[spoiler]', closeTag: '[/spoiler]' },
	{ id: 'nsfw', openTag: '[spoiler=NSFW]', closeTag: '[/spoiler]' },
	{ id: 'center', openTag: '[center]', closeTag: '[/center]' },
]

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Detects which BBCode formats are active at the cursor position.
 * A format is "active" if the cursor is inside an opening and closing tag pair.
 *
 * @param text - The full text content
 * @param cursorPos - Current cursor position
 * @returns Array of active format IDs (e.g., ['bold', 'italic'])
 */
export function getActiveFormats(text: string, cursorPos: number): string[] {
	const activeFormats: string[] = []

	for (const format of FORMAT_TAGS) {
		if (isInsideTag(text, cursorPos, format)) {
			activeFormats.push(format.id)
		}
	}

	return activeFormats
}

/**
 * Checks if the selection or cursor is wrapped by a specific BBCode tag pair.
 * @param text - The full content string
 * @param cursorPos - Position to check
 * @param format - The tag configuration to look for
 * @returns True if the cursor is within the tag boundaries
 */
function isInsideTag(text: string, cursorPos: number, format: FormatTag): boolean {
	const { openTag, closeTag } = format
	const openTagLower = openTag.toLowerCase()
	const closeTagLower = closeTag.toLowerCase()
	const textLower = text.toLowerCase()

	// Count open tags before cursor
	let depth = 0
	let searchPos = 0

	while (searchPos < cursorPos) {
		const openIndex = textLower.indexOf(openTagLower, searchPos)
		const closeIndex = textLower.indexOf(closeTagLower, searchPos)

		// No more tags before cursor
		if (openIndex === -1 && closeIndex === -1) break
		if (openIndex === -1) openIndex === Infinity
		if (closeIndex === -1) closeIndex === Infinity

		// Find the nearest tag
		if (openIndex !== -1 && (closeIndex === -1 || openIndex < closeIndex) && openIndex < cursorPos) {
			depth++
			searchPos = openIndex + openTag.length
		} else if (closeIndex !== -1 && closeIndex < cursorPos) {
			depth = Math.max(0, depth - 1)
			searchPos = closeIndex + closeTag.length
		} else {
			break
		}
	}

	return depth > 0
}

// ============================================================================
// Manipulation Functions
// ============================================================================

/**
 * Locates the starting and ending indices of the opening and closing tags containing the cursor.
 * @param text - The full content
 * @param cursorPos - Target position
 * @param format - The tag configuration
 * @returns Boundary indices or null if not inside the specified tag
 */
export function findTagBounds(
	text: string,
	cursorPos: number,
	format: FormatTag
): { openStart: number; openEnd: number; closeStart: number; closeEnd: number } | null {
	const { openTag, closeTag } = format
	const textLower = text.toLowerCase()
	const openTagLower = openTag.toLowerCase()
	const closeTagLower = closeTag.toLowerCase()

	// Find the opening tag before cursor
	let openStart = -1
	let searchPos = 0
	let lastOpenStart = -1

	while (searchPos < cursorPos) {
		const idx = textLower.indexOf(openTagLower, searchPos)
		if (idx === -1 || idx >= cursorPos) break
		lastOpenStart = idx
		searchPos = idx + openTag.length
	}

	if (lastOpenStart === -1) return null

	// Check if there's a close tag between the open tag and cursor
	const closeBeforeCursor = textLower.indexOf(closeTagLower, lastOpenStart + openTag.length)
	if (closeBeforeCursor !== -1 && closeBeforeCursor < cursorPos) {
		// There's a close tag between open and cursor, so we're not inside this pair
		// But there might be nested tags, so let's do a proper depth check
		// For simplicity, if there's any close between open and cursor with matching depth, we're outside
		// This is a simplified check - for now we'll use the depth-based approach above
		return null
	}

	openStart = lastOpenStart
	const openEnd = openStart + openTag.length

	// Find the closing tag after cursor
	const closeStart = textLower.indexOf(closeTagLower, Math.max(openEnd, cursorPos))
	if (closeStart === -1) return null

	const closeEnd = closeStart + closeTag.length

	return { openStart, openEnd, closeStart, closeEnd }
}

/**
 * Removes the surrounding BBCode tags at the cursor position and adjusts the cursor.
 * @param text - The full content
 * @param cursorPos - Current cursor position
 * @param format - The tag to remove
 */
export function unwrapBBCode(
	text: string,
	cursorPos: number,
	format: FormatTag
): { newText: string; newCursorPos: number } | null {
	const bounds = findTagBounds(text, cursorPos, format)
	if (!bounds) return null

	const { openStart, openEnd, closeStart, closeEnd } = bounds

	// Build new text by removing close tag first (to preserve indices)
	let newText = text.substring(0, closeStart) + text.substring(closeEnd)
	// Then remove open tag
	newText = newText.substring(0, openStart) + newText.substring(openEnd)

	// Calculate new cursor position
	let newCursorPos = cursorPos

	// If cursor was after the open tag, adjust for its removal
	if (cursorPos > openEnd) {
		newCursorPos -= format.openTag.length
	}
	// Cursor position relative to close tag doesn't need adjustment since close comes after

	return { newText, newCursorPos }
}

/**
 * Retrieves the format tag configuration for a given button identifier.
 * @param id - The ID of the format (e.g., 'bold', 'italic')
 */
export function getFormatById(id: string): FormatTag | undefined {
	return FORMAT_TAGS.find(f => f.id === id)
}
