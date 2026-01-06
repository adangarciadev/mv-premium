/**
 * Editor Content Preservation
 *
 * Preserves textarea content when switching from quick reply to extended editor.
 * Uses @wxt-dev/storage for proper persistence across page navigations.
 */

import { MV_SELECTORS, DOM_MARKERS } from '@/constants'
import { logger } from '@/lib/logger'
import { editorPreserveStorage, MAX_RESTORE_AGE_MS, type EditorPreservedContent } from '@/features/editor/storage'
import { isAlreadyInjected, markAsInjected } from '@/lib/content-modules/utils/react-helpers'

const PRESERVE_MARKER = DOM_MARKERS.DATA_ATTRS.PRESERVE

/**
 * Persists the current textarea content to short-term storage.
 * Used for preserving content when navigating from quick reply to extended editor.
 * @param content - The text to preserve
 */
async function saveEditorContent(content: string): Promise<void> {
	if (content.trim()) {
		// Save to editor preserve storage (for immediate restore on next page)
		const data: EditorPreservedContent = {
			content,
			timestamp: Date.now(),
		}
		await editorPreserveStorage.setValue(data)
	}
}

/**
 * Attempts to restore previously saved content into target textarea element
 * Implements a retry mechanism to overcome race conditions with native page scripts.
 * @param textarea - The element to populate
 */
async function restoreEditorContent(textarea: HTMLTextAreaElement): Promise<void> {
	try {
		const stored = await editorPreserveStorage.getValue()

		if (!stored?.content || !stored?.timestamp) return

		// Check if content was saved recently
		const age = Date.now() - stored.timestamp
		if (age > MAX_RESTORE_AGE_MS) {
			await editorPreserveStorage.removeValue()
			return
		}

		// Helper to apply the content
		const applyContent = () => {
			if (!textarea.value.trim()) {
				textarea.value = stored.content
				textarea.dispatchEvent(new Event('input', { bubbles: true }))
				textarea.dispatchEvent(new Event('change', { bubbles: true }))
				return true
			}
			return false
		}

		// Try to restore immediately
		applyContent()

		// Also try again after a few intervals to beat native scripts that might clear it
		// (Common in Mediavida when the full editor initializes)
		let attempts = 0
		const interval = setInterval(() => {
			attempts++
			const success = applyContent()
			if (success || attempts > 10) {
				clearInterval(interval)
				// Only clear storage once we've successfully restored or given up
				void editorPreserveStorage.removeValue()
			}
		}, 200)
	} catch (err) {
		logger.error('Error restoring editor content:', err)
	}
}

/**
 * Discovers editor textareas and attaches preservation listeners to relevant navigation triggers.
 */
export function injectEditorContentPreservation(): void {
	// Find quick reply textareas
	const textareas = document.querySelectorAll<HTMLTextAreaElement>(
		'.editor-body textarea, textarea#cuerpo, textarea[name="cuerpo"]'
	)

	textareas.forEach(textarea => {
		if (isAlreadyInjected(textarea, PRESERVE_MARKER)) return
		markAsInjected(textarea, PRESERVE_MARKER)

		// Try to restore content on page load
		void restoreEditorContent(textarea)

		// Find the parent form or editor container
		const editorContainer = textarea.closest('.editor-body') || textarea.closest('form')
		if (!editorContainer) return

		// Look for "Editor Extendido" link within the control area
		const controlArea = editorContainer.closest('.control') || editorContainer.parentElement

		if (controlArea) {
			// Use event delegation to catch clicks on editor-related links
			controlArea.addEventListener('click', e => {
				const target = e.target as HTMLElement
				const link = target.closest('a[href*="responder"], a[href*="nuevo"]') as HTMLAnchorElement

				if (link && textarea.value.trim()) {
					// Save content before navigation
					void saveEditorContent(textarea.value)
				}
			})
		}
	})

	// Also handle links in editor-reply div (the header bar of quick reply)
	const editorReplyLinks = document.querySelectorAll<HTMLAnchorElement>('.editor-reply a[href]')
	editorReplyLinks.forEach(link => {
		if (isAlreadyInjected(link, PRESERVE_MARKER)) return
		markAsInjected(link, PRESERVE_MARKER)

		link.addEventListener('click', () => {
			// Find the associated textarea in the same .control container
			const control = link.closest('.control')
			if (control) {
				const textarea = control.querySelector<HTMLTextAreaElement>('textarea')
				if (textarea && textarea.value.trim()) {
					void saveEditorContent(textarea.value)
				}
			}
		})
	})

	// Special case: Look for "Escribir respuesta" or similar links
	const formBox = document.getElementById(MV_SELECTORS.EDITOR.FORMBOX_ID)
	if (formBox) {
		const expandLink = formBox.querySelector<HTMLAnchorElement>('a[href*="responder"]')
		if (expandLink && !isAlreadyInjected(expandLink, PRESERVE_MARKER)) {
			markAsInjected(expandLink, PRESERVE_MARKER)

			expandLink.addEventListener('click', () => {
				const textarea = formBox.querySelector<HTMLTextAreaElement>('textarea')
				if (textarea && textarea.value.trim()) {
					void saveEditorContent(textarea.value)
				}
			})
		}
	}
}
