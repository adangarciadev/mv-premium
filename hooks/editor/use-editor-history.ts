import { useRef, useCallback } from 'react'
import type { HistoryEntry } from '@/types/editor'

const MAX_HISTORY = 50
const DEBOUNCE_MS = 300

interface UseEditorHistoryOptions {
	maxHistory?: number
	getTextarea: () => HTMLTextAreaElement | null
	getValue: () => string
	updateValue: (value: string, cursorPos?: number) => void
}

export function useEditorHistory({
	maxHistory = MAX_HISTORY,
	getTextarea,
	getValue,
	updateValue,
}: UseEditorHistoryOptions) {
	const historyRef = useRef<HistoryEntry[]>([])
	const redoStackRef = useRef<HistoryEntry[]>([])
	const lastPushTimeRef = useRef<number>(0)

	const pushHistory = useCallback(
		(content: string, selectionStart: number, selectionEnd: number) => {
			const now = Date.now()
			const history = historyRef.current

			// Debounce rapid changes (e.g., typing)
			if (now - lastPushTimeRef.current < DEBOUNCE_MS && history.length > 0) {
				// Update the last entry instead of pushing new one
				history[history.length - 1] = {
					content,
					selectionStart,
					selectionEnd,
					timestamp: now,
				}
				return
			}

			// Don't push if identical to last entry
			if (history.length > 0) {
				const last = history[history.length - 1]
				if (last.content === content) return
			}

			// Push new entry
			history.push({
				content,
				selectionStart,
				selectionEnd,
				timestamp: now,
			})

			// Trim if exceeds max
			while (history.length > maxHistory) {
				history.shift()
			}

			// Clear redo stack on new action
			redoStackRef.current = []
			lastPushTimeRef.current = now
		},
		[maxHistory]
	)

	const saveCurrentState = useCallback(() => {
		const textarea = getTextarea()
		if (!textarea) return

		const content = getValue()
		pushHistory(content, textarea.selectionStart, textarea.selectionEnd)
	}, [getTextarea, getValue, pushHistory])

	const undo = useCallback(() => {
		const history = historyRef.current
		if (history.length === 0) return

		const textarea = getTextarea()
		if (!textarea) return

		// Save current state to redo stack
		const currentContent = getValue()
		redoStackRef.current.push({
			content: currentContent,
			selectionStart: textarea.selectionStart,
			selectionEnd: textarea.selectionEnd,
			timestamp: Date.now(),
		})

		// Pop and apply previous state
		const prevState = history.pop()!
		updateValue(prevState.content, prevState.selectionStart)
	}, [getTextarea, getValue, updateValue])

	const redo = useCallback(() => {
		const redoStack = redoStackRef.current
		if (redoStack.length === 0) return

		const textarea = getTextarea()
		if (!textarea) return

		// Save current state to history
		const currentContent = getValue()
		historyRef.current.push({
			content: currentContent,
			selectionStart: textarea.selectionStart,
			selectionEnd: textarea.selectionEnd,
			timestamp: Date.now(),
		})

		// Pop and apply redo state
		const redoState = redoStack.pop()!
		updateValue(redoState.content, redoState.selectionStart)
	}, [getTextarea, getValue, updateValue])

	return {
		pushHistory,
		saveCurrentState,
		undo,
		redo,
		canUndo: historyRef.current.length > 0,
		canRedo: redoStackRef.current.length > 0,
		historyLength: historyRef.current.length,
	}
}
