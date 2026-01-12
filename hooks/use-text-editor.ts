/**
 * useTextEditor - Core Text Editor Hook
 *
 * The "brain" of the editor system. Provides text manipulation,
 * undo/redo history, and keyboard shortcuts.
 *
 * Supports two modes:
 * - Controlled: Works with React state (value + onChange)
 * - Ref: Works with HTMLTextAreaElement ref (for content scripts)
 */
import { useRef, useCallback, useEffect } from 'react'
import type { ToolbarButtonConfig, KeyboardShortcut } from '@/types/editor'

import { useEditorHistory } from './editor/use-editor-history'
import { useEditorSelection } from './editor/use-editor-selection'
import { useEditorShortcuts } from './editor/use-editor-shortcuts'

// ============================================================================
// Types
// ============================================================================

interface Selection {
	text: string
	start: number
	end: number
}

interface UseTextEditorOptions {
	/** Controlled mode: current value */
	value?: string
	/** Controlled mode: change handler */
	onChange?: (value: string) => void
	/** Ref mode: direct textarea reference */
	textareaRef?: React.RefObject<HTMLTextAreaElement | null>
	/** Enable keyboard shortcuts */
	shortcuts?: boolean | KeyboardShortcut[]
	/** Toolbar buttons for shortcut mapping */
	buttons?: ToolbarButtonConfig[]
	/** Maximum history entries */
	maxHistory?: number
	/** Callback when action is triggered (for dialog handling) */
	onAction?: (actionId: string) => void
}

interface UseTextEditorReturn {
	/** Insert text at cursor, processes {{cursor}} token */
	insertAtCursor: (text: string) => void
	/** Wrap selected text with prefix/suffix */
	wrapSelection: (prefix: string, suffix: string) => void
	/** Get current selection */
	getSelection: () => Selection
	/** Replace current selection with text */
	replaceSelection: (text: string) => void
	/** Undo last change */
	undo: () => void
	/** Redo last undone change */
	redo: () => void
	/** Check if undo is available */
	canUndo: boolean
	/** Check if redo is available */
	canRedo: boolean
	/** Execute a toolbar button action by ID */
	executeAction: (buttonId: string) => void
	/** Register the textarea (for controlled mode) */
	registerTextarea: (el: HTMLTextAreaElement | null) => void
	/** History stack for debugging */
	historyLength: number
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useTextEditor(options: UseTextEditorOptions = {}): UseTextEditorReturn {
	const { value, onChange, textareaRef: externalRef, shortcuts = true, buttons = [], maxHistory, onAction } = options

	// Internal ref for controlled mode
	const internalRef = useRef<HTMLTextAreaElement | null>(null)

	// Track if we're in a programmatic update (to avoid double history push)
	const isProgrammaticRef = useRef(false)

	// Get the active textarea
	const getTextarea = useCallback((): HTMLTextAreaElement | null => {
		return externalRef?.current ?? internalRef.current
	}, [externalRef])

	// Helper to get current value reliably
	// ALWAYS read from DOM to avoid race conditions during rapid sequential insertions
	// React state may be stale when multiple async operations update content quickly
	const getValue = useCallback((): string => {
		const textarea = getTextarea()
		// Prefer textarea DOM value over React state for accurate real-time value
		return textarea ? textarea.value : (value ?? '')
	}, [getTextarea, value])

	// ──────────────────────────────────────────────────────────────────────────
	// Core Update Logic
	// ──────────────────────────────────────────────────────────────────────────

	const updateValue = useCallback(
		(newValue: string, cursorPos?: number) => {
			const textarea = getTextarea()
			if (!textarea) return

			isProgrammaticRef.current = true

			// Preserve scroll position before any DOM changes
			const scrollTop = textarea.scrollTop

			// ALWAYS sync textarea DOM immediately (regardless of mode)
			// This prevents race conditions when multiple insertions happen in rapid succession
			textarea.value = newValue
			if (cursorPos !== undefined) {
				textarea.selectionStart = cursorPos
				textarea.selectionEnd = cursorPos
			}
			// Restore scroll position immediately
			textarea.scrollTop = scrollTop

			if (onChange) {
				// Controlled mode: also notify React state
				onChange(newValue)
				// Schedule focus and restore position after React update
				// React may override our changes when it re-renders the textarea
				requestAnimationFrame(() => {
					if (textarea && cursorPos !== undefined) {
						textarea.selectionStart = cursorPos
						textarea.selectionEnd = cursorPos
						textarea.scrollTop = scrollTop
					}
					textarea?.focus()
					isProgrammaticRef.current = false
				})
			} else {
				// Ref mode - dispatch events for any listeners
				textarea.dispatchEvent(new Event('input', { bubbles: true }))
				textarea.dispatchEvent(new Event('change', { bubbles: true }))
				textarea.focus()
				isProgrammaticRef.current = false
			}
		},
		[getTextarea, onChange]
	)

	// ──────────────────────────────────────────────────────────────────────────
	// Sub-Hooks Composition
	// ──────────────────────────────────────────────────────────────────────────

	// 1. History Management
	const { pushHistory, saveCurrentState, undo, redo, canUndo, canRedo, historyLength } = useEditorHistory({
		maxHistory,
		getTextarea,
		getValue,
		updateValue,
	})

	// 2. Selection & Text Manipulation
	const { insertAtCursor, wrapSelection, replaceSelection, getSelection } = useEditorSelection({
		getTextarea,
		getValue,
		updateValue,
		saveCurrentState,
	})

	// 3. Action Execution
	const executeAction = useCallback(
		(buttonId: string) => {
			// Handle built-in undo/redo actions FIRST (before checking buttons array)
			// This ensures they work even if defined in buttons with empty handlers
			if (buttonId === 'undo') {
				undo()
				return
			}
			if (buttonId === 'redo') {
				redo()
				return
			}

			const button = buttons.find(b => b.id === buttonId)
			if (!button) {
				return
			}

			const { action } = button

			switch (action.type) {
				case 'wrap':
					wrapSelection(action.prefix, action.suffix)
					break
				case 'insert':
					insertAtCursor(action.template)
					break
				case 'dialog':
					// Delegate to parent via callback
					onAction?.(action.dialogId)
					break
				case 'custom':
					action.handler()
					break
			}
		},
		[buttons, wrapSelection, insertAtCursor, undo, redo, onAction]
	)

	// 4. Keyboard Shortcuts & Smart Lists
	useEditorShortcuts({
		shortcuts,
		getTextarea,
		getValue,
		updateValue,
		saveCurrentState,
		executeAction,
	})

	// ──────────────────────────────────────────────────────────────────────────
	// Track external changes for history
	// ──────────────────────────────────────────────────────────────────────────

	useEffect(() => {
		const textarea = getTextarea()
		if (!textarea) return

		const handleInput = () => {
			// Don't push history for programmatic changes (already handled)
			if (isProgrammaticRef.current) return

			// Push history for user typing
			const content = textarea.value
			pushHistory(content, textarea.selectionStart, textarea.selectionEnd)
		}

		textarea.addEventListener('input', handleInput)
		return () => textarea.removeEventListener('input', handleInput)
	}, [getTextarea, pushHistory])

	// ──────────────────────────────────────────────────────────────────────────
	// Register textarea callback (for controlled mode)
	// ──────────────────────────────────────────────────────────────────────────

	const registerTextarea = useCallback((el: HTMLTextAreaElement | null) => {
		internalRef.current = el
	}, [])

	return {
		insertAtCursor,
		wrapSelection,
		getSelection,
		replaceSelection,
		undo,
		redo,
		canUndo,
		canRedo,
		executeAction,
		registerTextarea,
		historyLength,
	}
}
