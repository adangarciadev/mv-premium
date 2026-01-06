/**
 * Code Block UI Components
 *
 * Creates the header with language label and copy button for code blocks.
 * Separated from code-highlighter.ts for maintainability.
 */

import { getLanguageDisplayName } from './code-detection'
import { logger } from '@/lib/logger'

// =============================================================================
// STYLES
// =============================================================================

const HEADER_STYLES = `
	position: absolute;
	top: 0;
	right: 0;
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 4px 8px;
	background: #161b22;
	border-bottom-left-radius: var(--radius, 6px);
	border-top-right-radius: var(--radius, 6px);
	z-index: 10;
	font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
	font-size: 12px;
`

const LABEL_STYLES = `color: #8b949e; opacity: 0.8;`

const COPY_BUTTON_STYLES = `
	background: transparent;
	border: none;
	color: #8b949e;
	cursor: pointer;
	padding: 2px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: var(--radius, 4px);
	transition: color 0.2s, background 0.2s;
`

// =============================================================================
// ICONS
// =============================================================================

const COPY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`

const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`

// =============================================================================
// UI CREATION
// =============================================================================

/**
 * Component factory for the code block copy button.
 * Attaches clipboard logic and provides visual feedback on success.
 * @param codeText - The raw string to be copied
 */
function createCopyButton(codeText: string): HTMLButtonElement {
	const copyBtn = document.createElement('button')
	copyBtn.className = 'mv-code-copy-btn'
	copyBtn.innerHTML = COPY_ICON
	copyBtn.title = 'Copiar código'
	copyBtn.setAttribute('aria-label', 'Copiar código al portapapeles')
	copyBtn.style.cssText = COPY_BUTTON_STYLES

	// Copy functionality
	copyBtn.addEventListener('click', async () => {
		try {
			await navigator.clipboard.writeText(codeText)
			// Show success feedback
			copyBtn.innerHTML = CHECK_ICON
			copyBtn.style.color = '#22c55e'
			setTimeout(() => {
				copyBtn.innerHTML = COPY_ICON
				copyBtn.style.color = '#8b949e'
			}, 2000)
		} catch (err) {
			logger.error('Failed to copy:', err)
		}
	})

	// Hover effect
	copyBtn.addEventListener('mouseenter', () => {
		copyBtn.style.color = '#c9d1d9'
		copyBtn.style.background = 'rgba(255,255,255,0.1)'
	})
	copyBtn.addEventListener('mouseleave', () => {
		copyBtn.style.color = '#8b949e'
		copyBtn.style.background = 'transparent'
	})

	return copyBtn
}

/**
 * Factory function that creates the code block header DOM element
 * @param language - The language identifier for the label
 * @param codeText - The raw text content for the copy functionality
 */
export function createCodeHeader(language: string, codeText: string): HTMLDivElement {
	const header = document.createElement('div')
	header.className = 'mv-code-header'
	header.style.cssText = HEADER_STYLES

	// Language label
	const label = document.createElement('span')
	label.className = 'mv-code-lang-label'
	label.textContent = getLanguageDisplayName(language)
	label.style.cssText = LABEL_STYLES

	// Copy button
	const copyBtn = createCopyButton(codeText)

	header.appendChild(label)
	header.appendChild(copyBtn)

	return header
}

/**
 * Injects a code header into the specified code block's container
 * @param target - The code or pre element
 * @param language - Language to display
 * @param codeText - Text to copy
 */
export function attachCodeHeader(target: HTMLElement, language: string, codeText: string): void {
	let labelAnchor = target.parentElement
	if (!labelAnchor || labelAnchor.tagName !== 'PRE') {
		labelAnchor = target
	}

	// Ensure parent has relative positioning for absolute header
	const computedStyle = window.getComputedStyle(labelAnchor)
	if (computedStyle.position === 'static') {
		labelAnchor.style.position = 'relative'
	}

	// Create and attach header
	const header = createCodeHeader(language, codeText)
	labelAnchor.appendChild(header)
	labelAnchor.classList.add('code-wrapper')
}

/**
 * Cleans up and removes the code header from a container
 * @param wrapper - The parent element
 */
export function removeCodeHeader(wrapper: Element): void {
	const existingHeader = wrapper.querySelector('.mv-code-header')
	if (existingHeader) {
		existingHeader.remove()
	}
}
