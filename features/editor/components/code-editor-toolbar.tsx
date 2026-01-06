import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { setStoredTheme } from '../lib/themes'
import { useUIStore } from '@/store'
import { getSettings } from '@/store/settings-store'
import '@/assets/live-preview.css'

// Hooks
import { useTextInsertion, useListFormatting, useImageUpload } from '../hooks'

// Toolbar components
import {
	CodeToolbarButton,
	ImageToolbarButton,
	ListToolbarButton,
	FormattingToolbarButtons,
	FeatureToolbarButtons,
	ApiKeyDialog,
	ImageDropzone,
} from './toolbar'

import { GifPicker } from './toolbar/gif-picker'

// Dialog components
import { MovieTemplateDialog } from '@/features/cine/components/movie-template-dialog'
import { TableEditorDialog } from '@/features/table-editor/components/table-editor-dialog'
import { PollCreatorDialog } from './poll-creator-dialog'
import { LivePreviewPanel } from '@/features/editor/components/live-preview-panel'

import { DOM_MARKERS } from '@/constants'

// Table utilities - import type separately
import { findTableAtCursor, parseMarkdownTable } from '@/features/editor/lib/table-utils'
import type { TableInitialData } from '@/features/table-editor/components/table-editor-dialog'

const DEFAULT_THEME = 'github-dark'

interface CodeEditorToolbarProps {
	textarea: HTMLTextAreaElement
}

export function CodeEditorToolbar({ textarea }: CodeEditorToolbarProps) {
	const [showMovieDialog, setShowMovieDialog] = useState(false)
	const [showTableDialog, setShowTableDialog] = useState(false)
	const [showPollDialog, setShowPollDialog] = useState(false)
	const [showDropzone, setShowDropzone] = useState(false)
	const [isTableAtCursor, setIsTableAtCursor] = useState(false)
	const [tableEditData, setTableEditData] = useState<{
		initialData: TableInitialData
		tableStart: number
		tableEnd: number
	} | null>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const { livePreview, toggleLivePreview } = useUIStore()
	
	// Feature toggles - read from storage on mount
	const [featureToggles, setFeatureToggles] = useState({
		cinemaButtonEnabled: true,
		gifPickerEnabled: true,
	})
	
	// Read settings from storage directly (more reliable than store hydration in content scripts)
	useEffect(() => {
		getSettings().then(settings => {
			setFeatureToggles({
				cinemaButtonEnabled: settings.cinemaButtonEnabled ?? true,
				gifPickerEnabled: settings.gifPickerEnabled ?? true,
			})
		})
	}, [])
	
	const { cinemaButtonEnabled, gifPickerEnabled } = featureToggles

	// Check if polls are allowed - new thread pages OR editing first post (post-1)
	// Polls only work in the first post of a thread
	const isNewThreadPage = /^\/foro\/[^\/]+\/nuevo-hilo/.test(window.location.pathname)
	// Edit URL format: /foro/post.php?tid=XXX&num=1
	const isEditingFirstPost =
		window.location.pathname === '/foro/post.php' && new URLSearchParams(window.location.search).get('num') === '1'
	const isNewThread = isNewThreadPage || isEditingFirstPost

	// Check if we're on a new thread page in cine subforum
	const isNewCineThread = /^\/foro\/cine\/nuevo-hilo/.test(window.location.pathname)

	// Custom hooks
	const { insertText, insertCode, insertUnderline, insertStrikethrough, insertNsfw, insertCenter, insertImageTag } =
		useTextInsertion(textarea)
	const { insertUnorderedList, insertOrderedList, insertTaskList } = useListFormatting(textarea)
	const imageUpload = useImageUpload(textarea, {
		onSuccess: insertImageTag,
	})

	// Set default theme on mount
	useEffect(() => {
		void setStoredTheme(DEFAULT_THEME)
	}, [])

	// Global drag listener to auto-open dropzone
	useEffect(() => {
		const handleGlobalDragEnter = (e: DragEvent) => {
			// Check if files are being dragged
			if (e.dataTransfer?.types?.includes('Files')) {
				// Don't override if already uploading
				if (!imageUpload.isUploading) {
					setShowDropzone(true)
				}
			}
		}

		document.addEventListener('dragenter', handleGlobalDragEnter)
		return () => document.removeEventListener('dragenter', handleGlobalDragEnter)
	}, [imageUpload.isUploading])

	// Real-time table detection when cursor moves
	useEffect(() => {
		const checkTableAtCursor = () => {
			const text = textarea.value
			const cursorPos = textarea.selectionStart
			const tableInfo = findTableAtCursor(text, cursorPos)
			setIsTableAtCursor(!!tableInfo)
		}

		// Check on various events that might change cursor position
		textarea.addEventListener('keyup', checkTableAtCursor)
		textarea.addEventListener('click', checkTableAtCursor)
		textarea.addEventListener('select', checkTableAtCursor)
		textarea.addEventListener('input', checkTableAtCursor)

		// Initial check
		checkTableAtCursor()

		return () => {
			textarea.removeEventListener('keyup', checkTableAtCursor)
			textarea.removeEventListener('click', checkTableAtCursor)
			textarea.removeEventListener('select', checkTableAtCursor)
			textarea.removeEventListener('input', checkTableAtCursor)
		}
	}, [textarea])

	// Template insert handlers
	const handleInsertMovieTemplate = (template: string) => {
		insertText(template)
	}

	// Handle opening table dialog - check if cursor is inside existing table
	const handleOpenTableDialog = useCallback(() => {
		const text = textarea.value
		const cursorPos = textarea.selectionStart

		// Try to find an existing table at cursor position
		const tableInfo = findTableAtCursor(text, cursorPos)

		if (tableInfo) {
			// Cursor is inside a table - open in edit mode
			const tableText = text.substring(tableInfo.startIndex, tableInfo.endIndex)
			const parsed = parseMarkdownTable(tableText)

			if (parsed) {
				setTableEditData({
					initialData: parsed,
					tableStart: tableInfo.startIndex,
					tableEnd: tableInfo.endIndex,
				})
			}
		} else {
			// No table found - open in create mode
			setTableEditData(null)
		}

		setShowTableDialog(true)
	}, [textarea])

	// Handle table insertion or replacement
	const handleInsertTable = useCallback(
		(markdown: string) => {
			if (tableEditData) {
				// Editing existing table - replace the original table
				const text = textarea.value
				const before = text.substring(0, tableEditData.tableStart)
				const after = text.substring(tableEditData.tableEnd)

				textarea.value = before + markdown + after

				const newPosition = tableEditData.tableStart + markdown.length
				textarea.selectionStart = newPosition
				textarea.selectionEnd = newPosition
			} else {
				// Inserting new table
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

			// Reset edit data
			setTableEditData(null)
		},
		[textarea, tableEditData]
	)

	// Handle closing table dialog
	const handleCloseTableDialog = useCallback(() => {
		setShowTableDialog(false)
		setTableEditData(null)
	}, [])

	const handleOpenDrafts = () => {
		textarea.dispatchEvent(new CustomEvent(DOM_MARKERS.EVENTS.OPEN_DRAFTS, { bubbles: true }))
	}

	// Handle poll insertion
	const handleInsertPoll = useCallback(
		(bbcode: string) => {
			const start = textarea.selectionStart
			const text = textarea.value
			const before = text.substring(0, start)
			const after = text.substring(start)

			// Add newlines if needed
			const prefix = before.length > 0 && !before.endsWith('\n') ? '\n\n' : ''
			const suffix = after.length > 0 && !after.startsWith('\n') ? '\n\n' : '\n'

			textarea.value = before + prefix + bbcode + suffix + after

			const newPosition = start + prefix.length + bbcode.length + suffix.length
			textarea.selectionStart = newPosition
			textarea.selectionEnd = newPosition

			textarea.dispatchEvent(new Event('input', { bubbles: true }))
			textarea.focus()
		},
		[textarea]
	)

	// Handle files selection from dropzone
	const handleDropzoneFilesSelect = async (files: File[]) => {
		// Do not close dropzone immediately to show progress
		// It will be closed by the user or after a delay if we implement that
		await imageUpload.uploadFiles(files)
		// Close immediately after upload completes
		setShowDropzone(false)
	}

	// State to track textarea dimensions and position
	const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({})

	// Update overlay position/size based on textarea
	const updateOverlayPosition = useCallback(() => {
		const parent = textarea.parentElement
		if (!parent) return

		// Ensure parent has positioning context
		const computedStyle = getComputedStyle(parent)
		if (computedStyle.position === 'static') {
			parent.style.position = 'relative'
		}

		setOverlayStyle({
			position: 'absolute',
			top: textarea.offsetTop,
			left: textarea.offsetLeft,
			width: textarea.offsetWidth,
			height: textarea.offsetHeight,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: 100,
			pointerEvents: 'none',
			// No background color as requested
		})
	}, [textarea])

	// Watch for textarea resizes
	useEffect(() => {
		if (!showDropzone) return

		updateOverlayPosition()

		const ro = new ResizeObserver(() => {
			updateOverlayPosition()
		})
		ro.observe(textarea)

		return () => ro.disconnect()
	}, [showDropzone, textarea, updateOverlayPosition])

	// Render dropzone overlaying textarea
	const renderDropzone = () => {
		if (!showDropzone) return null

		const parent = textarea.parentElement
		if (!parent) return null

		return createPortal(
			<div style={overlayStyle}>
				<div style={{ pointerEvents: 'auto', width: '80%', maxWidth: '400px' }}>
					<ImageDropzone
						isOpen={showDropzone}
						onClose={() => setShowDropzone(false)}
						onFilesSelect={handleDropzoneFilesSelect}
						isUploading={imageUpload.isUploading}
						uploadProgress={imageUpload.uploadProgress}
					/>
				</div>
			</div>,
			parent
		)
	}

	return (
		<>
			{renderDropzone()}
			<div ref={containerRef} className="mvp-toolbar-item inline-flex items-center gap-1">
				{/* Hidden file input */}
				<input
					ref={imageUpload.fileInputRef}
					type="file"
					accept="image/jpeg,image/png,image/gif"
					style={{ display: 'none' }}
					onChange={imageUpload.handleImageSelect}
				/>

				{/* Formatting Buttons (Underline, Strikethrough, Center, NSFW) */}
				<FormattingToolbarButtons
					onInsertUnderline={insertUnderline}
					onInsertStrikethrough={insertStrikethrough}
					onInsertCenter={insertCenter}
					onInsertNsfw={insertNsfw}
				/>

				{/* List Dropdown */}
				<ListToolbarButton
					onInsertUnorderedList={insertUnorderedList}
					onInsertOrderedList={insertOrderedList}
					onInsertTaskList={insertTaskList}
				/>

				{/* Code Dropdown (replaces native Code button) */}
				<CodeToolbarButton onInsertCode={insertCode} />

				{/* Image Upload Button */}
				<ImageToolbarButton
					isUploading={imageUpload.isUploading}
					onTriggerUpload={() => {
						// No more API key check - Catbox works without it
						setShowDropzone(prev => !prev)
					}}
				/>

				{/* Gif Picker - only if enabled */}
				{gifPickerEnabled && <GifPicker onInsert={insertText} />}

				{/* Feature Buttons (Drafts, Table, Movie template, Poll, Preview) */}
				<FeatureToolbarButtons
					isNewCineThread={isNewCineThread}
					isNewThread={isNewThread}
					livePreviewVisible={livePreview.isVisible}
					isTableAtCursor={isTableAtCursor}
					cinemaButtonEnabled={cinemaButtonEnabled}
					onOpenTableDialog={handleOpenTableDialog}
					onOpenMovieDialog={() => setShowMovieDialog(true)}
					onOpenPollDialog={() => setShowPollDialog(true)}
					onToggleLivePreview={toggleLivePreview}
					onOpenDrafts={handleOpenDrafts}
				/>

				{/* API Key Dialog */}
				<ApiKeyDialog
					open={imageUpload.showApiKeyDialog}
					onOpenChange={imageUpload.setShowApiKeyDialog}
					apiKey={imageUpload.apiKeyValue}
					onApiKeyChange={imageUpload.setApiKeyValue}
					onSave={imageUpload.handleSaveApiKey}
				/>

				{/* Dialogs */}
				<MovieTemplateDialog
					isOpen={showMovieDialog}
					onClose={() => setShowMovieDialog(false)}
					onInsert={handleInsertMovieTemplate}
				/>

				<TableEditorDialog
					isOpen={showTableDialog}
					onClose={handleCloseTableDialog}
					onInsert={handleInsertTable}
					initialData={tableEditData?.initialData}
				/>

				<PollCreatorDialog
					isOpen={showPollDialog}
					onClose={() => setShowPollDialog(false)}
					onInsert={handleInsertPoll}
				/>
			</div>

			{/* Live Preview Panel - manages its own portal internally */}
			{livePreview.isVisible && <LivePreviewPanel textarea={textarea} onClose={toggleLivePreview} />}
		</>
	)
}
