import { useCallback } from 'react'

const CURSOR_TOKEN = '{{cursor}}'

interface Selection {
	text: string
	start: number
	end: number
}

interface UseEditorSelectionOptions {
	getTextarea: () => HTMLTextAreaElement | null
	getValue: () => string
	updateValue: (value: string, cursorPos?: number) => void
	saveCurrentState: () => void
}

export function useEditorSelection({
	getTextarea,
	getValue,
	updateValue,
	saveCurrentState,
}: UseEditorSelectionOptions) {
	const getSelection = useCallback((): Selection => {
		const textarea = getTextarea()
		if (!textarea) return { text: '', start: 0, end: 0 }

		const content = getValue()
		return {
			text: content.substring(textarea.selectionStart, textarea.selectionEnd),
			start: textarea.selectionStart,
			end: textarea.selectionEnd,
		}
	}, [getTextarea, getValue])

	const insertAtCursor = useCallback(
		(text: string) => {
			const textarea = getTextarea()
			if (!textarea) return

			saveCurrentState()

			const content = getValue()
			const start = textarea.selectionStart
			const end = textarea.selectionEnd

			// Process {{cursor}} token
			const cursorIndex = text.indexOf(CURSOR_TOKEN)
			const processedText = text.replace(CURSOR_TOKEN, '')

			const before = content.substring(0, start)
			const after = content.substring(end)
			const newValue = before + processedText + after

			// Calculate new cursor position
			let newCursorPos: number
			if (cursorIndex !== -1) {
				// Position cursor where {{cursor}} was
				newCursorPos = start + cursorIndex
			} else {
				// Position cursor after inserted text
				newCursorPos = start + processedText.length
			}

			updateValue(newValue, newCursorPos)
		},
		[getTextarea, getValue, saveCurrentState, updateValue]
	)

	const wrapSelection = useCallback(
		(prefix: string, suffix: string) => {
			const textarea = getTextarea()
			if (!textarea) return

			saveCurrentState()

			const content = getValue()
			const start = textarea.selectionStart
			const end = textarea.selectionEnd
			const selectedText = content.substring(start, end)

			const wrapped = `${prefix}${selectedText}${suffix}`
			const before = content.substring(0, start)
			const after = content.substring(end)
			const newValue = before + wrapped + after

			let newCursorPos: number
			if (start === end) {
				// No selection: place cursor between tags
				newCursorPos = start + prefix.length
			} else {
				// Had selection: place cursor after wrapped text
				newCursorPos = start + wrapped.length
			}

			updateValue(newValue, newCursorPos)
		},
		[getTextarea, getValue, saveCurrentState, updateValue]
	)

	const replaceSelection = useCallback(
		(text: string) => {
			const textarea = getTextarea()
			if (!textarea) return

			saveCurrentState()

			const content = getValue()
			const start = textarea.selectionStart
			const end = textarea.selectionEnd

			const before = content.substring(0, start)
			const after = content.substring(end)
			const newValue = before + text + after
			const newCursorPos = start + text.length

			updateValue(newValue, newCursorPos)
		},
		[getTextarea, getValue, saveCurrentState, updateValue]
	)

	return {
		getSelection,
		insertAtCursor,
		wrapSelection,
		replaceSelection,
	}
}
