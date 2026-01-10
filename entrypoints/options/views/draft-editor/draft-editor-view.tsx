/**
 * Draft Editor View - Full Page Editor for Drafts
 * Refactored to use extracted hooks and components
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left'
import Save from 'lucide-react/dist/esm/icons/save'
import Eye from 'lucide-react/dist/esm/icons/eye'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Check from 'lucide-react/dist/esm/icons/check'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Plus from 'lucide-react/dist/esm/icons/plus'
import { useSettingsStore } from '@/store/settings-store'
import { useTheme } from '@/providers/theme-provider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { SharedEditorToolbar } from '@/components/editor'
import { useTextEditor, useDialogManager, useUploadState } from '@/hooks'
import { DEFAULT_TOOLBAR_BUTTONS } from '@/types/editor'
import { ImageDropzone } from '@/features/editor/components/toolbar'
import { SlashCommandPopover } from '@/features/drafts/components/slash-command-popover'
import { useSlashCommand } from '@/features/drafts/hooks'
import { cn } from '@/lib/utils'
import { getActiveFormats } from '@/features/editor/lib/bbcode-utils'

// Local modules
import { draftFormSchema, type DraftFormData, type DraftEditorViewProps } from './types'
import { useDraftEditor } from './use-draft-editor'
import { useEditorHandlers } from './use-editor-handlers'
import { EditorHeader } from './editor-header'
import { EditorFooter } from './editor-footer'
import { PreviewPanel } from './preview-panel'
import { EditorDialogs } from './editor-dialogs'
import type { TableInitialData } from '@/features/table-editor/components/table-editor-dialog'

interface TableEditData {
	initialData: TableInitialData
	tableStart: number
	tableEnd: number
}

export function DraftEditorView({ docType = 'draft' }: DraftEditorViewProps) {
	const navigate = useNavigate()
	const { theme } = useTheme()

	// Form state with react-hook-form + zod validation
	const form = useForm<DraftFormData>({
		resolver: zodResolver(draftFormSchema),
		defaultValues: {
			title: '',
			trigger: '',
			content: '',
			subforum: 'none',
			category: 'none',
			folderId: 'none',
		},
	})

	// Watch form values
	const title = form.watch('title')
	const content = form.watch('content')
	const category = form.watch('category')
	const isDirty = form.formState.isDirty

	// Refs
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const previewRef = useRef<HTMLDivElement>(null)
	const editorContainerRef = useRef<HTMLDivElement>(null)
	// Track the last value typed by user to detect external changes
	const lastTypedValueRef = useRef<string>(content)

	// Sync textarea when content changes externally (toolbar, templates, etc.)
	useEffect(() => {
		if (textareaRef.current && content !== lastTypedValueRef.current) {
			// Content changed externally - update textarea
			textareaRef.current.value = content
			lastTypedValueRef.current = content
		}
	}, [content])

	// Local state
	const [showPreview, setShowPreview] = useState(true)
	const [copied, setCopied] = useState(false)
	const [activeFormats, setActiveFormats] = useState<string[]>([])
	const [isTableAtCursor, setIsTableAtCursor] = useState(false)
	const [tableEditData, setTableEditData] = useState<TableEditData | null>(null)

	// Centralized dialog management
	const dialogs = useDialogManager()

	// Settings
	const { boldColor } = useSettingsStore()

	// Custom hooks
	const draftEditor = useDraftEditor({ docType, form })

	// Check active formats at cursor
	const checkActiveFormats = useCallback(() => {
		if (!textareaRef.current) return
		const text = textareaRef.current.value
		const cursorPos = textareaRef.current.selectionStart
		const formats = getActiveFormats(text, cursorPos)
		setActiveFormats(formats)
	}, [])

	// Initialize text editor hook
	const editor = useTextEditor({
		value: content,
		onChange: newContent => {
			form.setValue('content', newContent, { shouldDirty: true })
		},
		textareaRef,
		shortcuts: false, // Disabled to avoid cursor jumping issues
		buttons: DEFAULT_TOOLBAR_BUTTONS,
		onAction: dialogId => {
			const tableData = handlers.handleDialog(dialogId)
			if (dialogId === 'table') {
				setTableEditData(tableData)
			}
		},
	})

	// Editor handlers hook
	const handlers = useEditorHandlers({
		form,
		textareaRef,
		previewRef,
		editor: {
			insertAtCursor: editor.insertAtCursor,
			wrapSelection: editor.wrapSelection,
			executeAction: editor.executeAction,
			getSelection: editor.getSelection,
			replaceSelection: editor.replaceSelection,
		},
		dialogs: {
			open: dialogs.open,
			close: dialogs.close,
		},
		checkActiveFormats,
	})

	// Slash command hook for /shortcut template insertion
	const slashCommand = useSlashCommand({
		textareaRef,
		value: content,
		onInsert: data => {
			form.setValue('content', data.newValue, { shouldDirty: true })

			if (data.title && !title.trim()) {
				form.setValue('title', data.title, { shouldDirty: true })
			}
			if (data.subforum && form.watch('subforum') === 'none') {
				form.setValue('subforum', data.subforum, { shouldDirty: true })
			}
			if (data.category && form.watch('category') === 'none') {
				form.setValue('category', data.category, { shouldDirty: true })
			}

			requestAnimationFrame(() => {
				if (textareaRef.current) {
					textareaRef.current.selectionStart = data.cursorPos
					textareaRef.current.selectionEnd = data.cursorPos
					textareaRef.current.focus()
				}
			})
		},
	})

	// Upload state management
	const upload = useUploadState({
		dialogs,
		onInsertImage: bbcode => editor.insertAtCursor(bbcode),
	})

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 's') {
				e.preventDefault()
				if (content.trim() && !draftEditor.saving) {
					document.getElementById('draft-save-button')?.click()
				}
			}

			if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
				e.preventDefault()
				setShowPreview(prev => !prev)
			}

			if (e.key === 'Escape') {
				if (slashCommand.state?.isActive) {
					e.preventDefault()
					slashCommand.close()
					return
				}
				if (dialogs.isOpen('dropzone') && upload.isUploading) {
					return
				}
				if (dialogs.activeDialog) {
					dialogs.close()
				}
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [content, draftEditor.saving, dialogs, upload.isUploading, slashCommand])

	// Drag & Drop handlers
	const handleDragLeave = useCallback((e: React.DragEvent) => upload.handleDragLeave(e, editorContainerRef), [upload])

	// Copy handler
	const handleCopy = async () => {
		if (!content.trim()) return
		try {
			await navigator.clipboard.writeText(content)
			setCopied(true)
			toast.success('Contenido copiado')
			setTimeout(() => setCopied(false), 2000)
		} catch {
			toast.error('Error al copiar')
		}
	}

	// Clear handler
	const handleClear = () => {
		if (content) {
			dialogs.open('clear')
		}
	}

	const handleClearConfirm = () => {
		form.setValue('content', '')
		dialogs.close()
	}

	// Update table cursor state
	const updateCursorState = useCallback(() => {
		handlers.handleSyncScroll()
		setIsTableAtCursor(handlers.checkTableAtCursor())
		checkActiveFormats()
		slashCommand.checkForCommand()
	}, [handlers, checkActiveFormats, slashCommand])

	return (
		<div className="flex flex-col h-[calc(100vh-8rem)]">
			{/* Top Header Bar */}
			<div className="flex items-center justify-between pb-4 shrink-0 w-full max-w-[1368px] mx-auto">
				<div className="flex items-center gap-3">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => navigate(docType === 'template' ? '/templates' : '/drafts')}
						className="shrink-0"
					>
						<ChevronLeft className="h-5 w-5" />
					</Button>
					<div className="flex items-center gap-3">
						<div>
							<h1 className="text-2xl font-bold tracking-tight">
								{docType === 'template'
									? draftEditor.isEditing
										? 'Editar Plantilla'
										: 'Nueva Plantilla'
									: draftEditor.isEditing
									? 'Editar Borrador'
									: 'Nuevo Borrador'}
							</h1>
							<p className="text-sm text-muted-foreground">
								{docType === 'template'
									? draftEditor.isEditing
										? 'Modifica tu plantilla guardada.'
										: 'Crea una nueva plantilla reutilizable.'
									: draftEditor.isEditing
									? 'Modifica tu borrador guardado.'
									: 'Crea un nuevo borrador de texto.'}
							</p>
						</div>
						{docType === 'template' && (
							<Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-2 border-amber-500/40 hover:bg-amber-500/30 font-bold px-3 py-1">
								✨ PLANTILLA
							</Badge>
						)}
					</div>
				</div>

				<div className="flex items-center gap-2">
					{draftEditor.error && <span className="text-sm text-destructive">{draftEditor.error}</span>}

					<Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} className="gap-2 px-3 h-9">
						{showPreview ? (
							<>
								<EyeOff className="h-4 w-4" />
								<span className="hidden sm:inline">Modo Enfoque</span>
							</>
						) : (
							<>
								<Eye className="h-4 w-4" />
								<span className="hidden sm:inline">Mostrar vista previa</span>
							</>
						)}
					</Button>

					{draftEditor.isEditing && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								form.reset({
									title: '',
									content: '',
									subforum: 'none',
									category: 'none',
									folderId: 'none',
									trigger: '',
								})
								navigate(docType === 'template' ? '/templates/new' : '/drafts/new')
							}}
							className="gap-2 px-3 h-9"
							title={docType === 'template' ? 'Crear nueva plantilla' : 'Crear nuevo borrador'}
						>
							<Plus className="h-4 w-4" />
							<span className="hidden sm:inline">Nuevo</span>
						</Button>
					)}

					<Button
						variant="outline"
						onClick={() => navigate(docType === 'template' ? '/templates' : '/drafts')}
						className="h-9"
					>
						Cancelar
					</Button>
					<Button
						id="draft-save-button"
						onClick={draftEditor.handleSubmit}
						disabled={draftEditor.saving || !content.trim()}
						className="h-9 min-w-40 relative overflow-hidden"
					>
						<span
							className={cn(
								'flex items-center justify-center transition-all duration-200',
								draftEditor.saving ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
							)}
						>
							<Save className="h-4 w-4 mr-2" />
							{docType === 'template'
								? draftEditor.isEditing
									? 'Guardar plantilla'
									: 'Crear plantilla'
								: draftEditor.isEditing
								? 'Guardar cambios'
								: 'Guardar borrador'}
						</span>

						{draftEditor.saving && (
							<span className="absolute inset-0 flex items-center justify-center animate-in fade-in zoom-in-95 duration-200">
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								{draftEditor.isEditing ? 'Guardando...' : 'Creando...'}
							</span>
						)}
					</Button>
				</div>
			</div>

			{/* Split View - 2 Columns */}
			<div className="flex flex-row justify-center flex-1 min-h-0">
				{/* Left Panel: Editor */}
				<div
					className={cn(
						'flex flex-col h-full min-h-0 bg-card border rounded-l-lg overflow-hidden shadow-sm transition-all duration-300 ease-in-out',
						showPreview ? 'flex-1 border-border rounded-r-none' : 'flex-1 max-w-[900px] rounded-lg mx-auto'
					)}
				>
					{/* Editor Header */}
					<EditorHeader
						docType={docType}
						isEditing={draftEditor.isEditing}
						form={form}
						folders={draftEditor.folders}
						onOpenFolderDialog={() => dialogs.open('folder')}
					/>

					{/* Editor Toolbar */}
					<SharedEditorToolbar
						onAction={buttonId => handlers.handleToolbarAction(buttonId, activeFormats)}
						onDialog={dialogId => {
							const tableData = handlers.handleDialog(dialogId)
							if (dialogId === 'table') {
								setTableEditData(tableData)
							}
						}}
						onInsertSnippet={handlers.handleInsertSnippet}
						onWrapSelection={handlers.handleWrapSelection}
						onInsertList={handlers.handleInsertList}
						buttons={DEFAULT_TOOLBAR_BUTTONS}
						snippets={[]}
						showHistory={true}
						canUndo={editor.canUndo}
						canRedo={editor.canRedo}
						className="sticky top-0 z-40 rounded-none"
						isTableAtCursor={isTableAtCursor}
						onInsertEmoji={handlers.handleInsertEmoji}
						onInsertGif={handlers.handleInsertGif}
						onInsertTemplate={() => dialogs.open('template')}
						activeFormats={activeFormats}
						onReplaceText={editor.replaceSelection}
						onGetSelection={() => editor.getSelection().text}
						onGetFullContent={() => content}
						onReplaceAll={text => form.setValue('content', text)}
						documentTitle={title}
					/>

					{/* Editor Textarea Container */}
					<div
						ref={editorContainerRef}
						className="flex-1 min-h-0 relative group"
						onDragEnter={upload.handleDragEnter}
						onDragLeave={handleDragLeave}
						onDragOver={upload.handleDragOver}
						onDrop={upload.handleDrop}
					>
						{/* Floating Copy Button */}
						<div className="absolute top-4 right-4 z-10">
							<Button
								variant="secondary"
								size="icon"
								onClick={handleCopy}
								disabled={!content.trim()}
								className={cn(
									'h-8 w-8 rounded-md shadow-md border opacity-0 group-hover:opacity-100 transition-opacity duration-200',
									copied
										? 'bg-green-500/10 border-green-500/50 text-green-500'
										: 'bg-background/80 hover:bg-background backdrop-blur-sm'
								)}
							>
								{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
							</Button>
						</div>

							{/* Textarea - Uncontrolled to preserve cursor position */}
							<textarea
								ref={el => {
									// @ts-ignore
									textareaRef.current = el
									editor.registerTextarea(el)
								}}
								defaultValue={content}
								onInput={e => {
									const target = e.target as HTMLTextAreaElement
									lastTypedValueRef.current = target.value
									form.setValue('content', target.value, { shouldDirty: true })
								}}
								onPaste={handlers.handlePaste}
								onClick={() => {
									checkActiveFormats()
									setIsTableAtCursor(handlers.checkTableAtCursor())
								}}
								onKeyUp={() => {
									slashCommand.checkForCommand()
									checkActiveFormats()
									setIsTableAtCursor(handlers.checkTableAtCursor())
								}}
								placeholder={docType === 'template' ? 'Escribe tu plantilla aquí...' : 'Escribe tu borrador aquí...'}
								className="absolute inset-0 w-full h-full resize-none p-4 bg-transparent border-none focus:ring-0 focus:outline-none text-sm font-sans leading-relaxed overflow-y-auto custom-scroll"
								spellCheck={false}
							/>

						{/* Dropzone Overlay */}
						{dialogs.isOpen('dropzone') && (
							<div
								className="absolute inset-0 z-50 flex items-center justify-center p-4"
								style={{
									backgroundColor: upload.isDraggingOver ? 'rgba(139, 92, 246, 0.1)' : 'rgba(0, 0, 0, 0.7)',
									backdropFilter: 'blur(2px)',
								}}
							>
								<div className="w-full max-w-sm">
									<ImageDropzone
										isOpen={dialogs.isOpen('dropzone')}
										onClose={() => {
											if (!upload.isUploading) {
												dialogs.close()
											}
										}}
										onFilesSelect={upload.handleFilesSelect}
										isUploading={upload.isUploading}
										uploadProgress={upload.uploadProgress}
									/>
								</div>
							</div>
						)}

						{/* Slash Command Popover */}
						{slashCommand.state?.isActive && (
							<SlashCommandPopover
								state={slashCommand.state}
								onSelect={slashCommand.selectTemplate}
								onClose={slashCommand.close}
								onSelectedIndexChange={slashCommand.setSelectedIndex}
								textareaRef={textareaRef}
							/>
						)}
					</div>

					{/* Footer */}
					<EditorFooter
						content={content}
						lastSavedAt={draftEditor.lastSavedAt}
						isDirty={isDirty}
						onClear={handleClear}
					/>
				</div>

				{/* Right Panel: Preview */}
				<PreviewPanel
					content={content}
					boldColor={boldColor}
					theme={theme === 'system' ? undefined : theme}
					showPreview={showPreview}
					previewRef={previewRef}
				/>
			</div>

			{/* All Dialogs */}
			<EditorDialogs
				docType={docType}
				dialogs={dialogs}
				apiKeyValue={upload.apiKeyValue}
				onApiKeyChange={upload.setApiKeyValue}
				onApiKeySave={upload.saveApiKey}
				tableEditData={tableEditData}
				onClearTableEditData={() => setTableEditData(null)}
				onInsertTable={markdown => {
					handlers.handleInsertTable(markdown, tableEditData)
					setTableEditData(null)
				}}
				onInsertUrl={handlers.handleInsertUrl}
				onInsertPoll={handlers.handleInsertPoll}
				onInsertMovieTemplate={handlers.handleInsertMovieTemplate}
				onInsertIndex={handlers.handleInsertIndex}
				onCreateFolder={async (name, icon, type) => {
					await draftEditor.handleCreateFolder(name, icon, type)
					dialogs.close()
				}}
				onClearConfirm={handleClearConfirm}
				title={title}
				category={category}
				onInsertTemplateContent={(insertContent, insertTitle, insertCategory) => {
					editor.insertAtCursor(insertContent)
					if (insertTitle && !title.trim()) {
						form.setValue('title', insertTitle, { shouldDirty: true })
					}
					if (insertCategory && category === 'none') {
						form.setValue('category', insertCategory, { shouldDirty: true })
					}
				}}
			/>
		</div>
	)
}
