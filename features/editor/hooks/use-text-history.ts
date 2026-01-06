/**
 * useTextHistory hook - Undo/Redo functionality for textarea content.
 * Manages states to enable history navigation with debouncing to group rapid edits.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { DEBOUNCE, TIMEOUT } from '@/constants'

interface HistoryEntry {
	value: string
	selectionStart: number
	selectionEnd: number
}

interface UseTextHistoryOptions {
	/** Maximum number of history entries to keep */
	maxHistory?: number
	/** Debounce time in ms for grouping changes */
	debounceMs?: number
}

interface UseTextHistoryReturn {
	/** Push current state to history (call before making changes) */
	pushState: () => void
	/** Undo last change */
	undo: () => void
	/** Redo previously undone change */
	redo: () => void
	/** Whether undo is available */
	canUndo: boolean
	/** Whether redo is available */
	canRedo: boolean
	/** Initialize history tracking */
	initHistory: () => void
}

export function useTextHistory(
	textarea: HTMLTextAreaElement,
	options: UseTextHistoryOptions = {}
): UseTextHistoryReturn {
	const { maxHistory = TIMEOUT.MAX_HISTORY_ENTRIES, debounceMs = DEBOUNCE.HISTORY } = options

	// History stacks
	const undoStackRef = useRef<HistoryEntry[]>([])
	const redoStackRef = useRef<HistoryEntry[]>([])

	// For UI reactivity
	const [canUndo, setCanUndo] = useState(false)
	const [canRedo, setCanRedo] = useState(false)

	// Debounce tracking
	const lastPushTimeRef = useRef<number>(0)
	const pendingStateRef = useRef<HistoryEntry | null>(null)

	// Update UI state
	const updateCanStates = useCallback(() => {
		setCanUndo(undoStackRef.current.length > 0)
		setCanRedo(redoStackRef.current.length > 0)
	}, [])

	// Get current state
	const getCurrentState = useCallback(
		(): HistoryEntry => ({
			value: textarea.value,
			selectionStart: textarea.selectionStart,
			selectionEnd: textarea.selectionEnd,
		}),
		[textarea]
	)

	// Apply state to textarea
	const applyState = useCallback(
		(state: HistoryEntry) => {
			textarea.value = state.value
			textarea.selectionStart = state.selectionStart
			textarea.selectionEnd = state.selectionEnd
			textarea.dispatchEvent(new Event('input', { bubbles: true }))
			textarea.focus()
		},
		[textarea]
	)

	// Push state to history
	const pushState = useCallback(() => {
		const now = Date.now()
		const currentState = getCurrentState()

		// If within debounce window, just update pending state
		if (now - lastPushTimeRef.current < debounceMs) {
			pendingStateRef.current = currentState
			return
		}

		// Push pending state if exists
		if (pendingStateRef.current) {
			undoStackRef.current.push(pendingStateRef.current)
			pendingStateRef.current = null
		}

		// Push current state
		undoStackRef.current.push(currentState)

		// Limit history size
		if (undoStackRef.current.length > maxHistory) {
			undoStackRef.current.shift()
		}

		// Clear redo stack on new action
		redoStackRef.current = []

		lastPushTimeRef.current = now
		updateCanStates()
	}, [getCurrentState, debounceMs, maxHistory, updateCanStates])

	// Undo
	const undo = useCallback(() => {
		if (undoStackRef.current.length === 0) return

		// Push current state to redo stack
		redoStackRef.current.push(getCurrentState())

		// Pop and apply last state
		const prevState = undoStackRef.current.pop()
		if (prevState) {
			applyState(prevState)
		}

		updateCanStates()
	}, [getCurrentState, applyState, updateCanStates])

	// Redo
	const redo = useCallback(() => {
		if (redoStackRef.current.length === 0) return

		// Push current state to undo stack
		undoStackRef.current.push(getCurrentState())

		// Pop and apply redo state
		const nextState = redoStackRef.current.pop()
		if (nextState) {
			applyState(nextState)
		}

		updateCanStates()
	}, [getCurrentState, applyState, updateCanStates])

	// Initialize with current state
	const initHistory = useCallback(() => {
		undoStackRef.current = []
		redoStackRef.current = []
		pendingStateRef.current = null
		lastPushTimeRef.current = 0
		// Push initial state
		undoStackRef.current.push(getCurrentState())
		updateCanStates()
	}, [getCurrentState, updateCanStates])

	// Setup keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Check if the event is from our textarea
			if (e.target !== textarea) return

			const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
			const ctrlKey = isMac ? e.metaKey : e.ctrlKey

			if (ctrlKey && e.key === 'z' && !e.shiftKey) {
				e.preventDefault()
				undo()
			} else if (ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
				e.preventDefault()
				redo()
			}
		}

		textarea.addEventListener('keydown', handleKeyDown)
		return () => textarea.removeEventListener('keydown', handleKeyDown)
	}, [textarea, undo, redo])

	// Track input changes
	useEffect(() => {
		const handleBeforeInput = () => {
			pushState()
		}

		textarea.addEventListener('beforeinput', handleBeforeInput)
		return () => textarea.removeEventListener('beforeinput', handleBeforeInput)
	}, [textarea, pushState])

	return {
		pushState,
		undo,
		redo,
		canUndo,
		canRedo,
		initHistory,
	}
}
