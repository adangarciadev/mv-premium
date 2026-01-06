/**
 * useSlashCommand Hook
 *
 * Manages slash command state for template insertion.
 * Handles detection, matching, and insertion logic.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import {
	detectSlashCommand,
	findMatchingTemplates,
	replaceSlashCommand,
	type SlashCommandState,
	type TemplateMatch,
} from '../logic/slash-command-handler'
import { getTemplates, onDraftsChanged, type Draft } from '../storage'

export interface TemplateInsertData {
	newValue: string
	cursorPos: number
	title?: string
	subforum?: string
	category?: string
}

export interface UseSlashCommandOptions {
	/** Reference to the textarea element */
	textareaRef: React.RefObject<HTMLTextAreaElement | null>
	/** Current text value (for controlled mode) */
	value?: string
	/** Called when template is inserted */
	onInsert?: (data: TemplateInsertData) => void
}

export interface UseSlashCommandReturn {
	/** Current slash command state (null if not active) */
	state: SlashCommandState | null
	/** Close the slash command popover */
	close: () => void
	/** Select a template to insert */
	selectTemplate: (template: TemplateMatch) => void
	/** Update selected index (for keyboard nav) */
	setSelectedIndex: (index: number) => void
	/** Check for slash command at current cursor position */
	checkForCommand: () => void
}

export function useSlashCommand(options: UseSlashCommandOptions): UseSlashCommandReturn {
	const { textareaRef, value, onInsert } = options

	const [state, setState] = useState<SlashCommandState | null>(null)
	const [templates, setTemplates] = useState<Draft[]>([])
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	// Track dismissed query to prevent immediate reopening after Escape
	const dismissedQueryRef = useRef<string | null>(null)

	// Load templates on mount AND watch for storage changes
	useEffect(() => {
		// Initial load
		getTemplates().then(setTemplates)

		// Watch for changes (e.g., when a new template is created)
		const unwatch = onDraftsChanged(() => {
			getTemplates().then(setTemplates)
		})

		return unwatch
	}, [])

	// Close popover and remember the dismissed query
	const close = useCallback(() => {
		// Remember the current query so we don't immediately reopen
		if (state?.query !== undefined) {
			dismissedQueryRef.current = state.query
		}
		setState(null)
	}, [state?.query])

	// Update selected index
	const setSelectedIndex = useCallback((index: number) => {
		setState(prev => (prev ? { ...prev, selectedIndex: index } : null))
	}, [])

	// Insert selected template
	const selectTemplate = useCallback(
		(template: TemplateMatch) => {
			const textarea = textareaRef.current
			if (!textarea || !state) return

			const currentText = value !== undefined ? value : textarea.value
			const { newText, newCursorPos } = replaceSlashCommand(currentText, state, template.content)

			if (onInsert) {
				// Controlled mode - pass full template data
				onInsert({
					newValue: newText,
					cursorPos: newCursorPos,
					title: template.title,
					subforum: template.subforum,
					category: template.category,
				})
			} else {
				// Uncontrolled mode - direct DOM manipulation
				textarea.value = newText
				textarea.selectionStart = newCursorPos
				textarea.selectionEnd = newCursorPos
				textarea.dispatchEvent(new Event('input', { bubbles: true }))
				textarea.dispatchEvent(new Event('change', { bubbles: true }))
			}

			textarea.focus()
			close()
		},
		[textareaRef, value, state, onInsert, close]
	)

	// Check for slash command at current cursor
	const checkForCommand = useCallback(() => {
		// Debounce to avoid excessive checks
		if (debounceRef.current) {
			clearTimeout(debounceRef.current)
		}

		debounceRef.current = setTimeout(() => {
			const textarea = textareaRef.current
			if (!textarea) {
				setState(null)
				return
			}

			const currentText = value !== undefined ? value : textarea.value
			const cursorPos = textarea.selectionStart

			const detected = detectSlashCommand(currentText, cursorPos)

			if (detected) {
				// Check if this query was just dismissed (user pressed Escape)
				// Only skip if the query is exactly the same
				if (dismissedQueryRef.current !== null && detected.query === dismissedQueryRef.current) {
					// Still dismissed, don't reopen
					return
				}

				// Query changed, clear dismissed state
				if (dismissedQueryRef.current !== null && detected.query !== dismissedQueryRef.current) {
					dismissedQueryRef.current = null
				}

				// Find matching templates
				const matches = findMatchingTemplates(detected.query, templates)

				setState(prev => {
					// Preserve selectedIndex if popover was already open
					// Only reset to 0 when first opening or matches changed significantly
					const prevMatchIds = prev?.matches.map(m => m.id).join(',') ?? ''
					const newMatchIds = matches.map(m => m.id).join(',')
					const matchesChanged = prevMatchIds !== newMatchIds

					// If matches changed, reset to 0, otherwise keep current index (clamped to valid range)
					const prevIndex = prev?.selectedIndex ?? 0
					const newIndex = matchesChanged ? 0 : Math.min(prevIndex, matches.length - 1)

					return {
						...detected,
						matches,
						selectedIndex: Math.max(0, newIndex),
					}
				})
			} else {
				// No slash command detected, clear dismissed state
				dismissedQueryRef.current = null
				setState(null)
			}
		}, 50) // Small debounce for responsiveness
	}, [textareaRef, value, templates])

	// Cleanup debounce on unmount
	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current)
			}
		}
	}, [])

	return {
		state,
		close,
		selectTemplate,
		setSelectedIndex,
		checkForCommand,
	}
}
