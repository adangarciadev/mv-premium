import { useEffect } from 'react'
import type { KeyboardShortcut } from '@/types/editor'

interface UseEditorShortcutsOptions {
	shortcuts?: boolean | KeyboardShortcut[]
	getTextarea: () => HTMLTextAreaElement | null
	getValue: () => string
	updateValue: (value: string, cursorPos?: number) => void
	saveCurrentState: () => void
	executeAction: (buttonId: string) => void
}

export function useEditorShortcuts({
	shortcuts = true,
	getTextarea,
	getValue,
	updateValue,
	saveCurrentState,
	executeAction,
}: UseEditorShortcutsOptions) {
	useEffect(() => {
		const textarea = getTextarea()
		if (!textarea) return

		const shortcutMap =
			shortcuts === true
				? [
						{ key: 'Ctrl+B', buttonId: 'bold' },
						{ key: 'Ctrl+I', buttonId: 'italic' },
						{ key: 'Ctrl+U', buttonId: 'underline' },
						{ key: 'Ctrl+K', buttonId: 'link' },
						{ key: 'Ctrl+Z', buttonId: 'undo' },
						{ key: 'Ctrl+Y', buttonId: 'redo' },
						{ key: 'Ctrl+Shift+Z', buttonId: 'redo' },
				  ]
				: Array.isArray(shortcuts)
				? shortcuts
				: []

		const handleKeyDown = (e: KeyboardEvent) => {
			// ========================================================================
			// 1. SMART LISTS (Auto-continuation)
			// ========================================================================
			if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
				const cursorPos = textarea.selectionStart
				const currentVal = getValue()

				// Get the current line up to the cursor
				const textBeforeCursor = currentVal.substring(0, cursorPos)
				const lastNewLine = textBeforeCursor.lastIndexOf('\n')
				const lineStart = lastNewLine + 1
				const currentLine = textBeforeCursor.substring(lineStart)

				// Helper to apply changes while saving history
				const applyListChange = (newValue: string, newCursor: number) => {
					e.preventDefault()
					e.stopPropagation()
					saveCurrentState() // IMPORTANT: Save state before modifying
					updateValue(newValue, newCursor)
				}

				// A. Unordered List (* text)
				const unorderedMatch = currentLine.match(/^(\* )(.*)/)
				if (unorderedMatch) {
					// If the line is empty (* ), delete the bullet (exit list)
					if (unorderedMatch[2].trim() === '') {
						const newValue = currentVal.substring(0, lineStart) + currentVal.substring(cursorPos)
						applyListChange(newValue, lineStart)
						return
					}
					// If it has text, create new bullet
					const insertion = '\n* '
					const newValue = currentVal.substring(0, cursorPos) + insertion + currentVal.substring(cursorPos)
					applyListChange(newValue, cursorPos + insertion.length)
					return
				}

				// B. Task List (- [ ] text)
				const taskMatch = currentLine.match(/^(- \[[ x]\] )(.*)/)
				if (taskMatch) {
					if (taskMatch[2].trim() === '') {
						// Delete empty bullet
						const newValue = currentVal.substring(0, lineStart) + currentVal.substring(cursorPos)
						applyListChange(newValue, lineStart)
						return
					}
					// New empty task
					const insertion = '\n- [ ] '
					const newValue = currentVal.substring(0, cursorPos) + insertion + currentVal.substring(cursorPos)
					applyListChange(newValue, cursorPos + insertion.length)
					return
				}

				// C. Ordered List (1. text)
				const orderedMatch = currentLine.match(/^(\d+)\. (.*)/)
				if (orderedMatch) {
					if (orderedMatch[2].trim() === '') {
						// Delete empty number
						const newValue = currentVal.substring(0, lineStart) + currentVal.substring(cursorPos)
						applyListChange(newValue, lineStart)
						return
					}
					// Increment number
					const currentNum = parseInt(orderedMatch[1], 10)
					const insertion = `\n${currentNum + 1}. `
					const newValue = currentVal.substring(0, cursorPos) + insertion + currentVal.substring(cursorPos)
					applyListChange(newValue, cursorPos + insertion.length)
					return
				}
			}

			// ========================================================================
			// 2. SHORTCUTS
			// ========================================================================
			if (!shortcuts) return

			// Build key string
			const parts: string[] = []
			if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
			if (e.shiftKey) parts.push('Shift')
			if (e.altKey) parts.push('Alt')

			// Normalize key
			let key = e.key.toUpperCase()
			if (key === ' ') key = 'Space'
			if (key.length === 1) parts.push(key)
			else if (key.startsWith('ARROW')) parts.push(key.replace('ARROW', ''))
			else parts.push(key)

			const keyCombo = parts.join('+')

			// Find matching shortcut
			const shortcut = shortcutMap.find(s => {
				const normalized = s.key.toUpperCase().replace(/\s/g, '')
				return normalized === keyCombo.replace(/\s/g, '')
			})

			if (shortcut) {
				e.preventDefault()
				e.stopPropagation()
				executeAction(shortcut.buttonId)
			}
		}

		textarea.addEventListener('keydown', handleKeyDown)
		return () => textarea.removeEventListener('keydown', handleKeyDown)
	}, [shortcuts, getTextarea, getValue, executeAction, saveCurrentState, updateValue])
}
