import { useEffect } from 'react'

/**
 * useListFormatting hook - Logic for list creation and auto-continuation.
 * Handles BBCode list syntax (* for unordered, 1. for ordered, - [ ] for tasks).
 * Includes an event listener for the 'Enter' key to provide a modern editing experience.
 */
export function useListFormatting(textarea: HTMLTextAreaElement) {
	/**
	 * Injects or wraps selection with unordered list markers (*).
	 */
	const insertUnorderedList = () => {
		const start = textarea.selectionStart
		const end = textarea.selectionEnd
		const text = textarea.value
		const selectedText = text.substring(start, end)

		if (selectedText) {
			const lines = selectedText.split('\n')
			const listItems = lines.map(line => `* ${line}`).join('\n')
			const prefix = start > 0 && text[start - 1] !== '\n' ? '\n' : ''
			const suffix = end < text.length && text[end] !== '\n' ? '\n' : ''

			textarea.value = text.substring(0, start) + prefix + listItems + suffix + text.substring(end)

			const newCursorPos = start + prefix.length + listItems.length
			textarea.selectionStart = newCursorPos
			textarea.selectionEnd = newCursorPos
		} else {
			const prefix = start > 0 && text[start - 1] !== '\n' ? '\n' : ''
			const listItem = prefix + '* '

			textarea.value = text.substring(0, start) + listItem + text.substring(end)

			const newCursorPos = start + listItem.length
			textarea.selectionStart = newCursorPos
			textarea.selectionEnd = newCursorPos
		}

		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		textarea.dispatchEvent(new Event('change', { bubbles: true }))
		textarea.focus()
	}

	/**
	 * Injects or wraps selection with ordered list markers (1., 2., etc.).
	 */
	const insertOrderedList = () => {
		const start = textarea.selectionStart
		const end = textarea.selectionEnd
		const text = textarea.value
		const selectedText = text.substring(start, end)

		if (selectedText) {
			const lines = selectedText.split('\n')
			const listItems = lines.map((line, i) => `${i + 1}. ${line}`).join('\n')
			const prefix = start > 0 && text[start - 1] !== '\n' ? '\n' : ''
			const suffix = end < text.length && text[end] !== '\n' ? '\n' : ''

			textarea.value = text.substring(0, start) + prefix + listItems + suffix + text.substring(end)

			const newCursorPos = start + prefix.length + listItems.length
			textarea.selectionStart = newCursorPos
			textarea.selectionEnd = newCursorPos
		} else {
			const prefix = start > 0 && text[start - 1] !== '\n' ? '\n' : ''
			const listItem = prefix + '1. '

			textarea.value = text.substring(0, start) + listItem + text.substring(end)

			const newCursorPos = start + listItem.length
			textarea.selectionStart = newCursorPos
			textarea.selectionEnd = newCursorPos
		}

		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		textarea.dispatchEvent(new Event('change', { bubbles: true }))
		textarea.focus()
	}

	/**
	 * Injects or wraps selection with task list markers (- [ ] or - [x]).
	 * @param checked - Whether the task should be marked as completed
	 */
	const insertTaskList = (checked: boolean) => {
		const start = textarea.selectionStart
		const end = textarea.selectionEnd
		const text = textarea.value
		const selectedText = text.substring(start, end)
		const checkbox = checked ? '[x]' : '[ ]'

		if (selectedText) {
			const lines = selectedText.split('\n')
			const listItems = lines.map(line => `- ${checkbox} ${line}`).join('\n')
			const prefix = start > 0 && text[start - 1] !== '\n' ? '\n' : ''
			const suffix = end < text.length && text[end] !== '\n' ? '\n' : ''

			textarea.value = text.substring(0, start) + prefix + listItems + suffix + text.substring(end)

			const newCursorPos = start + prefix.length + listItems.length
			textarea.selectionStart = newCursorPos
			textarea.selectionEnd = newCursorPos
		} else {
			const prefix = start > 0 && text[start - 1] !== '\n' ? '\n' : ''
			const listItem = prefix + `- ${checkbox} `

			textarea.value = text.substring(0, start) + listItem + text.substring(end)

			const newCursorPos = start + listItem.length
			textarea.selectionStart = newCursorPos
			textarea.selectionEnd = newCursorPos
		}

		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		textarea.dispatchEvent(new Event('change', { bubbles: true }))
		textarea.focus()
	}

	// Auto-continue lists on Enter key
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key !== 'Enter' || e.shiftKey) return

			const cursorPos = textarea.selectionStart
			const text = textarea.value
			const textBeforeCursor = text.substring(0, cursorPos)
			const lastNewLine = textBeforeCursor.lastIndexOf('\n')
			const currentLine = textBeforeCursor.substring(lastNewLine + 1)

			// Check for unordered list (* )
			const unorderedMatch = currentLine.match(/^(\* )(.*)$/)
			if (unorderedMatch) {
				if (unorderedMatch[2].trim() === '') {
					e.preventDefault()
					const lineStart = lastNewLine + 1
					textarea.value = text.substring(0, lineStart) + text.substring(cursorPos)
					textarea.selectionStart = textarea.selectionEnd = lineStart
					textarea.dispatchEvent(new Event('input', { bubbles: true }))
					return
				}
				e.preventDefault()
				const insertion = '\n* '
				textarea.value = text.substring(0, cursorPos) + insertion + text.substring(cursorPos)
				textarea.selectionStart = textarea.selectionEnd = cursorPos + insertion.length
				textarea.dispatchEvent(new Event('input', { bubbles: true }))
				return
			}

			// Check for task list (- [ ] or - [x])
			const taskMatch = currentLine.match(/^(- \[([ x])\] )(.*)$/)
			if (taskMatch) {
				if (taskMatch[3].trim() === '') {
					e.preventDefault()
					const lineStart = lastNewLine + 1
					textarea.value = text.substring(0, lineStart) + text.substring(cursorPos)
					textarea.selectionStart = textarea.selectionEnd = lineStart
					textarea.dispatchEvent(new Event('input', { bubbles: true }))
					return
				}
				e.preventDefault()
				const insertion = '\n- [ ] '
				textarea.value = text.substring(0, cursorPos) + insertion + text.substring(cursorPos)
				textarea.selectionStart = textarea.selectionEnd = cursorPos + insertion.length
				textarea.dispatchEvent(new Event('input', { bubbles: true }))
				return
			}

			// Check for ordered list (1.)
			const orderedMatch = currentLine.match(/^(\d+)\. (.*)$/)
			if (orderedMatch) {
				const currentNum = parseInt(orderedMatch[1], 10)
				const content = orderedMatch[2]

				if (content.trim() === '') {
					e.preventDefault()
					const lineStart = lastNewLine + 1
					textarea.value = text.substring(0, lineStart) + text.substring(cursorPos)
					textarea.selectionStart = textarea.selectionEnd = lineStart
					textarea.dispatchEvent(new Event('input', { bubbles: true }))
					return
				}
				e.preventDefault()
				const nextNum = currentNum + 1
				const insertion = `\n${nextNum}. `
				textarea.value = text.substring(0, cursorPos) + insertion + text.substring(cursorPos)
				textarea.selectionStart = textarea.selectionEnd = cursorPos + insertion.length
				textarea.dispatchEvent(new Event('input', { bubbles: true }))
			}
		}

		textarea.addEventListener('keydown', handleKeyDown)
		return () => textarea.removeEventListener('keydown', handleKeyDown)
	}, [textarea])

	return {
		insertUnorderedList,
		insertOrderedList,
		insertTaskList,
	}
}
