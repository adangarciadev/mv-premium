/**
 * Muted Words Filter module
 * Applies blur effect to posts containing muted words
 *
 * STRATEGY:
 * - Use CSS class 'mvp-muted-container' to handle visual blurring (text-shadow + color:transparent).
 * - Inject overlay as a normal child.
 * - CSS handles the visibility of children vs overlay.
 * - Zero complex JS positioning or inline styles to prevent flickering.
 */

import { MV_SELECTORS, DOM_MARKERS } from '@/constants'
import { logger } from '@/lib/logger'

// Internal state to avoid redundant calls
let isFilterExecuting = false

const MUTED_CONTAINER_CLASS = DOM_MARKERS.CLASSES.MUTED_CONTAINER
const MUTED_QUOTE_CLASS = DOM_MARKERS.CLASSES.MUTED_QUOTE
const REVEALED_MARKER = DOM_MARKERS.POST.MUTED_REVEALED
const OVERLAY_CLASS = DOM_MARKERS.CLASSES.MUTED_OVERLAY

// =============================================================================
// REGEX SUPPORT
// =============================================================================

interface CompiledPattern {
	original: string // Original word for display
	isRegex: boolean // Whether this is a regex pattern
	regex?: RegExp // Compiled regex (if isRegex)
	lowerWord?: string // Lowercase word (if not regex)
}

function sanitizeRegexFlags(flags: string): string {
	// Remove stateful flags that can cause RegExp.test() inconsistencies across posts.
	const safeFlags = flags.replace(/[gy]/g, '')
	return safeFlags || 'i'
}

function escapeHtml(text: string): string {
	const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }
	return text.replace(/[&<>"']/g, char => map[char])
}

// Cache for compiled patterns and config
let cachedConfig: {
	words: string[]
	patterns: CompiledPattern[]
	enabled: boolean
} = {
	words: [],
	patterns: [],
	enabled: false,
}

/**
 * Processes a word or pattern into a CompiledPattern object.
 * If the word starts with '/', it is treated as a regular expression.
 * @param word - The raw string or regex pattern to compile
 */
export function compilePattern(word: string): CompiledPattern {
	const trimmed = word.trim()

	// Check if it's a regex pattern (starts with /)
	if (trimmed.startsWith('/')) {
		try {
			// Parse regex: /pattern/flags format
			const match = trimmed.match(/^\/(.+?)\/([gimsuy]*)$/)
			if (match) {
				const [, pattern, flags] = match
				return {
					original: word,
					isRegex: true,
					regex: new RegExp(pattern, sanitizeRegexFlags(flags)),
				}
			}
			// Fallback: treat as simple pattern without closing /
			// e.g., "/spoiler" becomes /spoiler/i
			const simplePattern = trimmed.slice(1)
			return {
				original: word,
				isRegex: true,
				regex: new RegExp(simplePattern, 'i'),
			}
		} catch {
			// Invalid regex, fall back to literal match
			logger.warn(`Invalid regex pattern: ${word}`)
			return {
				original: word,
				isRegex: false,
				lowerWord: trimmed.toLowerCase(),
			}
		}
	}

	// Regular word: case-insensitive literal match
	return {
		original: word,
		isRegex: false,
		lowerWord: trimmed.toLowerCase(),
	}
}

/**
 * Checks if a given text string matches a specific compiled pattern.
 */
export function matchesPattern(text: string, pattern: CompiledPattern): boolean {
	if (pattern.isRegex && pattern.regex) {
		// Defensive reset in case an existing persisted pattern still has stateful flags.
		pattern.regex.lastIndex = 0
		return pattern.regex.test(text)
	}
	return text.toLowerCase().includes(pattern.lowerWord || '')
}

/**
 * Updates the local configuration cache with new words and enabled status.
 * Optimized to perform compilation once per word set.
 */
export function updateMutedWordsConfig(config: { words: string[]; enabled: boolean }): void {
	cachedConfig = {
		words: config.words,
		patterns: config.words.map(compilePattern),
		enabled: config.enabled,
	}
}

/**
 * Orchestrates the muting process across the entire page.
 * Processes both main posts and reply threads, including nested blockquotes.
 */
export async function applyMutedWordsFilter(): Promise<void> {
	if (isFilterExecuting) return
	isFilterExecuting = true

	try {
		// Use cached config - purely synchronous check
		const config = cachedConfig

		// If disabled or no words, clear everything and stop
		if (!config.enabled || config.words.length === 0) {
			clearAllMutedOverlays()
			return
		}

		// Find all posts AND replies on the page
		// .post[data-num] = main posts
		// .rep[data-num] = reply threads (appear when clicking "X respuestas")
		const posts = document.querySelectorAll(MV_SELECTORS.THREAD.POST_ALL)

		posts.forEach(post => {
			const postEl = post as HTMLElement

			// 1. Skip if already revealed manually in this session
			if (postEl.getAttribute(REVEALED_MARKER) === 'true') {
				return
			}

			// 2. Find post-contents (the actual content container)
			const postContents = postEl.querySelector(MV_SELECTORS.THREAD.POST_CONTENTS) as HTMLElement
			if (!postContents) return

			// 3. Extract text for matching
			const postText = postContents.textContent || ''

			// 4. Check for matches using compiled patterns (supports regex)
			let matchedWord: string | null = null
			for (const pattern of config.patterns) {
				if (matchesPattern(postText, pattern)) {
					matchedWord = pattern.original // Original for display
					break
				}
			}

			// 5. Apply or remove mute based on match
			const isCurrentlyMuted = postContents.classList.contains(MUTED_CONTAINER_CLASS)

			if (matchedWord) {
				// Should be muted
				if (!isCurrentlyMuted) {
					applyMuteToPost(postEl, postContents, matchedWord)
				}
			} else {
				// Should NOT be muted
				if (isCurrentlyMuted) {
					removeMuteFromPost(postEl, postContents)
				}
			}
		})

		// =====================================================================
		// PHASE 2: Scan blockquotes within posts/replies that are NOT muted
		// This catches quoted content from muted posts appearing in non-muted posts
		// Blockquotes appear when clicking on quote links like "#3"
		// =====================================================================
		const blockquotes = document.querySelectorAll('.post-contents:not(.mvp-muted-container) blockquote.quote')

		blockquotes.forEach(bq => {
			const blockquote = bq as HTMLElement

			// Skip if already revealed
			if (blockquote.getAttribute(REVEALED_MARKER) === 'true') {
				return
			}

			// Get the body text of the quote (not the header)
			const quoteBody = blockquote.querySelector('.bd') as HTMLElement
			if (!quoteBody) return

			const quoteText = quoteBody.textContent || ''

			// Check for matches using compiled patterns (supports regex)
			let matchedWord: string | null = null
			for (const pattern of config.patterns) {
				if (matchesPattern(quoteText, pattern)) {
					matchedWord = pattern.original
					break
				}
			}

			const isCurrentlyMuted = blockquote.classList.contains(MUTED_QUOTE_CLASS)

			if (matchedWord) {
				if (!isCurrentlyMuted) {
					applyMuteToBlockquote(blockquote, matchedWord)
				}
			} else {
				if (isCurrentlyMuted) {
					removeMuteFromBlockquote(blockquote)
				}
			}
		})
	} finally {
		isFilterExecuting = false
	}
}

/**
 * Safely removes all muting visual effects and overlays from the document.
 */
export function clearAllMutedOverlays(): void {
	// Clear muted posts
	document.querySelectorAll(`.${MUTED_CONTAINER_CLASS}`).forEach(node => {
		const postContents = node as HTMLElement
		const postEl = postContents.closest('.post') as HTMLElement
		removeMuteFromPost(postEl, postContents)
	})

	// Clear muted blockquotes
	document.querySelectorAll(`.${MUTED_QUOTE_CLASS}`).forEach(node => {
		removeMuteFromBlockquote(node as HTMLElement)
	})
}

/**
 * Applies the muting CSS classes and injects the interactive overlay to a specific post.
 */
function applyMuteToPost(postEl: HTMLElement, postContents: HTMLElement, matchedWord: string): void {
	// Add CSS class that handles all blurring magic
	postContents.classList.add(MUTED_CONTAINER_CLASS)

	// Create overlay if not exists
	if (!postContents.querySelector(`.${OVERLAY_CLASS}`)) {
		const overlay = createMuteOverlay(matchedWord)

		postContents.appendChild(overlay)
	}
}

/**
 * Remove mute effect from a post
 */
function removeMuteFromPost(postEl: HTMLElement, postContents: HTMLElement): void {
	if (!postContents) return

	// Remove CSS class
	postContents.classList.remove(MUTED_CONTAINER_CLASS)

	// Remove overlay
	const overlay = postContents.querySelector(`.${OVERLAY_CLASS}`)
	if (overlay) overlay.remove()
}

/**
 * Factory function for creating the interactive muted post overlay.
 * Handles domestic centering and localized UI text.
 */
/**
 * Factory function for creating the interactive muted post overlay.
 * Handles domestic centering and localized UI text.
 */
function createMuteOverlay(matchedWord: string): HTMLElement {
	const overlay = document.createElement('div')
	overlay.className = OVERLAY_CLASS
	// data-mvp-injected is added to avoid mutation loops
	overlay.setAttribute(DOM_MARKERS.DATA_ATTRS.INJECTED, 'true')

	// Outer Overlay (Blurred Background)
	overlay.style.cssText = `
		position: absolute;
		top: 0; left: 0; right: 0; bottom: 0;
		border-radius: var(--radius);
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--background);
		background-image: radial-gradient(circle at center, var(--card) 0%, var(--background) 100%);
		backdrop-filter: blur(4px);
		cursor: default;
		transition: all 0.1s ease;
		z-index: 20;
		overflow: hidden;
		opacity: 0.95;
	`

	// Inner Pill Button
	const innerBox = document.createElement('button')
	innerBox.style.cssText = `
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 14px;
		background-color: var(--card);
		border-radius: var(--radius);
		border: 1px solid var(--border);
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
		color: var(--foreground);
		max-width: 90%;
		position: relative;
		font-family: inherit;
	`

	// Inner Content
	innerBox.innerHTML = `
		<div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: stroke 0.2s;">
				<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
				<line x1="1" y1="1" x2="23" y2="23"/>
			</svg>
			<span class="label" style="font-size: 12px; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap;">Silenciado</span>
		</div>
		
		<div style="width: 1px; height: 12px; background-color: var(--border); flex-shrink: 0;"></div>

		<div style="font-size: 11px; color: var(--muted-foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
			Filtro: <span style="color: var(--foreground); font-weight: 500;">${escapeHtml(matchedWord)}</span>
		</div>
	`

	overlay.appendChild(innerBox)

	// Hover Interactions
	innerBox.addEventListener('mouseenter', () => {
		innerBox.style.borderColor = 'var(--primary)'
		innerBox.style.boxShadow = '0 4px 12px -2px rgba(0, 0, 0, 0.15), 0 0 8px -2px var(--primary)'

		const svg = innerBox.querySelector('svg')
		if (svg) {
			svg.style.stroke = 'var(--primary)'
			svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' // Toggle to Eye icon
		}

		const label = innerBox.querySelector('.label')
		if (label) label.textContent = 'Mostrar'
	})

	innerBox.addEventListener('mouseleave', () => {
		innerBox.style.borderColor = 'var(--border)'
		innerBox.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'

		const svg = innerBox.querySelector('svg')
		if (svg) {
			svg.style.stroke = 'var(--muted-foreground)'
			svg.innerHTML =
				'<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>' // Back to EyeOff
		}

		const label = innerBox.querySelector('.label')
		if (label) label.textContent = 'Silenciado'
	})

	// Click Handler
	innerBox.addEventListener('click', e => {
		e.preventDefault()
		e.stopPropagation()

		const parent = overlay.parentElement as HTMLElement
		const postEl = overlay.closest('.post') as HTMLElement

		if (postEl) {
			postEl.setAttribute(REVEALED_MARKER, 'true')
		}

		if (parent) {
			removeMuteFromPost(postEl, parent)
		}
	})

	return overlay
}

// =============================================================================
// BLOCKQUOTE MUTING FUNCTIONS
// =============================================================================

/**
 * Apply mute effect to a blockquote
 */
function applyMuteToBlockquote(blockquote: HTMLElement, matchedWord: string): void {
	blockquote.classList.add(MUTED_QUOTE_CLASS)
	blockquote.setAttribute(DOM_MARKERS.DATA_ATTRS.INJECTED, 'true')

	// Create smaller overlay for quotes
	if (!blockquote.querySelector(`.${OVERLAY_CLASS}`)) {
		const overlay = createQuoteOverlay(matchedWord, blockquote)
		blockquote.appendChild(overlay)
	}
}

/**
 * Remove mute effect from a blockquote
 */
function removeMuteFromBlockquote(blockquote: HTMLElement): void {
	if (!blockquote) return

	blockquote.classList.remove(MUTED_QUOTE_CLASS)

	const overlay = blockquote.querySelector(`.${OVERLAY_CLASS}`)
	if (overlay) overlay.remove()
}

/**
 * Create a smaller overlay for muted quotes
 */
function createQuoteOverlay(matchedWord: string, blockquote: HTMLElement): HTMLElement {
	const overlay = document.createElement('div')
	overlay.className = OVERLAY_CLASS
	overlay.setAttribute('data-mvp-injected', 'true')

	overlay.style.cssText = `
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--background);
		cursor: default;
		z-index: 10;
		border-radius: var(--radius);
		backdrop-filter: blur(4px);
		opacity: 0.95;
	`

	const innerBox = document.createElement('button')
	innerBox.style.cssText = `
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 10px;
		background-color: var(--card);
		border-radius: var(--radius);
		border: 1px solid var(--border);
		font-size: 11px;
		font-weight: 600;
		color: var(--foreground);
		transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		cursor: pointer;
		font-family: inherit;
	`
	innerBox.innerHTML = `
		<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition: stroke 0.2s;">
			<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
			<line x1="1" y1="1" x2="23" y2="23"/>
		</svg>
		<span class="label">Cita silenciada</span>
	`

	overlay.appendChild(innerBox)

	innerBox.addEventListener('mouseenter', () => {
		innerBox.style.borderColor = 'var(--primary)'
		innerBox.style.boxShadow = '0 0 10px -2px var(--primary)'

		const svg = innerBox.querySelector('svg')
		if (svg) {
			svg.style.stroke = 'var(--primary)'
			svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
		}

		const span = innerBox.querySelector('.label')
		if (span) span.textContent = 'Ver'
	})

	innerBox.addEventListener('mouseleave', () => {
		innerBox.style.borderColor = 'var(--border)'
		innerBox.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'

		const svg = innerBox.querySelector('svg')
		if (svg) {
			svg.style.stroke = 'var(--muted-foreground)'
			svg.innerHTML =
				'<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
		}

		const span = innerBox.querySelector('.label')
		if (span) span.textContent = 'Cita silenciada'
	})

	// Click to reveal
	innerBox.addEventListener('click', e => {
		e.preventDefault()
		e.stopPropagation()

		blockquote.setAttribute(REVEALED_MARKER, 'true')
		removeMuteFromBlockquote(blockquote)
	})

	return overlay
}
