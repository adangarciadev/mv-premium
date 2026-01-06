// features/editor/components/toolbar/toolbar-handlers.ts
/**
 * Toolbar Event Handlers
 *
 * Centralized handlers for toolbar button actions and text manipulation.
 */

import { MV_SELECTORS, DOM_MARKERS } from '@/constants'
import { findTableAtCursor, parseMarkdownTable } from '@/features/editor/lib/table-utils'
import type { TableInitialData } from '@/features/table-editor/components/table-editor-dialog'

/**
 * State for table editing mode.
 */
export interface TableEditState {
	initialData: TableInitialData
	tableStart: number
	tableEnd: number
}

/**
 * Creates a handler for inserting headers with proper newline handling.
 */
export function createHeaderInsertHandler(textarea: HTMLTextAreaElement) {
	return (prefix: string, suffix?: string) => {
		const start = textarea.selectionStart
		const end = textarea.selectionEnd
		const text = textarea.value
		const selectedText = text.substring(start, end)
		const before = text.substring(0, start)
		const after = text.substring(end)

		// Ensure we're on a new line for block elements
		const needsNewlineBefore = before.length > 0 && !before.endsWith('\n')
		const needsNewlineAfter = after.length > 0 && !after.startsWith('\n')

		const newlineBefore = needsNewlineBefore ? '\n' : ''
		const newlineAfter = needsNewlineAfter ? '\n' : ''

		if (suffix) {
			// Wrap selection with prefix and suffix (e.g., [bar]...[/bar])
			textarea.value = before + newlineBefore + prefix + selectedText + suffix + newlineAfter + after
			const newCursorPos = start + newlineBefore.length + prefix.length + selectedText.length + suffix.length
			textarea.selectionStart = newCursorPos
			textarea.selectionEnd = newCursorPos
		} else {
			// Just prefix (e.g., # for headers)
			textarea.value = before + newlineBefore + prefix + selectedText + newlineAfter + after
			const newCursorPos = start + newlineBefore.length + prefix.length + selectedText.length
			textarea.selectionStart = newCursorPos
			textarea.selectionEnd = newCursorPos
		}

		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		textarea.focus()
	}
}

/**
 * Creates a handler for inserting polls with proper newline handling.
 */
export function createPollInsertHandler(textarea: HTMLTextAreaElement) {
	return (bbcode: string) => {
		const start = textarea.selectionStart
		const text = textarea.value
		const before = text.substring(0, start)
		const after = text.substring(start)
		const prefix = before.length > 0 && !before.endsWith('\n') ? '\n\n' : ''
		const suffix = after.length > 0 && !after.startsWith('\n') ? '\n\n' : '\n'
		textarea.value = before + prefix + bbcode + suffix + after
		const newPosition = start + prefix.length + bbcode.length + suffix.length
		textarea.selectionStart = newPosition
		textarea.selectionEnd = newPosition
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		textarea.focus()
	}
}

/**
 * Checks if cursor is inside a table and returns table info.
 */
export function getTableAtCursor(textarea: HTMLTextAreaElement): {
	isAtCursor: boolean
	editData: TableEditState | null
} {
	const text = textarea.value
	const cursorPos = textarea.selectionStart
	const tableInfo = findTableAtCursor(text, cursorPos)

	if (!tableInfo) {
		return { isAtCursor: false, editData: null }
	}

	const tableText = text.substring(tableInfo.startIndex, tableInfo.endIndex)
	const parsed = parseMarkdownTable(tableText)

	if (!parsed) {
		return { isAtCursor: true, editData: null }
	}

	return {
		isAtCursor: true,
		editData: {
			initialData: parsed,
			tableStart: tableInfo.startIndex,
			tableEnd: tableInfo.endIndex,
		},
	}
}

/**
 * Creates a handler for inserting/replacing tables.
 */
export function createTableInsertHandler(
	textarea: HTMLTextAreaElement,
	tableEditData: TableEditState | null,
	onComplete: () => void
) {
	return (markdown: string) => {
		if (tableEditData) {
			const text = textarea.value
			const before = text.substring(0, tableEditData.tableStart)
			const after = text.substring(tableEditData.tableEnd)
			textarea.value = before + markdown + after
			const newPosition = tableEditData.tableStart + markdown.length
			textarea.selectionStart = newPosition
			textarea.selectionEnd = newPosition
		} else {
			const start = textarea.selectionStart
			const text = textarea.value
			const before = text.substring(0, start)
			const after = text.substring(start)
			const prefix = before.length > 0 && !before.endsWith('\n') ? '\n\n' : before.length > 0 ? '\n' : ''
			const suffix = after.length > 0 && !after.startsWith('\n') ? '\n\n' : '\n'
			textarea.value = before + prefix + markdown + suffix + after
			const newPosition = start + prefix.length + markdown.length + suffix.length
			textarea.selectionStart = newPosition
			textarea.selectionEnd = newPosition
		}
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		textarea.focus()
		onComplete()
	}
}

/**
 * Creates a handler for inserting templates with title/category autofill.
 */
export function createTemplateInsertHandler(insertText: (text: string) => void, isNewThread: boolean) {
	return (content: string, title?: string, category?: string) => {
		// Insert the content
		insertText(content)

		// Fill title if provided and on nuevo-hilo page
		if (title && isNewThread) {
			const titleInput = document.querySelector<HTMLInputElement>(MV_SELECTORS.EDITOR.TITLE_INPUT)
			if (titleInput) {
				titleInput.value = title
				titleInput.dispatchEvent(new Event('input', { bubbles: true }))
			}
		}

		// Fill category if provided and on nuevo-hilo page
		if (category && isNewThread) {
			const categorySelect = document.querySelector<HTMLSelectElement>(MV_SELECTORS.EDITOR.CATEGORY_SELECT)
			if (categorySelect) {
				categorySelect.value = category
				categorySelect.dispatchEvent(new Event('change', { bubbles: true }))
			}
		}
	}
}

/**
 * Dispatches custom event to open drafts sidebar.
 */
export function openDraftsSidebar(textarea: HTMLTextAreaElement): void {
	textarea.dispatchEvent(new CustomEvent(DOM_MARKERS.EVENTS.OPEN_DRAFTS, { bubbles: true }))
}

/**
 * Checks if current page is a new thread page.
 */
export function isNewThreadPage(): boolean {
	const isNewThreadPath = /^\/foro\/[^\/]+\/nuevo-hilo/.test(window.location.pathname)
	const isEditingFirstPost =
		window.location.pathname === '/foro/post.php' && new URLSearchParams(window.location.search).get('num') === '1'
	return isNewThreadPath || isEditingFirstPost
}
