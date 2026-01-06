/**
 * useEditorHandlers Hook
 * Manages toolbar actions, paste handling, and scroll sync
 */

import { useCallback } from 'react'
import { toast } from 'sonner'
import { findTableAtCursor } from '@/features/editor/lib/table-utils'
import { unwrapBBCode, getFormatById } from '@/features/editor/lib/bbcode-utils'
import { isImageUrl } from '@/features/editor/logic/image-detector'
import type { UseEditorHandlersOptions } from './types'
import type { MvEmoji } from '@/constants/mv-emojis'
import type { TableInitialData } from '@/features/table-editor/components/table-editor-dialog'

interface TableEditData {
	initialData: TableInitialData
	tableStart: number
	tableEnd: number
}

interface UseEditorHandlersReturn {
	// Table state helpers
	checkTableAtCursor: () => boolean
	getTableEditData: () => TableEditData | null

	// Toolbar actions
	handleToolbarAction: (buttonId: string, activeFormats: string[]) => void
	handleInsertSnippet: (template: string) => void
	handleWrapSelection: (prefix: string, suffix: string) => void
	handleInsertList: (prefix: string) => void

	// Dialog handlers
	handleDialog: (dialogId: string) => TableEditData | null

	// Insert handlers
	handleInsertTable: (markdown: string, tableEditData: TableEditData | null) => void
	handleInsertPoll: (bbcode: string) => void
	handleInsertEmoji: (emoji: MvEmoji) => void
	handleInsertGif: (bbcode: string) => void
	handleInsertUrl: (url: string, displayText: string) => void
	handleInsertMovieTemplate: (template: string) => void
	handleInsertIndex: (bbcode: string) => void

	// Other handlers
	handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
	handleSyncScroll: () => void
}

export function useEditorHandlers({
	form,
	textareaRef,
	previewRef,
	editor,
	dialogs,
	checkActiveFormats,
}: UseEditorHandlersOptions): UseEditorHandlersReturn {
	// Check if cursor is inside a table
	const checkTableAtCursor = useCallback((): boolean => {
		if (!textareaRef.current) return false
		const text = textareaRef.current.value
		const cursorPos = textareaRef.current.selectionStart
		const tableInfo = findTableAtCursor(text, cursorPos)
		return !!tableInfo
	}, [textareaRef])

	// Get table edit data if cursor is in a table
	const getTableEditData = useCallback((): TableEditData | null => {
		if (!textareaRef.current) return null
		const text = textareaRef.current.value
		const cursorPos = textareaRef.current.selectionStart
		const tableInfo = findTableAtCursor(text, cursorPos)

		if (tableInfo) {
			return {
				initialData: {
					cells: tableInfo.table.cells,
					alignments: tableInfo.table.alignments as ('left' | 'center' | 'right')[],
				},
				tableStart: tableInfo.startIndex,
				tableEnd: tableInfo.endIndex,
			}
		}
		return null
	}, [textareaRef])

	// Scroll sync
	const handleSyncScroll = useCallback(() => {
		const textarea = textareaRef.current
		const preview = previewRef.current
		if (!textarea || !preview) return

		requestAnimationFrame(() => {
			if (textarea.scrollHeight <= textarea.clientHeight) return
			const ratio = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight)
			const previewMaxScroll = preview.scrollHeight - preview.clientHeight
			preview.scrollTop = ratio * previewMaxScroll
		})
	}, [textareaRef, previewRef])

	// Toolbar action handler with toggle support
	const handleToolbarAction = useCallback(
		(buttonId: string, activeFormats: string[]) => {
			const format = getFormatById(buttonId)
			if (format && activeFormats.includes(buttonId) && textareaRef.current) {
				const text = textareaRef.current.value
				const cursorPos = textareaRef.current.selectionStart
				const result = unwrapBBCode(text, cursorPos, format)

				if (result) {
					form.setValue('content', result.newText, { shouldDirty: true })

					requestAnimationFrame(() => {
						if (textareaRef.current) {
							textareaRef.current.selectionStart = result.newCursorPos
							textareaRef.current.selectionEnd = result.newCursorPos
							textareaRef.current.focus()
							checkActiveFormats()
						}
					})
					return
				}
			}

			editor.executeAction(buttonId)

			requestAnimationFrame(() => {
				checkActiveFormats()
			})
		},
		[form, textareaRef, editor, checkActiveFormats]
	)

	const handleInsertSnippet = useCallback(
		(template: string) => {
			editor.insertAtCursor(template)
		},
		[editor]
	)

	const handleWrapSelection = useCallback(
		(prefix: string, suffix: string) => {
			editor.wrapSelection(prefix, suffix)
		},
		[editor]
	)

	const handleInsertList = useCallback(
		(prefix: string) => {
			const textarea = textareaRef.current
			if (!textarea) return

			const start = textarea.selectionStart
			const end = textarea.selectionEnd
			const text = textarea.value
			const selectedText = text.substring(start, end)

			if (selectedText) {
				const lines = selectedText.split('\n')
				const listItems = lines
					.map((line, i) => {
						if (prefix.match(/^\d+\. $/)) {
							return `${i + 1}. ${line}`
						}
						return `${prefix}${line}`
					})
					.join('\n')

				const newlinePrefix = start > 0 && text[start - 1] !== '\n' ? '\n' : ''
				const newlineSuffix = end < text.length && text[end] !== '\n' ? '\n' : ''

				textarea.value = text.substring(0, start) + newlinePrefix + listItems + newlineSuffix + text.substring(end)

				const newCursorPos = start + newlinePrefix.length + listItems.length
				textarea.selectionStart = newCursorPos
				textarea.selectionEnd = newCursorPos
			} else {
				const newlinePrefix = start > 0 && text[start - 1] !== '\n' ? '\n' : ''
				const listItem = newlinePrefix + prefix

				textarea.value = text.substring(0, start) + listItem + text.substring(end)

				const newCursorPos = start + listItem.length
				textarea.selectionStart = newCursorPos
				textarea.selectionEnd = newCursorPos
			}

			textarea.dispatchEvent(new Event('input', { bubbles: true }))
			textarea.dispatchEvent(new Event('change', { bubbles: true }))
			textarea.focus()
		},
		[textareaRef]
	)

	// Dialog handler - returns table edit data if opening table dialog
	const handleDialog = useCallback(
		(dialogId: string): TableEditData | null => {
			switch (dialogId) {
				case 'url': {
					const selection = editor.getSelection()
					dialogs.open('url', { urlSelection: selection.text || '' })
					return null
				}
				case 'image':
					dialogs.open('dropzone')
					return null
				case 'table': {
					const tableData = getTableEditData()
					dialogs.open('table')
					return tableData
				}
				case 'movie-template':
					dialogs.open('movie')
					return null
				case 'index':
					dialogs.open('index')
					return null
				case 'poll':
					dialogs.open('poll')
					return null
				default:
					return null
			}
		},
		[editor, dialogs, getTableEditData]
	)

	// Insert handlers
	const handleInsertTable = useCallback(
		(markdown: string, tableEditData: TableEditData | null) => {
			if (tableEditData && textareaRef.current) {
				const text = textareaRef.current.value
				const before = text.substring(0, tableEditData.tableStart)
				const after = text.substring(tableEditData.tableEnd)
				textareaRef.current.value = before + markdown + after
				const newPosition = tableEditData.tableStart + markdown.length
				textareaRef.current.selectionStart = newPosition
				textareaRef.current.selectionEnd = newPosition
				textareaRef.current.dispatchEvent(new Event('input', { bubbles: true }))
				textareaRef.current.focus()
				form.setValue('content', textareaRef.current.value)
			} else {
				editor.insertAtCursor(markdown)
			}
			dialogs.close()
		},
		[textareaRef, form, editor, dialogs]
	)

	const handleInsertPoll = useCallback(
		(bbcode: string) => {
			editor.insertAtCursor(bbcode + '\n')
		},
		[editor]
	)

	const handleInsertEmoji = useCallback(
		(emoji: MvEmoji) => {
			editor.insertAtCursor(emoji.code)
		},
		[editor]
	)

	const handleInsertGif = useCallback(
		(bbcode: string) => {
			editor.insertAtCursor(bbcode)
		},
		[editor]
	)

	const handleInsertUrl = useCallback(
		(url: string, displayText: string) => {
			if (displayText) {
				editor.insertAtCursor(`[url=${url}]${displayText}[/url]`)
			} else {
				editor.insertAtCursor(`[url]${url}[/url]`)
			}
		},
		[editor]
	)

	const handleInsertMovieTemplate = useCallback(
		(template: string) => {
			editor.insertAtCursor(template + '\n')
			dialogs.close()
		},
		[editor, dialogs]
	)

	const handleInsertIndex = useCallback(
		(bbcode: string) => {
			editor.insertAtCursor(bbcode)
			dialogs.close()
		},
		[editor, dialogs]
	)

	// Paste handler for auto image tagging
	const handlePaste = useCallback(
		(e: React.ClipboardEvent<HTMLTextAreaElement>) => {
			const pastedText = e.clipboardData.getData('text/plain').trim()

			if (!pastedText || pastedText.includes(' ') || pastedText.includes('\n')) {
				return
			}

			if (isImageUrl(pastedText)) {
				e.preventDefault()
				editor.insertAtCursor(`[img]${pastedText}[/img]`)
				toast.success('Imagen detectada', {
					description: 'URL envuelta automáticamente con [img]',
				})
			}
		},
		[editor]
	)

	return {
		checkTableAtCursor,
		getTableEditData,
		handleToolbarAction,
		handleInsertSnippet,
		handleWrapSelection,
		handleInsertList,
		handleDialog,
		handleInsertTable,
		handleInsertPoll,
		handleInsertEmoji,
		handleInsertGif,
		handleInsertUrl,
		handleInsertMovieTemplate,
		handleInsertIndex,
		handlePaste,
		handleSyncScroll,
	}
}
