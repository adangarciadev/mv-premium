/**
 * Centralized beforeunload manager for drafts
 *
 * Instead of each DraftManager adding its own beforeunload listener,
 * we have a single global listener that checks all registered dirty checkers.
 * This is more efficient and avoids potential listener accumulation.
 * 
 * IMPORTANT: Auto-saves drafts on beforeunload to prevent data loss from
 * accidental exits, power outages, etc.
 */

type DirtyChecker = () => { isDirty: boolean; content: string; save?: (content: string) => void } | null

// Registry of dirty state checkers by textarea ID
const dirtyCheckers = new Map<string, DirtyChecker>()

// Track if global listener is initialized
let listenerInitialized = false

/**
 * Initializes the global beforeunload event listener.
 * Auto-saves and prevents navigation if any registered textarea has unsaved changes.
 */
function initBeforeUnloadListener(): void {
	if (listenerInitialized) return
	listenerInitialized = true

	window.addEventListener('beforeunload', (e: BeforeUnloadEvent) => {
		// Check all registered dirty checkers
		for (const [, checker] of dirtyCheckers) {
			const result = checker()
			if (result?.isDirty) {
				// AUTO-SAVE on navigation to prevent data loss
				// The save function persists the draft before the page unloads
				if (result.save) {
					result.save(result.content)
				}

				// Show browser's default confirmation dialog
				// Note: Custom messages are ignored by modern browsers for security reasons
				e.preventDefault()
				return
			}
		}
	})
}

/**
 * Detects or generates a unique identifier for a textarea element.
 */
function getTextareaId(textarea: HTMLTextAreaElement): string {
	// Use existing id or generate one based on position
	if (textarea.id) return `textarea-${textarea.id}`

	// Fallback: use form id + name or index
	const form = textarea.form
	if (form?.id) {
		return `textarea-form-${form.id}-${textarea.name || 'main'}`
	}

	// Last resort: use DOM path
	return `textarea-${Array.from(document.querySelectorAll('textarea')).indexOf(textarea)}`
}

/**
 * Registers a dirty state checker for a specific textarea.
 * @param textarea - The HTML textarea to monitor
 * @param checker - Function that returns boolean dirty state
 * @returns Cleanup function to unregister the checker
 */
export function registerDirtyChecker(textarea: HTMLTextAreaElement, checker: DirtyChecker): () => void {
	// Ensure global listener is set up
	initBeforeUnloadListener()

	const id = getTextareaId(textarea)
	dirtyCheckers.set(id, checker)

	return () => {
		dirtyCheckers.delete(id)
	}
}

/**
 * Iterates through all registered checkers to verify if any textarea has unsaved changes.
 * @returns True if at least one textarea is dirty
 */
export function hasAnyUnsavedChanges(): boolean {
	for (const [, checker] of dirtyCheckers) {
		const result = checker()
		if (result?.isDirty) return true
	}
	return false
}
