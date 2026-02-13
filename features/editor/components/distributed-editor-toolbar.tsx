/**
 * Distributed Editor Toolbar
 *
 * Main component that manages state and renders button groups via portals
 * to their semantically correct positions within the native toolbar.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { PollCreatorDialog } from './poll-creator-dialog'
import { GifPicker } from './toolbar/gif-picker'
import ChartBar from 'lucide-react/dist/esm/icons/chart-bar'
import ReactDOM from 'react-dom'
import { setStoredTheme } from '../lib/themes'
import { useUIStore } from '@/store'
import { getSettings } from '@/store/settings-store'
import { MV_SELECTORS } from '@/constants'
import '@/assets/live-preview.css'

// Hooks
import { useTextInsertion, useListFormatting, useImageUpload, useTextHistory } from '../hooks'

// Toolbar button components
import { CodeToolbarButton } from './toolbar/code-toolbar-button'
import { ImageToolbarButton } from './toolbar/image-toolbar-button'
import { ListToolbarButton } from './toolbar/list-toolbar-button'
import { FormattingToolbarButtons } from './toolbar/formatting-toolbar-buttons'
import { HeaderToolbarButton } from './toolbar/header-toolbar-button'
import { HistoryToolbarButtons } from './toolbar/history-toolbar-buttons'
import { CineToolbarButton } from './toolbar/cine-toolbar-button'
import { GameToolbarButton } from './toolbar/game-toolbar-button'
import { ApiKeyDialog, ImageDropzone } from './toolbar'

// Portal utilities
import {
	createAllPortalContainers,
	configureHistoryContainer,
	ensureRelativePositioning,
	relocateSmileyButton,
} from './toolbar/portal-containers'

// Handler utilities
import {
	createHeaderInsertHandler,
	createPollInsertHandler,
	createTableInsertHandler,
	createTemplateInsertHandler,
	getTableAtCursor,
	openDraftsSidebar,
	isNewThreadPage,
	type TableEditState,
} from './toolbar/toolbar-handlers'

// Dialog components
import { MovieTemplateDialog } from '@/features/cine/components/movie-template-dialog'
import { GameTemplateDialog } from '@/features/games/components/game-template-dialog'
import { TableEditorDialog } from '@/features/table-editor/components/table-editor-dialog'
import { LivePreviewPanel } from './live-preview-panel'
import { InsertTemplateDialog } from '@/features/drafts/components/insert-template-dialog'
import { IndexCreatorDialog } from './index-creator-dialog'

const DEFAULT_THEME = 'github-dark'

interface DistributedEditorToolbarProps {
	textarea: HTMLTextAreaElement
	toolbarContainer: HTMLElement
}

/**
 * DistributedEditorToolbar component - Orchestrates the premium editor experience.
 * Manages complex state for multiple groups and renders them via portals into the native DOM.
 */
export function DistributedEditorToolbar({ textarea, toolbarContainer }: DistributedEditorToolbarProps) {
	// Dialog states
	const [showMovieDialog, setShowMovieDialog] = useState(false)
	const [showGameDialog, setShowGameDialog] = useState(false)
	const [showTableDialog, setShowTableDialog] = useState(false)
	const [showPollDialog, setShowPollDialog] = useState(false)
	const [showDropzone, setShowDropzone] = useState(false)
	const [showInsertTemplate, setShowInsertTemplate] = useState(false)
	const [showIndexDialog, setShowIndexDialog] = useState(false)
	const [isTableAtCursor, setIsTableAtCursor] = useState(false)
	const [tableEditData, setTableEditData] = useState<TableEditState | null>(null)

	const { livePreview, toggleLivePreview } = useUIStore()

	// Feature toggles
	const [featureToggles, setFeatureToggles] = useState({
		cinemaButtonEnabled: true,
		gifPickerEnabled: true,
		draftsButtonEnabled: true,
		templateButtonEnabled: true,
		gameButtonEnabled: true,
	})

	useEffect(() => {
		getSettings().then(settings => {
			console.log('DistributedEditorToolbar settings loaded:', settings)
			console.log('gameButtonEnabled from settings:', settings.gameButtonEnabled)
			setFeatureToggles({
				cinemaButtonEnabled: settings.cinemaButtonEnabled ?? true,
				gifPickerEnabled: settings.gifPickerEnabled ?? true,
				draftsButtonEnabled: settings.draftsButtonEnabled ?? true,
				templateButtonEnabled: settings.templateButtonEnabled ?? true,
				gameButtonEnabled: settings.gameButtonEnabled ?? true,
			})
		})
	}, [])

	// Page context
	const isNewThread = useMemo(() => isNewThreadPage(), [])

	// Custom hooks
	const { insertText, insertCode, insertUnderline, insertStrikethrough, insertCenter, insertImageTag } =
		useTextInsertion(textarea)
	const { insertUnorderedList, insertOrderedList, insertTaskList } = useListFormatting(textarea)
	const imageUpload = useImageUpload(textarea, { onSuccess: insertImageTag })
	const { undo, redo, canUndo, canRedo, initHistory } = useTextHistory(textarea)

	// Memoized handlers
	const handleInsertHeader = useMemo(() => createHeaderInsertHandler(textarea), [textarea])
	const handleInsertPoll = useMemo(() => createPollInsertHandler(textarea), [textarea])
	const handleInsertTemplate = useMemo(
		() => createTemplateInsertHandler(insertText, isNewThread),
		[insertText, isNewThread]
	)

	// Initialize on mount
	useEffect(() => {
		initHistory()
		void setStoredTheme(DEFAULT_THEME)
	}, [initHistory])

	// Global drag listener
	useEffect(() => {
		const handleGlobalDragEnter = (e: DragEvent) => {
			if (e.dataTransfer?.types?.includes('Files') && !imageUpload.isUploading) {
				setShowDropzone(true)
			}
		}
		document.addEventListener('dragenter', handleGlobalDragEnter)
		return () => document.removeEventListener('dragenter', handleGlobalDragEnter)
	}, [imageUpload.isUploading])

	// Clipboard paste listener for images (Ctrl+V with screenshots or copied files)
	useEffect(() => {
		const handlePaste = async (e: ClipboardEvent) => {
			if (imageUpload.isUploading) return

			const clipboardData = e.clipboardData
			if (!clipboardData) return

			// Helper to check if a string contains an image URL
			const IMAGE_URL_REGEX = /https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|gif)(\?[^\s"'<>]*)?/i

			// Check ALL possible sources for image URLs - if found, don't intercept
			// This handles: pasted URLs, copied images from web, etc.
			const textPlain = clipboardData.getData('text/plain')
			const textHtml = clipboardData.getData('text/html')
			const textUriList = clipboardData.getData('text/uri-list')

			const hasImageUrl =
				IMAGE_URL_REGEX.test(textPlain) || IMAGE_URL_REGEX.test(textHtml) || IMAGE_URL_REGEX.test(textUriList)

			if (hasImageUrl) {
				return // Let native paste + autotag system handle it
			}

			// Only process if this is a pure local image (screenshot, file from disk)
			// with NO associated URL in the clipboard
			const imageFiles: File[] = []

			// Check clipboardData.items for image files (screenshots, copied files)
			if (clipboardData.items) {
				for (const item of Array.from(clipboardData.items)) {
					if (item.type.startsWith('image/') && item.kind === 'file') {
						const file = item.getAsFile()
						if (file) {
							imageFiles.push(file)
						}
					}
				}
			}

			// If we found local images (no URL), upload them
			if (imageFiles.length > 0) {
				e.preventDefault()
				setShowDropzone(true)
				await new Promise(resolve => setTimeout(resolve, 50))
				await imageUpload.uploadFiles(imageFiles)
				setShowDropzone(false)
			}
		}

		textarea.addEventListener('paste', handlePaste)
		return () => textarea.removeEventListener('paste', handlePaste)
	}, [textarea, imageUpload])

	// Table detection
	useEffect(() => {
		const checkTableAtCursor = () => {
			const { isAtCursor } = getTableAtCursor(textarea)
			setIsTableAtCursor(isAtCursor)
		}

		textarea.addEventListener('keyup', checkTableAtCursor)
		textarea.addEventListener('click', checkTableAtCursor)
		textarea.addEventListener('input', checkTableAtCursor)
		checkTableAtCursor()

		return () => {
			textarea.removeEventListener('keyup', checkTableAtCursor)
			textarea.removeEventListener('click', checkTableAtCursor)
			textarea.removeEventListener('input', checkTableAtCursor)
		}
	}, [textarea])

	// Active formats detection
	const [activeFormats, setActiveFormats] = useState<string[]>([])

	useEffect(() => {
		const checkActiveFormats = () => {
			const text = textarea.value
			const cursorPos = textarea.selectionStart
			import('@/features/editor/lib/bbcode-utils').then(({ getActiveFormats }) => {
				setActiveFormats(getActiveFormats(text, cursorPos))
			})
		}

		textarea.addEventListener('keyup', checkActiveFormats)
		textarea.addEventListener('click', checkActiveFormats)
		textarea.addEventListener('input', checkActiveFormats)
		checkActiveFormats()

		return () => {
			textarea.removeEventListener('keyup', checkActiveFormats)
			textarea.removeEventListener('click', checkActiveFormats)
			textarea.removeEventListener('input', checkActiveFormats)
		}
	}, [textarea])

	// Table dialog handlers
	const handleOpenTableDialog = useCallback(() => {
		const { editData } = getTableAtCursor(textarea)
		setTableEditData(editData)
		setShowTableDialog(true)
	}, [textarea])

	const handleInsertTable = useMemo(
		() => createTableInsertHandler(textarea, tableEditData, () => setTableEditData(null)),
		[textarea, tableEditData]
	)

	const handleCloseTableDialog = useCallback(() => {
		setShowTableDialog(false)
		setTableEditData(null)
	}, [])

	// Dropzone handler
	const handleDropzoneFilesSelect = async (files: File[]) => {
		await imageUpload.uploadFiles(files)
		setShowDropzone(false)
	}

	// Create portal containers
	const containers = useMemo(() => {
		const result = createAllPortalContainers(toolbarContainer)
		ensureRelativePositioning(toolbarContainer)
		configureHistoryContainer(result.history)
		relocateSmileyButton(toolbarContainer)
		return result
	}, [toolbarContainer])

	// Overlay positioning for dropzone
	const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({})
	const overlayHost = useMemo(
		() =>
			(textarea.closest(`#${MV_SELECTORS.EDITOR.POST_EDITOR_ID}`) as HTMLElement | null) ||
			textarea.parentElement ||
			null,
		[textarea]
	)

	const updateOverlayPosition = useCallback(() => {
		const host = overlayHost
		if (!host) return
		const computedStyle = getComputedStyle(host)
		if (computedStyle.position === 'static') {
			host.style.position = 'relative'
		}

		const hostRect = host.getBoundingClientRect()
		const textareaRect = textarea.getBoundingClientRect()

		setOverlayStyle({
			position: 'absolute',
			top: Math.max(0, textareaRect.top - hostRect.top),
			left: Math.max(0, textareaRect.left - hostRect.left),
			width: Math.max(0, textareaRect.width),
			height: Math.max(0, textareaRect.height),
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			zIndex: 100,
			pointerEvents: 'none',
			overflow: 'hidden',
		})
	}, [overlayHost])

	useEffect(() => {
		if (!showDropzone || !overlayHost) return
		updateOverlayPosition()
		const ro = new ResizeObserver(() => updateOverlayPosition())
		ro.observe(textarea)
		ro.observe(overlayHost)
		return () => ro.disconnect()
	}, [overlayHost, showDropzone, textarea, updateOverlayPosition])

	return (
		<>
			{/* Hidden file input */}
			<input
				ref={imageUpload.fileInputRef}
				type="file"
				accept="image/jpeg,image/png,image/gif"
				style={{ display: 'none' }}
				onChange={imageUpload.handleImageSelect}
			/>

			{/* GROUP 1: Formatting */}
			{ReactDOM.createPortal(
				<FormattingToolbarButtons
					onInsertUnderline={insertUnderline}
					onInsertStrikethrough={insertStrikethrough}
					onInsertCenter={insertCenter}
					showNsfw={false}
				/>,
				containers.formatting
			)}

			{/* GROUP 2: Structure Dropdowns */}
			{ReactDOM.createPortal(
				<>
					<HeaderToolbarButton onInsertHeader={handleInsertHeader} />
					<ListToolbarButton
						onInsertUnorderedList={insertUnorderedList}
						onInsertOrderedList={insertOrderedList}
						onInsertTaskList={insertTaskList}
					/>
				</>,
				containers.structureDropdowns
			)}

			{/* GROUP 3: Media */}
			{ReactDOM.createPortal(
				<>
					{/* Log to verify render attempt */}
					{(() => { console.log('Rendering Media Group. gameButtonEnabled:', featureToggles.gameButtonEnabled); return null; })()}
					<ImageToolbarButton
						isUploading={imageUpload.isUploading}
						onTriggerUpload={() => setShowDropzone(prev => !prev)}
					/>
					{featureToggles.gifPickerEnabled && <GifPicker onInsert={insertText} variant="native" />}
					{featureToggles.cinemaButtonEnabled && <CineToolbarButton onFullSheet={() => setShowMovieDialog(true)} />}
					{featureToggles.gameButtonEnabled && <GameToolbarButton onClick={() => setShowGameDialog(true)} />}
				</>,
				containers.media
			)}

			{/* GROUP 4: Code */}
			{ReactDOM.createPortal(<CodeToolbarButton onInsertCode={insertCode} />, containers.code)}

			{/* GROUP 5: Structure */}
			{ReactDOM.createPortal(
				<>
					<button
						type="button"
						className={`mvp-toolbar-btn ${isTableAtCursor ? 'active' : ''}`}
						onClick={e => {
							e.preventDefault()
							e.stopPropagation()
							handleOpenTableDialog()
						}}
						title={isTableAtCursor ? 'Editar tabla' : 'Insertar tabla'}
					>
						<i className="fa fa-table" />
					</button>
					<button
						type="button"
						className="mvp-toolbar-btn"
						onClick={e => {
							e.preventDefault()
							e.stopPropagation()
							setShowIndexDialog(true)
						}}
						title="Crear índice con anclas"
					>
						<i className="fa fa-list-ol" />
					</button>
					{isNewThread && (
						<button
							type="button"
							className="mvp-toolbar-btn"
							onClick={e => {
								e.preventDefault()
								e.stopPropagation()
								setShowPollDialog(true)
							}}
							title="Crear encuesta"
						>
							<ChartBar className="w-4 h-4" />
						</button>
					)}
				</>,
				containers.structure
			)}

			{/* GROUP 6: Tools */}
			{ReactDOM.createPortal(
				<>
					{featureToggles.templateButtonEnabled && (
						<button
							type="button"
							className="mvp-toolbar-btn"
							onClick={e => {
								e.preventDefault()
								e.stopPropagation()
								setShowInsertTemplate(true)
							}}
							title="Insertar plantilla"
						>
							<i className="fa fa-magic" />
						</button>
					)}
					{featureToggles.draftsButtonEnabled && (
						<button
							type="button"
							className="mvp-toolbar-btn"
							onClick={e => {
								e.preventDefault()
								e.stopPropagation()
								openDraftsSidebar(textarea)
							}}
							title="Mis Borradores"
						>
							<i className="fa fa-folder-open-o" />
						</button>
					)}
					<button
						type="button"
						className={`mvp-toolbar-btn ${livePreview.isVisible ? 'active' : ''}`}
						onClick={e => {
							e.preventDefault()
							e.stopPropagation()
							toggleLivePreview()
						}}
						title="Live preview"
					>
						<i className={`fa ${livePreview.isVisible ? 'fa-eye-slash' : 'fa-eye'}`} />
					</button>
				</>,
				containers.tools
			)}

			{/* GROUP 7: History */}
			{ReactDOM.createPortal(
				<HistoryToolbarButtons onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} />,
				containers.history
			)}

			{/* Dropzone overlay */}
			{showDropzone &&
				overlayHost &&
				ReactDOM.createPortal(
					<div className="mvp-image-dropzone-overlay" data-mvp-dropzone-overlay="true" style={overlayStyle}>
						<div style={{ pointerEvents: 'auto', width: '80%', maxWidth: '400px', maxHeight: 'calc(100% - 16px)', overflowY: 'auto' }}>
							<ImageDropzone
								isOpen={showDropzone}
								onClose={() => setShowDropzone(false)}
								onFilesSelect={handleDropzoneFilesSelect}
								isUploading={imageUpload.isUploading}
								uploadProgress={imageUpload.uploadProgress}
							/>
						</div>
					</div>,
					overlayHost
				)}

			{/* Dialogs */}
			<ApiKeyDialog
				open={imageUpload.showApiKeyDialog}
				onOpenChange={imageUpload.setShowApiKeyDialog}
				apiKey={imageUpload.apiKeyValue}
				onApiKeyChange={imageUpload.setApiKeyValue}
				onSave={imageUpload.handleSaveApiKey}
			/>

			{showMovieDialog && (
				<MovieTemplateDialog
					isOpen={showMovieDialog}
					onClose={() => setShowMovieDialog(false)}
					onInsert={(template: string) => insertText(template)}
				/>
			)}

			{showGameDialog && (
				<GameTemplateDialog
					isOpen={showGameDialog}
					onClose={() => setShowGameDialog(false)}
					onInsert={(template: string) => insertText(template)}
				/>
			)}

			{showTableDialog && (
				<TableEditorDialog
					isOpen={showTableDialog}
					onClose={handleCloseTableDialog}
					onInsert={handleInsertTable}
					initialData={tableEditData?.initialData}
				/>
			)}

			{showPollDialog && (
				<PollCreatorDialog
					isOpen={showPollDialog}
					onClose={() => setShowPollDialog(false)}
					onInsert={handleInsertPoll}
				/>
			)}

			{showInsertTemplate && (
				<InsertTemplateDialog
					open={showInsertTemplate}
					onOpenChange={setShowInsertTemplate}
					onInsert={handleInsertTemplate}
				/>
			)}

			{showIndexDialog && (
				<IndexCreatorDialog isOpen={showIndexDialog} onClose={() => setShowIndexDialog(false)} onInsert={insertText} />
			)}

			{/* Live Preview Panel */}
			{livePreview.isVisible &&
				ReactDOM.createPortal(<LivePreviewPanel textarea={textarea} onClose={toggleLivePreview} />, document.body)}
		</>
	)
}
