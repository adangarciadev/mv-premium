// features/user-customizations/logic/mute-placeholder.ts
/**
 * Mute placeholder system for ignored users.
 * Creates and manages the collapsible placeholder UI for muted posts.
 */

import { DOM_MARKERS } from '@/constants'

/**
 * Inline styles for the mute placeholder container.
 */
const PLACEHOLDER_STYLES = `
  padding: 12px 20px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--foreground);
  margin: 12px;
  position: relative;
  overflow: hidden;
  transition: all 0.05s ease;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
`

/**
 * HTML template for the mute placeholder content.
 */
function getPlaceholderHTML(username: string): string {
	return `
    <div style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent, var(--primary), transparent);
        opacity: 0.5;
    "></div>
    <div style="display: flex; align-items: center; gap: 12px;">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
      <span style="font-weight: 500;">Mensaje oculto de <strong style="color: var(--primary);">${username}</strong></span>
    </div>
    <button class="${DOM_MARKERS.CLASSES.REVEAL_BTN}" style="
      background: var(--muted);
      color: var(--foreground);
      border: 1px solid var(--border);
      padding: 6px 16px;
      border-radius: calc(var(--radius) / 1.5);
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.05s ease;
    ">Mostrar</button>
  `
}

/**
 * Sets up hover effects for the reveal button.
 */
function setupButtonHoverEffects(button: HTMLButtonElement): void {
	button.addEventListener('mouseenter', () => {
		button.style.borderColor = 'var(--primary)'
		button.style.backgroundColor = 'var(--primary)'
		button.style.color = 'var(--primary-foreground)'
		button.style.boxShadow = '0 0 10px -2px var(--primary)'
	})

	button.addEventListener('mouseleave', () => {
		button.style.borderColor = 'var(--border)'
		button.style.backgroundColor = 'var(--muted)'
		button.style.color = 'var(--foreground)'
		button.style.boxShadow = 'none'
	})
}

/**
 * Sets up hover effects for the placeholder container.
 */
function setupPlaceholderHoverEffects(placeholder: HTMLElement): void {
	placeholder.addEventListener('mouseenter', () => {
		placeholder.style.borderColor = 'var(--primary)'
		placeholder.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
		const svg = placeholder.querySelector('svg')
		if (svg) svg.style.stroke = 'var(--primary)'
	})

	placeholder.addEventListener('mouseleave', () => {
		placeholder.style.borderColor = 'var(--border)'
		placeholder.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
		const svg = placeholder.querySelector('svg')
		if (svg) svg.style.stroke = 'var(--muted-foreground)'
	})
}

/**
 * Creates and sets up the reveal button click handler.
 */
function setupRevealHandler(placeholder: HTMLElement, postContainer: HTMLElement): void {
	const revealBtn = placeholder.querySelector(`.${DOM_MARKERS.CLASSES.REVEAL_BTN}`) as HTMLButtonElement
	if (!revealBtn) return

	revealBtn.addEventListener('click', e => {
		e.preventDefault()
		e.stopPropagation()

		postContainer.classList.remove(DOM_MARKERS.CLASSES.MUTED_USER)
		postContainer.dataset.mvpRevealed = 'true'
		delete postContainer.dataset.mvpHasPlaceholder

		// Remove ALL possible placeholder remnants
		postContainer.querySelectorAll(`.${DOM_MARKERS.CLASSES.MUTE_PLACEHOLDER}`).forEach(p => p.remove())
	})

	setupButtonHoverEffects(revealBtn)
}

/**
 * Creates a mute placeholder element for a post container.
 * The placeholder shows a message indicating the post is hidden and provides a reveal button.
 */
export function createMutePlaceholder(username: string, postContainer: HTMLElement): HTMLElement {
	const placeholder = document.createElement('div')
	placeholder.className = DOM_MARKERS.CLASSES.MUTE_PLACEHOLDER
	placeholder.style.cssText = PLACEHOLDER_STYLES
	placeholder.innerHTML = getPlaceholderHTML(username)

	setupRevealHandler(placeholder, postContainer)
	setupPlaceholderHoverEffects(placeholder)

	return placeholder
}

/**
 * Checks if a post container already has a valid mute placeholder.
 */
export function hasValidMutePlaceholder(postContainer: HTMLElement): boolean {
	// Check both class and data attribute
	if (
		postContainer.classList.contains(DOM_MARKERS.CLASSES.MUTED_USER) &&
		postContainer.dataset.mvpHasPlaceholder === 'true'
	) {
		// Double check: if placeholder is somehow missing from DOM despite flag, return false
		return !!postContainer.querySelector(`.${DOM_MARKERS.CLASSES.MUTE_PLACEHOLDER}`)
	}
	return false
}

/**
 * Applies mute state to a post container.
 * Returns true if mute was applied, false if already muted or revealed.
 */
export function applyMuteToPost(username: string, postContainer: HTMLElement): boolean {
	// Check manual revealed flag to avoid re-muting
	if (postContainer.dataset.mvpRevealed === 'true') return false

	// Check for existing valid placeholder
	if (hasValidMutePlaceholder(postContainer)) {
		return false // Already muted and placeholder exists
	}

	// Reset any invalid state
	if (postContainer.dataset.mvpHasPlaceholder === 'true') {
		delete postContainer.dataset.mvpHasPlaceholder
		postContainer.classList.remove(DOM_MARKERS.CLASSES.MUTED_USER)
	}

	// Apply mute
	postContainer.classList.add(DOM_MARKERS.CLASSES.MUTED_USER)
	postContainer.dataset.mvpHasPlaceholder = 'true'

	const placeholder = createMutePlaceholder(username, postContainer)
	postContainer.appendChild(placeholder)

	return true
}

/**
 * Applies hide state to a post container (completely hidden).
 */
export function applyHideToPost(postContainer: HTMLElement): void {
	if (!postContainer.classList.contains(DOM_MARKERS.CLASSES.IGNORED_USER)) {
		postContainer.classList.add(DOM_MARKERS.CLASSES.IGNORED_USER)
		postContainer.style.display = 'none'
	}
}
