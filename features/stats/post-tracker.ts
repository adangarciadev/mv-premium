/**
 * Post Tracker - Tracks successful post submissions on Mediavida
 *
 * Intercepts form submissions for:
 * - Reply posts: #btsubmit button
 * - New threads: button[name="Submit"] with "Crear tema"
 * - Post edits (full page): button[name="Submit"] with "Editar" on post.php
 * - Post edits (inline): .saveButton on thread page
 */
import { trackActivity } from '@/features/stats/storage'
import { MV_SELECTORS, MV_URLS } from '@/constants'

const SUBMIT_SELECTORS = [
	MV_SELECTORS.GLOBAL.SUBMIT_BUTTON, // Quick reply / Reply page
	MV_SELECTORS.EDITOR.SUBMIT, // New thread creation / Full page edit
]

// Store handlers for cleanup
let inlineEditHandler: ((e: Event) => void) | null = null
const formHandlers = new Map<HTMLFormElement, () => void>()

/**
 * Computes the normalized base URL for the current thread, excluding anchors and pagination.
 */
function getThreadBaseUrl(): string {
	const url = new URL(window.location.href)
	// Remove anchor
	url.hash = ''
	// Remove page number suffix (/2, /3, etc)
	url.pathname = url.pathname.replace(/\/\d+$/, '')
	// Remove /responder suffix
	url.pathname = url.pathname.replace(/\/responder$/, '')
	return url.href
}

/**
 * Check if we're on the post.php edit page
 */
function isPostPhpEditPage(): boolean {
	return window.location.href.includes(MV_URLS.POST_PHP)
}

/**
 * Check if this is a new thread creation page
 */
function isNewThreadPage(): boolean {
	return window.location.href.includes(MV_URLS.NEW_THREAD)
}

/**
 * Extracts thread context (title, subforum, URL) from the current document.
 * Primarily used for thread views and reply pages.
 */
function getThreadInfo(): { title: string; subforum: string; url: string } {
	// Get thread title from headlink (in header)
	const headlinkEl = document.querySelector<HTMLAnchorElement>(
		`${MV_SELECTORS.THREAD.THREAD_HEADLINK}, ${MV_SELECTORS.THREAD.THREAD_HEADLINK_ALT}`
	)
	const titleFromHeader = headlinkEl?.textContent?.trim() || ''
	const urlFromHeader = headlinkEl?.href || ''

	// Get subforum from brand section
	const brandSubforumEl = document.querySelector<HTMLAnchorElement>(MV_SELECTORS.THREAD.BRAND_SUBFORUM)
	const subforumFromBrand = brandSubforumEl?.textContent?.trim() || ''

	// Fallback: get from document title
	let title = titleFromHeader
	let subforum = subforumFromBrand

	if (!title) {
		const docTitle = document.title
		const parts = docTitle.split(' - ')
		if (parts.length >= 2) {
			title = parts[0].trim()
		}
	}

	if (!subforum) {
		const docTitle = document.title
		const parts = docTitle.split(' - ')
		if (parts.length >= 3) {
			subforum = parts[parts.length - 2].trim()
		}
	}

	return {
		title,
		subforum,
		url: urlFromHeader || getThreadBaseUrl(),
	}
}

/**
 * Decode HTML entities in a string
 */
function decodeHtmlEntities(text: string): string {
	const textarea = document.createElement('textarea')
	textarea.innerHTML = text
	return textarea.value
}

/**
 * Clean thread title by removing common suffixes
 */
function cleanThreadTitle(title: string): string {
	return title
		.replace(/\s*\|\s*Mediavida\s*$/i, '') // Remove " | Mediavida"
		.replace(/\s*-\s*Mediavida\s*$/i, '') // Remove " - Mediavida"
		.trim()
}

/**
 * Retrieves the canonical thread title from a given thread URL via background fetch.
 * This is used when the current page context lacks the actual title (e.g., editing page).
 */
async function fetchRealThreadTitle(threadUrl: string): Promise<string> {
	try {
		const response = await fetch(threadUrl, {
			credentials: 'same-origin',
			headers: { Accept: 'text/html' },
		})
		if (!response.ok) return ''

		const html = await response.text()

		// Parse using DOMParser for accurate extraction
		const parser = new DOMParser()
		const doc = parser.parseFromString(html, 'text/html')

		// Get title from headlink (most accurate)
		const headlink = doc.querySelector('a.headlink')
		if (headlink?.textContent) {
			const title = decodeHtmlEntities(headlink.textContent.trim())
			return cleanThreadTitle(title)
		}

		// Fallback: get from <title> tag, extract first part before " - "
		const titleEl = doc.querySelector('title')
		if (titleEl?.textContent) {
			// Format: "Thread Title - Subforum - Mediavida"
			const parts = titleEl.textContent.split(' - ')
			if (parts.length >= 1) {
				const title = decodeHtmlEntities(parts[0].trim())
				return cleanThreadTitle(title)
			}
		}

		return ''
	} catch {
		return ''
	}
}

/**
 * Extract info from post.php edit page
 * The page has subforum in the header, and we fetch the real thread title async
 */
function getEditPageInfo(): { title: string; subforum: string; url: string; needsTitleFetch: boolean } {
	// Get subforum from header: <div class="section"><a href="/foro/tv">Televisión</a>
	const subforumEl = document.querySelector<HTMLAnchorElement>('#title .brand .section a')
	const subforum = subforumEl?.textContent?.trim() || ''

	// Get thread URL from headlink
	const headlinkEl = document.querySelector<HTMLAnchorElement>('#title .brand h1 a.headlink')
	const threadUrl = headlinkEl?.href || ''

	return {
		title: '', // Will be fetched async
		subforum,
		url: threadUrl,
		needsTitleFetch: !!threadUrl,
	}
}

/**
 * Get subforum name from nuevo-hilo page
 */
function getSubforumFromNewThread(): string {
	const subforumEl = document.querySelector<HTMLElement>(MV_SELECTORS.THREAD.SUBFORUM_ALL)
	return subforumEl?.textContent?.trim() || ''
}

/**
 * Sets up the event delegation listener for inline "Edit" button clicks.
 */
function setupInlineEditTracker(): void {
	// Avoid duplicate listeners
	if (inlineEditHandler) return

	// Use event delegation for dynamically added inline edit buttons
	inlineEditHandler = (e: Event) => {
		const target = e.target as HTMLElement
		const saveButton = target.closest('.saveButton')

		if (saveButton) {
			const threadInfo = getThreadInfo()

			trackActivity({
				type: 'post',
				action: 'update',
				title: threadInfo.title,
				context: threadInfo.subforum,
				url: threadInfo.url,
			}).catch(() => {})
		}
	}

	document.addEventListener('click', inlineEditHandler)
}

/**
 * Initializes the Post Tracker by arming submit buttons and inline edit triggers.
 * Detects context (new thread, reply, edit) to record accurate statistics.
 */
export function setupPostTracker(): void {
	// Setup inline edit tracker (works via event delegation)
	setupInlineEditTracker()

	// Find submit buttons for forms
	const buttons = SUBMIT_SELECTORS.flatMap(selector =>
		Array.from(document.querySelectorAll<HTMLButtonElement>(selector))
	)

	if (buttons.length === 0) return

	buttons.forEach(button => {
		if (button.hasAttribute('data-mv-tracked')) return
		button.setAttribute('data-mv-tracked', 'true')

		const form = button.closest('form')
		if (!form || formHandlers.has(form)) return

		const submitHandler = () => {
			const isNewThread = isNewThreadPage()
			const isPostPhpEdit = isPostPhpEditPage()
			const buttonText = button.textContent?.trim().toLowerCase() || ''
			const isEditButton = buttonText.includes('editar')

			if (isNewThread) {
				// New thread: get title from input, subforum from page
				const titleInput = document.querySelector<HTMLInputElement>(MV_SELECTORS.EDITOR.TITLE_INPUT)
				const subforum = getSubforumFromNewThread()

				trackActivity({
					type: 'post',
					action: 'create',
					title: titleInput?.value?.trim() || 'Nuevo hilo',
					context: subforum,
				}).catch(() => {})
			} else if (isPostPhpEdit || isEditButton) {
				// Edit from post.php page or edit button
				if (isPostPhpEdit) {
					const info = getEditPageInfo()

					// Fetch real title async, then track
					if (info.needsTitleFetch && info.url) {
						fetchRealThreadTitle(info.url).then(realTitle => {
							trackActivity({
								type: 'post',
								action: 'update',
								title: realTitle || '',
								context: info.subforum || '',
								url: info.url,
							}).catch(() => {})
						})
					} else {
						trackActivity({
							type: 'post',
							action: 'update',
							title: '',
							context: info.subforum || '',
							url: info.url,
						}).catch(() => {})
					}
				} else {
					// Inline edit button - we already have thread info
					const info = getThreadInfo()
					trackActivity({
						type: 'post',
						action: 'update',
						title: info.title || '',
						context: info.subforum || '',
						url: info.url,
					}).catch(() => {})
				}
			} else {
				// Reply: get thread info
				const threadInfo = getThreadInfo()

				trackActivity({
					type: 'post',
					action: 'publish',
					title: threadInfo.title,
					context: threadInfo.subforum,
					url: threadInfo.url,
				}).catch(() => {})
			}
		}

		form.addEventListener('submit', submitHandler)
		formHandlers.set(form, submitHandler)
	})
}

/**
 * Cleans up all event listeners managed by the Post Tracker.
 */
export function cleanupPostTracker(): void {
	// Remove inline edit handler
	if (inlineEditHandler) {
		document.removeEventListener('click', inlineEditHandler)
		inlineEditHandler = null
	}

	// Remove form handlers
	formHandlers.forEach((handler, form) => {
		form.removeEventListener('submit', handler)
	})
	formHandlers.clear()
}
