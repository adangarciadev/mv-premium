/**
 * Draft Editor View - Full Page Editor for Drafts
 * Refactored to use extracted hooks and components
 */

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left'
import Save from 'lucide-react/dist/esm/icons/save'
import Eye from 'lucide-react/dist/esm/icons/eye'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Send from 'lucide-react/dist/esm/icons/send'
import { toast } from 'sonner'
import { useSettingsStore } from '@/store/settings-store'
import { useTheme } from '@/providers/theme-provider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SharedEditorToolbar } from '@/components/editor'
import { DEFAULT_TOOLBAR_BUTTONS } from '@/types/editor'
import { SlashCommandPopover } from '@/features/drafts/components/slash-command-popover'
import { useSlashCommand } from '@/features/drafts/hooks'
import {
	getDashboardThreadPublishValidationError,
	openDashboardThreadPublish,
	type DashboardThreadPublishMode,
} from '@/features/drafts/logic/thread-publish'
import type { Draft } from '@/features/drafts/storage'
import { cn } from '@/lib/utils'

// Local modules
import { draftFormSchema, type DraftFormData, type DraftEditorViewProps } from './types'
import { useDraftEditor } from './use-draft-editor'
import { EditorHeader } from './editor-header'
import { EditorFooter } from './editor-footer'
import { PreviewPanel } from './preview-panel'
import { EditorDialogs } from './editor-dialogs'

// Refactored Imports
import { useFullPageEditor } from '@/hooks/use-full-page-editor'
import { FullPageEditorLayout } from '@/components/layouts/full-page-editor-layout'
import { SharedEditorStack } from '@/components/editor/shared-editor-stack'
import { PublishDraftDialog } from '../drafts-view/drafts-dialogs'

export function DraftEditorView({ docType = 'draft' }: DraftEditorViewProps) {
	const navigate = useNavigate()
	const { id } = useParams<{ id: string }>()
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

	// Local state
	const [showPreview, setShowPreview] = useState(true)
	const [pendingPublishDraft, setPendingPublishDraft] = useState<Draft | null>(null)
	const [publishDialogOpen, setPublishDialogOpen] = useState(false)

	// Settings
	const { boldColor } = useSettingsStore()

	// Custom hooks
	const draftEditor = useDraftEditor({ docType, form })

	// Refactored Editor Hook
	const { editor, handlers, upload, dialogs, refs, state, actions } = useFullPageEditor({
		value: content,
		onChange: newContent => {
			form.setValue('content', newContent, { shouldDirty: true })
		},
	})

	// Slash command hook for /shortcut template insertion
	const slashCommand = useSlashCommand({
		textareaRef: refs.textarea,
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
				if (refs.textarea.current) {
					refs.textarea.current.selectionStart = data.cursorPos
					refs.textarea.current.selectionEnd = data.cursorPos
					refs.textarea.current.focus()
				}
			})
		},
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

	// Sync slash command check
	const updateCursorState = () => {
		actions.updateCursorState()
		slashCommand.checkForCommand()
	}

	// Handle saving wrapper
	const handleSave = () => {
		draftEditor.handleSubmit()
	}

	const buildCurrentDraftSnapshot = (): Draft => {
		const values = form.getValues()
		const now = Date.now()
		return {
			id: id ? decodeURIComponent(id) : `dashboard-${docType}-${now}`,
			title: values.title,
			content: values.content,
			type: docType,
			subforum: values.subforum === 'none' ? undefined : values.subforum,
			category: values.category === 'none' ? undefined : values.category,
			folderId: values.folderId === 'none' ? undefined : values.folderId,
			trigger: docType === 'template' ? values.trigger || undefined : undefined,
			createdAt: now,
			updatedAt: now,
		}
	}

	const startPublishFlow = async (draft: Draft, mode: DashboardThreadPublishMode) => {
		try {
			await openDashboardThreadPublish(draft, mode)
			toast.success(mode === 'dry-run' ? 'Modo prueba abierto' : 'Publicación enviada a Mediavida', {
				description:
					mode === 'dry-run'
						? 'Se rellenará el nuevo hilo sin pulsar Crear tema.'
						: 'Se abrirá Mediavida y se pulsará Crear tema automáticamente.',
			})
		} catch (error) {
			toast.error('No se puede publicar', {
				description: error instanceof Error ? error.message : 'Revisa los datos del borrador.',
			})
		}
	}

	const handlePublishRequest = async (mode: DashboardThreadPublishMode) => {
		const draft = buildCurrentDraftSnapshot()
		const validationError = getDashboardThreadPublishValidationError(draft)
		if (validationError) {
			toast.error('No se puede publicar', { description: validationError })
			return
		}

		if (mode === 'dry-run') {
			await startPublishFlow(draft, mode)
			return
		}

		setPendingPublishDraft(draft)
		setPublishDialogOpen(true)
	}

	const handlePublishConfirm = async () => {
		if (!pendingPublishDraft) return
		const draft = pendingPublishDraft
		setPublishDialogOpen(false)
		setPendingPublishDraft(null)
		await startPublishFlow(draft, 'publish')
	}

	return (
		<>
			<FullPageEditorLayout
				showPreview={showPreview}
				header={
					<div className="flex items-center justify-between w-full">
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

							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowPreview(!showPreview)}
								className="gap-2 px-3 h-9"
							>
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

							<Button
								variant="outline"
								size="sm"
								onClick={() => void handlePublishRequest('dry-run')}
								className="gap-2 px-3 h-9"
								title="Abrir Mediavida y rellenar sin publicar"
							>
								<Eye className="h-4 w-4" />
								<span className="hidden sm:inline">Probar MV</span>
							</Button>

							<Button
								variant="outline"
								size="sm"
								onClick={() => void handlePublishRequest('publish')}
								className="gap-2 px-3 h-9"
								title="Abrir Mediavida y publicar automáticamente"
							>
								<Send className="h-4 w-4" />
								<span className="hidden sm:inline">Publicar</span>
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
								onClick={handleSave}
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
				}
				editorStack={
					<>
						{/* Editor Header (Title, etc) - Inside the stack but above toolbar? No, typically above toolbar in design. */}
						<EditorHeader
							docType={docType}
							isEditing={draftEditor.isEditing}
							form={form}
							folders={draftEditor.folders}
							onOpenFolderDialog={() => dialogs.open('folder')}
						/>

						<SharedEditorStack
							toolbar={
								<SharedEditorToolbar
									onAction={(buttonId: string) => handlers.handleToolbarAction(buttonId, state.activeFormats)}
									onDialog={(dialogId: string) => {
										const tableData = handlers.handleDialog(dialogId)
										if (dialogId === 'table') {
											state.setTableEditData(tableData)
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
									isTableAtCursor={state.isTableAtCursor}
									onInsertEmoji={handlers.handleInsertEmoji}
									onInsertGif={handlers.handleInsertGif}
									onInsertTemplate={() => dialogs.open('template')}
									activeFormats={state.activeFormats}
									onReplaceText={editor.replaceSelection}
									onGetSelection={() => editor.getSelection().text}
									onGetFullContent={() => content}
									onReplaceAll={(text: string) => form.setValue('content', text)}
									documentTitle={title}
								/>
							}
							textareaRef={refs.textarea}
							containerRef={refs.container}
							footer={
								<EditorFooter
									content={content}
									lastSavedAt={draftEditor.lastSavedAt}
									isDirty={isDirty}
									onClear={() => {
										if (content) dialogs.open('clear')
									}}
								/>
							}
							value={content}
							onInput={val => form.setValue('content', val, { shouldDirty: true })}
							placeholder={docType === 'template' ? 'Escribe tu plantilla aquí...' : 'Escribe tu borrador aquí...'}
							onPaste={actions.handlePaste}
							onCopy={actions.handleCopy}
							onCursorChange={updateCursorState}
							onDragEnter={upload.handleDragEnter}
							onDragLeave={actions.handleDragLeave}
							onDragOver={upload.handleDragOver}
							onDrop={upload.handleDrop}
							isCopied={state.copied}
							isUploading={upload.isUploading}
							isDraggingOver={upload.isDraggingOver}
							uploadProgress={upload.uploadProgress}
							showDropzone={dialogs.isOpen('dropzone')}
							onDropzoneClose={() => {
								if (!upload.isUploading) {
									dialogs.close()
								}
							}}
							onFilesSelect={upload.handleFilesSelect}
						>
							{slashCommand.state?.isActive && (
								<SlashCommandPopover
									state={slashCommand.state}
									onSelect={slashCommand.selectTemplate}
									onClose={slashCommand.close}
									onSelectedIndexChange={slashCommand.setSelectedIndex}
									textareaRef={refs.textarea}
								/>
							)}
						</SharedEditorStack>
					</>
				}
				previewPanel={
					<PreviewPanel
						content={content}
						boldColor={boldColor}
						theme={theme === 'system' ? undefined : theme}
						showPreview={true}
						previewRef={refs.preview}
						badgeTone="neutral"
					/>
				}
			/>

			{/* All Dialogs */}
			<EditorDialogs
				docType={docType}
				dialogs={dialogs}
				apiKeyValue={upload.apiKeyValue}
				onApiKeyChange={upload.setApiKeyValue}
				onApiKeySave={upload.saveApiKey}
				tableEditData={state.tableEditData}
				onClearTableEditData={() => state.setTableEditData(null)}
				onInsertTable={markdown => {
					handlers.handleInsertTable(markdown, state.tableEditData)
					state.setTableEditData(null)
				}}
				onInsertUrl={handlers.handleInsertUrl}
				onInsertPoll={handlers.handleInsertPoll}
				onInsertMovieTemplate={handlers.handleInsertMovieTemplate}
				onInsertGameTemplate={handlers.handleInsertGameTemplate}
				onInsertIndex={handlers.handleInsertIndex}
				onCreateFolder={async (name, icon, type) => {
					await draftEditor.handleCreateFolder(name, icon, type)
					dialogs.close()
				}}
				onClearConfirm={() => {
					form.setValue('content', '')
					dialogs.close()
				}}
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

			<PublishDraftDialog
				open={publishDialogOpen}
				onOpenChange={open => {
					setPublishDialogOpen(open)
					if (!open) setPendingPublishDraft(null)
				}}
				draft={pendingPublishDraft}
				onConfirm={handlePublishConfirm}
			/>
		</>
	)
}
