/**
 * Post Summary Button Injection
 *
 * Injects AI summary buttons into each post, next to the pin button.
 */

import { MV_SELECTORS, FEATURE_IDS, DOM_MARKERS } from '@/constants'
import {
	isAlreadyInjected,
	markAsInjected,
	mountFeature,
	unmountFeature,
} from '@/lib/content-modules/utils/react-helpers'
import { PostSummaryDialog } from '../components/post-summary-dialog'

const SUMMARY_BUTTON_MARKER = DOM_MARKERS.POST.SUMMARY_INJECTED
const POPOVER_FEATURE_PREFIX = FEATURE_IDS.POST_SUMMARY_POPOVER_PREFIX

// Track active popover to close on new click
let activePopoverId: string | null = null

/**
 * Creates the AI summary button element for a specific post.
 * @param postEl - The post container element
 * @param postNum - The post number within the thread
 * @returns The list item element containing the button
 */
function createSummaryButton(postEl: HTMLElement, postNum: number): HTMLLIElement {
	const summaryLi = document.createElement('li')
	const summaryBtn = document.createElement('a')

	summaryBtn.href = '#'
	summaryBtn.className = `${MV_SELECTORS.THREAD.POST_BTN.replace('.', '')} summary-post`
	summaryBtn.dataset.postNum = String(postNum)
	summaryBtn.title = 'Resumir post con IA'
	// Using FontAwesome android icon (fa-robot doesn't exist in FA4)
	summaryBtn.innerHTML = `<i class="fa fa-android"></i>`

	summaryBtn.addEventListener('click', e => {
		e.preventDefault()
		e.stopPropagation()

		const featureId = `${POPOVER_FEATURE_PREFIX}${postNum}`

		// Close existing popover if any
		if (activePopoverId) {
			unmountFeature(activePopoverId)
			// If clicking the same button, just close
			if (activePopoverId === featureId) {
				activePopoverId = null
				return
			}
		}

		// Mount dialog
		// We append to body to ensure it's on top of everything
		const container = document.createElement('div')
		container.id = featureId
		document.body.appendChild(container)

		const handleClose = () => {
			unmountFeature(featureId)
			container.remove()
			if (activePopoverId === featureId) {
				activePopoverId = null
			}
		}

		mountFeature(
			featureId,
			container,
			<PostSummaryDialog postElement={postEl} onClose={handleClose} />
		)

		activePopoverId = featureId
	})

	summaryLi.appendChild(summaryBtn)
	return summaryLi
}

/**
 * Injects AI summary buttons into all posts currently visible in the thread.
 */
export function injectSummaryButtons(): void {
	const posts = document.querySelectorAll(MV_SELECTORS.THREAD.POST)

	posts.forEach(post => {
		const postEl = post as HTMLElement

		const controls = postEl.querySelector('.post-controls .buttons')
		if (!controls) return

		const postNum = parseInt(postEl.dataset.num || '0', 10)
		if (!postNum) return

		// Check if button actually exists in DOM (not just marker)
		// This handles the case where Mediavida rebuilds .buttons for moderators
		const existingButton = controls.querySelector('.summary-post')
		if (existingButton) return // Already has button, skip

		// Mark post as processed (for tracking)
		if (!isAlreadyInjected(postEl, SUMMARY_BUTTON_MARKER)) {
			markAsInjected(postEl, SUMMARY_BUTTON_MARKER)
		}

		// Create the summary button
		const summaryLi = createSummaryButton(postEl, postNum)

		// Find the pin button to insert before it (pin has class .pin-post)
		// Use try-catch to handle race condition where Mediavida modifies DOM simultaneously
		try {
			const pinButton = controls.querySelector('.pin-post')?.parentElement

			if (pinButton && pinButton.parentElement === controls) {
				// Insert before pin button
				controls.insertBefore(summaryLi, pinButton)
			} else {
				// Fallback: insert before reply button (.btn-reply) for consistent positioning
				const replyBtnLi = controls.querySelector('.btn-reply')?.parentElement
				if (replyBtnLi && replyBtnLi.parentElement === controls) {
					controls.insertBefore(summaryLi, replyBtnLi)
				} else {
					controls.appendChild(summaryLi)
				}
			}
		} catch {
			// Fallback: append to end if insertBefore fails
			try {
				controls.appendChild(summaryLi)
			} catch {
				// DOM was modified, skip this post
			}
		}
	})
}

/**
 * Initializes a MutationObserver to inject summary buttons into new posts (e.g., Infinite Scroll).
 */
export function initSummaryButtonsObserver(): void {
	// Initial injection
	injectSummaryButtons()

	// Observe for new posts
	const observer = new MutationObserver(mutations => {
		let shouldInject = false

		for (const mutation of mutations) {
			if (mutation.addedNodes.length > 0) {
				shouldInject = true
				break
			}
		}

		if (shouldInject) {
			injectSummaryButtons()
		}
	})

	const postsContainer = document.querySelector(MV_SELECTORS.GLOBAL.POSTS_ALT) || document.body

	observer.observe(postsContainer, {
		childList: true,
		subtree: true,
	})
}
