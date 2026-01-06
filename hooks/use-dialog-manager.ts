/**
 * useDialogManager - Centralized dialog state management
 *
 * Replaces multiple useState booleans for dialogs with a single state.
 * Only one dialog can be open at a time (mutually exclusive).
 */
import { useState, useCallback, useMemo } from 'react'

/**
 * Available dialog types in the application.
 * Add new dialog types here as needed.
 */
export type DialogType =
	| 'dropzone'
	| 'apiKey'
	| 'poll'
	| 'table'
	| 'movie'
	| 'index'
	| 'template'
	| 'folder'
	| 'url'
	| 'clear'
	| 'preview'
	| null

/**
 * Dialog-specific data that can be passed when opening a dialog
 */
export interface DialogData {
	/** For URL dialog: pre-selected text */
	urlSelection?: string
	/** For table dialog: existing table data for editing */
	tableEditData?: {
		initialData: {
			cells: string[][]
			alignments: ('left' | 'center' | 'right')[]
		}
		tableStart: number
		tableEnd: number
	} | null
	/** Generic data payload */
	[key: string]: unknown
}

export interface UseDialogManagerReturn {
	/** Currently active dialog, or null if none */
	activeDialog: DialogType
	/** Data associated with the current dialog */
	dialogData: DialogData
	/** Open a specific dialog with optional data */
	open: (type: Exclude<DialogType, null>, data?: DialogData) => void
	/** Close the currently open dialog */
	close: () => void
	/** Check if a specific dialog is open */
	isOpen: (type: Exclude<DialogType, null>) => boolean
	/** Toggle a dialog (open if closed, close if open) */
	toggle: (type: Exclude<DialogType, null>, data?: DialogData) => void
	/** Close only if a specific dialog is open */
	closeIf: (type: Exclude<DialogType, null>) => boolean
}

/**
 * Hook for managing multiple dialogs with a single state.
 *
 * @example
 * ```tsx
 * const dialogs = useDialogManager()
 *
 * // Open a dialog
 * dialogs.open('poll')
 *
 * // Open with data
 * dialogs.open('url', { urlSelection: 'selected text' })
 *
 * // Check if open
 * if (dialogs.isOpen('poll')) { ... }
 *
 * // In JSX
 * <PollDialog isOpen={dialogs.isOpen('poll')} onClose={dialogs.close} />
 * ```
 */
export function useDialogManager(): UseDialogManagerReturn {
	const [activeDialog, setActiveDialog] = useState<DialogType>(null)
	const [dialogData, setDialogData] = useState<DialogData>({})

	const open = useCallback((type: Exclude<DialogType, null>, data?: DialogData) => {
		setActiveDialog(type)
		setDialogData(data ?? {})
	}, [])

	const close = useCallback(() => {
		setActiveDialog(null)
		setDialogData({})
	}, [])

	const isOpen = useCallback((type: Exclude<DialogType, null>) => activeDialog === type, [activeDialog])

	const toggle = useCallback(
		(type: Exclude<DialogType, null>, data?: DialogData) => {
			if (activeDialog === type) {
				close()
			} else {
				open(type, data)
			}
		},
		[activeDialog, open, close]
	)

	const closeIf = useCallback(
		(type: Exclude<DialogType, null>): boolean => {
			if (activeDialog === type) {
				close()
				return true
			}
			return false
		},
		[activeDialog, close]
	)

	return useMemo(
		() => ({
			activeDialog,
			dialogData,
			open,
			close,
			isOpen,
			toggle,
			closeIf,
		}),
		[activeDialog, dialogData, open, close, isOpen, toggle, closeIf]
	)
}
