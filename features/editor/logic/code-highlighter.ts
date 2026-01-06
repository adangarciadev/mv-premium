/**
 * Code Highlighter
 *
 * Main orchestration file for syntax highlighting in code blocks.
 * Uses PrismJS via background script messaging to keep the content script lean.
 *
 * Submodules extracted for maintainability:
 * - code-detection.ts: Language detection heuristics
 * - code-ui.ts: Header with label and copy button
 */
import { MV_SELECTORS, DOM_MARKERS } from '@/constants'
import { logger } from '@/lib/logger'
import { sendMessage } from '@/lib/messaging'

// Import modularized logic
import { looksLikeCode, detectLanguage } from './code-detection'
import { attachCodeHeader, removeCodeHeader } from './code-ui'

const HIGHLIGHTED_ATTR = DOM_MARKERS.DATA_ATTRS.HIGHLIGHTED

// =============================================================================
// CONSTANTS
// =============================================================================

// Sanitize config for syntax-highlighted code (only allow Prism's span tags)
// Using a simple regex-based approach to avoid DOMPurify dependency (~50KB)
const ALLOWED_TAGS = new Set(['span', 'br'])
const ALLOWED_ATTRS = new Set(['class'])

/**
 * Lightweight HTML sanitizer for Prism output
 * Only allows <span> with class attribute and <br> tags
 * This is safe because Prism only outputs these tags
 */
function sanitizeHighlightedCode(html: string): string {
	// Parse and rebuild only allowed tags
	const tempDiv = document.createElement('div')
	tempDiv.innerHTML = html

	function sanitizeNode(node: Node): Node | null {
		if (node.nodeType === Node.TEXT_NODE) {
			return node.cloneNode()
		}

		if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as Element
			const tagName = el.tagName.toLowerCase()

			if (!ALLOWED_TAGS.has(tagName)) {
				// Not allowed tag - return text content only
				return document.createTextNode(el.textContent || '')
			}

			// Create clean element
			const cleanEl = document.createElement(tagName)

			// Copy only allowed attributes
			for (const attr of Array.from(el.attributes)) {
				if (ALLOWED_ATTRS.has(attr.name)) {
					cleanEl.setAttribute(attr.name, attr.value)
				}
			}

			// Recursively sanitize children
			for (const child of Array.from(el.childNodes)) {
				const sanitized = sanitizeNode(child)
				if (sanitized) {
					cleanEl.appendChild(sanitized)
				}
			}

			return cleanEl
		}

		return null
	}

	const result = document.createElement('div')
	for (const child of Array.from(tempDiv.childNodes)) {
		const sanitized = sanitizeNode(child)
		if (sanitized) {
			result.appendChild(sanitized)
		}
	}

	return result.innerHTML
}

// =============================================================================
// TEXT EXTRACTION
// =============================================================================

/**
 * Extracts and normalizes text from a code element.
 * Accounts for Mediavida's legacy <br> formatting and avoids double-injection artifacts.
 * @param target - The code DOM element
 * @param force - Whether to re-extract from already highlighted content
 */
function extractCodeText(target: HTMLElement, force: boolean): string {
	// Check if content has <br> tags (Mediavida's format)
	if (target.innerHTML.includes('<br')) {
		// Replace <br> with newlines, then extract text
		const tempDiv = document.createElement('div')
		tempDiv.innerHTML = target.innerHTML.replace(/<br\s*\/?>/gi, '\n')
		return tempDiv.textContent || tempDiv.innerText || ''
	}

	// Already highlighted - extract plain text preserving newlines
	if (force && target.querySelector('span')) {
		return target.innerText || target.textContent || ''
	}

	// Simple text content
	return target.textContent || ''
}

/**
 * Detects explicitly declared language data from the element's attributes or classes.
 * @param target - The code element
 * @param wrapper - Its parent wrapper
 * @returns The language name or null
 */
function extractSpecifiedLanguage(target: HTMLElement, wrapper: HTMLElement): string | null {
	const preElement = target.closest('pre.code') || target.closest('pre') || wrapper

	// Check for language class on the code element (e.g., class="language-html")
	const langFromClass = Array.from(target.classList)
		.find(c => c.startsWith('language-'))
		?.replace('language-', '')

	return (
		preElement?.getAttribute('data-lang') ||
		wrapper.getAttribute('data-lang') ||
		target.getAttribute('data-lang') ||
		langFromClass ||
		null
	)
}

/**
 * Scans the DOM for unhighlighted code blocks and applies Prism.js highlighting.
 * Uses background script messaging to keep Prism out of the content script bundle.
 * @param force - If true, re-highlights even already processed blocks
 */
export async function highlightCodeBlocks(force = false) {
	// Simple and direct selector - find all code elements that haven't been highlighted
	const notHighlighted = force ? '' : `:not([${HIGHLIGHTED_ATTR}="true"])`
	const codeElements = document.querySelectorAll(
		`code[class*="language-"]${notHighlighted}, pre.code code${notHighlighted}, pre.code:not(:has(code))${notHighlighted}, pre > code${notHighlighted}`
	)

	// No code elements to highlight
	if (codeElements.length === 0) {
		return
	}

	// Process each code element
	for (const codeElement of Array.from(codeElements)) {
		const target = codeElement as HTMLElement
		const wrapper = target.parentElement || target

		// Skip if already processed by US (not by Mediavida's native highlighter)
		if (!force && target.getAttribute(HIGHLIGHTED_ATTR) === 'true') {
			continue
		}

		try {
			// Extract specified language BEFORE any modifications
			const specifiedLang = extractSpecifiedLanguage(target, wrapper)

			// When forcing re-highlight, clear existing highlighting
			if (force) {
				// Remove language classes
				const classesToRemove = Array.from(target.classList).filter(c => c.startsWith('language-'))
				classesToRemove.forEach(c => target.classList.remove(c))

				// Remove existing header
				removeCodeHeader(wrapper)
			}

			// Extract text content
			const text = extractCodeText(target, force)

			// Skip if it doesn't look like actual code
			if (!looksLikeCode(text)) {
				target.setAttribute(HIGHLIGHTED_ATTR, 'true')
				continue
			}

			// Determine language: use specified, then detect, then fallback to plain
			const detectedLang = specifiedLang || detectLanguage(text) || 'plain'

			// Highlight with Prism via background script messaging
			const highlightedCode = await sendMessage('highlightCode', {
				code: text,
				language: detectedLang,
			})

			// Apply highlighting (sanitized to prevent XSS)
			target.innerHTML = sanitizeHighlightedCode(highlightedCode)
			target.classList.add(`language-${detectedLang}`)

			// Mark as processed
			target.setAttribute(HIGHLIGHTED_ATTR, 'true')

			// Add header with language label and copy button
			attachCodeHeader(target, detectedLang, text)
		} catch (e) {
			logger.error('Highlight error:', e)
		}
	}
}

// =============================================================================
// NATIVE PREVIEW INTERCEPTOR
// =============================================================================

/**
 * Initializes an interceptor for Mediavida's native AJAX preview system
 * to ensure code blocks in the dynamic preview modal are highlighted.
 */
export function initNativePreviewInterceptor() {
	// Check if already initialized
	if ((window as Window & { __mvPreviewInterceptorInit?: boolean }).__mvPreviewInterceptorInit) {
		return
	}
	;(window as Window & { __mvPreviewInterceptorInit?: boolean }).__mvPreviewInterceptorInit = true

	const previewButton = document.getElementById(MV_SELECTORS.GLOBAL.PREVIEW_BUTTON_ID)
	if (!previewButton) return

	// Add click listener to the preview button
	previewButton.addEventListener('click', () => {
		const previewContainer = document.getElementById(MV_SELECTORS.GLOBAL.PREVIEW_CONTAINER_ID)

		// Watch for class attribute changes on code/pre elements
		if (previewContainer) {
			const observer = new MutationObserver(mutations => {
				let needsHighlight = false

				for (const mutation of mutations) {
					const targetEl = mutation.target as HTMLElement

					// If nodes added (loading content)
					if (mutation.type === 'childList') {
						mutation.addedNodes.forEach(node => {
							if (node instanceof HTMLElement) {
								if (node.tagName === 'PRE' || node.querySelector('pre')) {
									needsHighlight = true
								}
							}
						})
						// Or if general content change
						if (targetEl === previewContainer || targetEl.classList.contains('post-contents')) {
							needsHighlight = true
						}
					}

					// If class changed and it wasn't us
					if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
						if (
							(targetEl.tagName === 'CODE' || targetEl.tagName === 'PRE') &&
							targetEl.className.includes('language-')
						) {
							const isProcessed = targetEl.getAttribute(HIGHLIGHTED_ATTR) === 'true'

							if (isProcessed) {
								// Check if MV changed it back (e.g., Go code misdetected)
								if (targetEl.textContent?.includes('package main') && !targetEl.classList.contains('language-go')) {
									needsHighlight = true
								}
							} else {
								needsHighlight = true
							}
						}
					}
				}

				if (needsHighlight) {
					setTimeout(() => highlightCodeBlocks(true), 50)
				}
			})

			observer.observe(previewContainer, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['class'],
			})

			// Disconnect after 5s
			setTimeout(() => observer.disconnect(), 5000)
		}

		// Polling fallback for Mediavida's preview rendering
		const delays = [200, 500, 800, 1200, 1800, 2500, 3000]
		delays.forEach(delay => {
			setTimeout(() => {
				const pc = document.getElementById(MV_SELECTORS.GLOBAL.PREVIEW_CONTAINER_ID)
				if (pc && pc.style.display !== 'none') {
					highlightCodeBlocks(true)
				}
			}, delay)
		})
	})
}
