import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { logger } from '@/lib/logger'
import { DraftStatus, DraftStatusType } from './draft-status'
import { createDraft, getDrafts, updateDraft, type Draft } from '@/features/drafts/storage'
import { registerDirtyChecker } from '@/features/drafts/logic/beforeunload-manager'
import { DraftsList } from './drafts-list'
import { SlashCommandPopover } from './slash-command-popover'
import { useSlashCommand } from '../hooks/use-slash-command'
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { MV_SELECTORS, DOM_MARKERS } from '@/constants'
import { useSettingsStore } from '@/store/settings-store'
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface DraftManagerProps {
	textarea: HTMLTextAreaElement
}

/**
 * Extracts current draft metadata from the page (title, subforum, category).
 * Used to match existing drafts and create new ones.
 */
function extractDraftMetadata(): {
	title: string
	subforum: string | undefined
	category: string | undefined
	categoryLabel: string | undefined
} {
	const pathMatch = window.location.pathname.match(/^\/foro\/([^/]+)/)
	const subforum = pathMatch ? pathMatch[1] : undefined

	let title = ''
	let category: string | undefined
	let categoryLabel: string | undefined

	if (window.location.pathname.includes('/nuevo-hilo')) {
		const titleInput = document.querySelector<HTMLInputElement>(MV_SELECTORS.EDITOR.TITLE_INPUT)
		title = titleInput?.value.trim() || ''

		const categorySelect = document.querySelector<HTMLSelectElement>(MV_SELECTORS.EDITOR.CATEGORY_SELECT)
		if (categorySelect?.value && categorySelect.value !== '0') {
			category = categorySelect.value
			const selectedOption = categorySelect.options[categorySelect.selectedIndex]
			categoryLabel = selectedOption?.text?.trim() || selectedOption?.textContent?.trim()
		}
	}

	return { title, subforum, category, categoryLabel }
}

/**
 * Finds an existing draft that matches the current page context.
 * Matches by subforum for reply pages, or by subforum + similar title for nuevo-hilo.
 */
async function findMatchingDraft(): Promise<Draft | null> {
	const { subforum } = extractDraftMetadata()
	const path = window.location.pathname

	// Get all dashboard drafts (excluding templates)
	const allDrafts = await getDrafts()
	const drafts = allDrafts.filter(d => d.type === 'draft' && !d.id.startsWith('autosave-'))

	if (path.includes('/nuevo-hilo')) {
		// For nuevo-hilo, match by subforum only (most recent)
		return drafts.find(d => d.subforum === subforum) || null
	} else if (path.includes('/responder') || path.match(/^\/foro\/[^/]+\/[^/]+/)) {
		// For reply pages, match by subforum
		return drafts.find(d => d.subforum === subforum && !d.title) || null
	}

	return null
}

/**
 * DraftManager component - Handles manual draft saving for a textarea.
 * No auto-save - only saves when user explicitly clicks "Guardar borrador".
 */
export function DraftManager({ textarea }: DraftManagerProps) {
	const [status, setStatus] = useState<DraftStatusType>('idle')
	const [lastSaved, setLastSaved] = useState<number | undefined>(undefined)
	const [show, setShow] = useState(false)
	const [isListOpen, setIsListOpen] = useState(false)
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
	const initialContentRef = useRef<string>('')
	const isSubmittingRef = useRef<boolean>(false)
	// Track the draft ID if we're editing an existing draft
	const currentDraftIdRef = useRef<string | null>(null)

	// Get template button setting
	const templateButtonEnabled = useSettingsStore(s => s.templateButtonEnabled)

	// State for restore confirmation dialog
	const [confirmRestore, setConfirmRestore] = useState<{
		open: boolean
		pendingData: { content: string; title?: string; category?: string } | null
	}>({ open: false, pendingData: null })

	// State for save confirmation dialog (when draft already exists)
	const [confirmSave, setConfirmSave] = useState<{
		open: boolean
		pendingContent: string
		existingDraftId: string
	}>({ open: false, pendingContent: '', existingDraftId: '' })

	// Create a ref for the textarea to use with useSlashCommand
	const textareaRef = useRef<HTMLTextAreaElement>(textarea)

	// Update ref when textarea changes
	useEffect(() => {
		textareaRef.current = textarea
	}, [textarea])

	// Slash command for template insertion
	const slashCommand = useSlashCommand({
		textareaRef,
		onInsert: data => {
			// Update textarea directly (uncontrolled mode for native textareas)
			textarea.value = data.newValue
			textarea.selectionStart = data.cursorPos
			textarea.selectionEnd = data.cursorPos
			textarea.dispatchEvent(new Event('input', { bubbles: true }))
			textarea.focus()

			// Apply title to #cabecera input (only on nuevo-hilo pages) if empty
			if (data.title) {
				const titleInput = document.querySelector<HTMLInputElement>(MV_SELECTORS.EDITOR.TITLE_INPUT)
				if (titleInput && !titleInput.value.trim()) {
					titleInput.value = data.title
					titleInput.dispatchEvent(new Event('input', { bubbles: true }))
				}
			}

			// Apply category to #tag select (only on nuevo-hilo pages) if not selected
			if (data.category) {
				const categorySelect = document.querySelector<HTMLSelectElement>(MV_SELECTORS.EDITOR.CATEGORY_SELECT)
				if (categorySelect) {
					// Only apply if no category is selected (value is empty or "0")
					const isUnselected = !categorySelect.value || categorySelect.value === '' || categorySelect.value === '0'
					if (isUnselected) {
						// Verify the category exists as an option in the current select
						const optionExists = Array.from(categorySelect.options).some(opt => opt.value === data.category)
						if (optionExists) {
							categorySelect.value = data.category
							categorySelect.dispatchEvent(new Event('change', { bubbles: true }))
						}
					}
				}
			}
		},
	})

	// Ref for checkForCommand to avoid stale closures in event listeners
	const checkForCommandRef = useRef(slashCommand.checkForCommand)

	// Keep the ref updated
	useEffect(() => {
		checkForCommandRef.current = slashCommand.checkForCommand
	}, [slashCommand.checkForCommand])

	// Save draft to dashboard storage
	const doSaveDraft = useCallback(async (content: string, draftIdToUpdate?: string) => {
		setStatus('saving')
		setShow(true)

		try {
			const { title, subforum, category, categoryLabel } = extractDraftMetadata()

			const draftData = {
				title: title || 'Borrador sin título',
				content,
				subforum,
				category,
				categoryLabel,
			}

			if (draftIdToUpdate) {
				// Update existing draft
				const updated = await updateDraft(draftIdToUpdate, draftData)

				if (updated) {
					currentDraftIdRef.current = draftIdToUpdate
				} else {
					// If update failed (e.g. deleted externally), create new draft
					const newDraft = await createDraft({
						...draftData,
						type: 'draft',
					})
					currentDraftIdRef.current = newDraft.id
				}
			} else {
				// Create new draft
				const newDraft = await createDraft({
					...draftData,
					type: 'draft',
				})
				currentDraftIdRef.current = newDraft.id
			}

			setLastSaved(Date.now())
			setStatus('saved')
			setHasUnsavedChanges(false)
			initialContentRef.current = content
		} catch (error) {
			logger.error('Error saving draft:', error)
			setStatus('idle')
		}
	}, [])

	// Manual save function
	const handleSaveDraft = useCallback(async () => {
		const content = textarea.value.trim()
		if (!content) return

		// If we're already editing a draft, update it directly
		if (currentDraftIdRef.current) {
			await doSaveDraft(content, currentDraftIdRef.current)
			return
		}

		// Check if there's an existing draft for this context
		const existingDraft = await findMatchingDraft()
		if (existingDraft) {
			// Show confirmation dialog
			setConfirmSave({ open: true, pendingContent: content, existingDraftId: existingDraft.id })
			return
		}

		// No existing draft, create new one
		await doSaveDraft(content)
	}, [textarea, doSaveDraft])

	useEffect(() => {
		// Store initial content
		initialContentRef.current = textarea.value

		// Setup Input Listener - Only track changes, check for slash commands
		const handleInput = () => {
			// Skip if we're in the process of submitting
			if (isSubmittingRef.current) return

			const currentContent = textarea.value.trim()
			const hasChanges = currentContent !== initialContentRef.current && currentContent !== ''
			setHasUnsavedChanges(hasChanges)

			// Reset draft ID if content is cleared.
			// This ensures that if the user starts writing again and saves,
			// the system will check for existing drafts and prompt to overwrite/create new.
			if (currentContent === '') {
				currentDraftIdRef.current = null
				setStatus('idle')
			}

			// Check for slash commands on each input (only if templates enabled)
			if (templateButtonEnabled) {
				checkForCommandRef.current()
			}
		}

		textarea.addEventListener('input', handleInput)

		// Setup keyup/click listeners for slash command detection (only if templates enabled)
		const handleKeyUpOrClick = () => {
			if (templateButtonEnabled) {
				checkForCommandRef.current()
			}
		}
		textarea.addEventListener('keyup', handleKeyUpOrClick)
		textarea.addEventListener('click', handleKeyUpOrClick)

		// Setup Submit Listener (mark as submitting)
		const form = textarea.form
		const markAsSubmitting = () => {
			// Mark as submitting to prevent beforeunload alert
			isSubmittingRef.current = true
			// Reset initial content to current content so beforeunload won't detect changes
			initialContentRef.current = textarea.value.trim()
			setHasUnsavedChanges(false)
			setStatus('idle')
			setShow(false)
		}
		const handleSubmit = () => {
			markAsSubmitting()
		}

		// Native preview modal uses an <a id="prsubmit">Editar</a> trigger that can bypass
		// form submit listeners in some browsers (notably Firefox).
		const handlePreviewModalSubmit = (event: MouseEvent) => {
			const target = event.target
			if (!(target instanceof Element)) return

			const isPreviewSubmitClick = Boolean(target.closest(MV_SELECTORS.GLOBAL.PREVIEW_SUBMIT_BUTTON))
			if (!isPreviewSubmitClick) return

			const currentContent = textarea.value.trim()
			const hasChanges = currentContent !== initialContentRef.current && currentContent !== ''
			if (!hasChanges) return

			markAsSubmitting()
		}

		if (form) {
			form.addEventListener('submit', handleSubmit)
		}
		document.addEventListener('click', handlePreviewModalSubmit, true)

		// Listen for custom event to open drafts list
		const handleOpenDrafts = () => {
			setIsListOpen(true)
		}
		textarea.addEventListener(DOM_MARKERS.EVENTS.OPEN_DRAFTS, handleOpenDrafts)

		// Listen for custom event to manually save draft
		const handleManualSave = () => {
			void handleSaveDraft()
		}
		textarea.addEventListener(DOM_MARKERS.EVENTS.SAVE_DRAFT, handleManualSave)

		// Register dirty checker with centralized beforeunload manager
		// NO auto-save on beforeunload - just warn the user
		const unregisterDirtyChecker = registerDirtyChecker(textarea, () => {
			// Skip if form is being submitted
			if (isSubmittingRef.current) return null

			const currentContent = textarea.value.trim()
			const hasChanges = currentContent !== initialContentRef.current && currentContent !== ''

			return {
				isDirty: hasChanges,
				content: currentContent,
				// No save function - we don't auto-save anymore
			}
		})

		return () => {
			textarea.removeEventListener('input', handleInput)
			textarea.removeEventListener('keyup', handleKeyUpOrClick)
			textarea.removeEventListener('click', handleKeyUpOrClick)
			if (form) {
				form.removeEventListener('submit', handleSubmit)
			}
			document.removeEventListener('click', handlePreviewModalSubmit, true)
			textarea.removeEventListener(DOM_MARKERS.EVENTS.OPEN_DRAFTS, handleOpenDrafts)
			textarea.removeEventListener(DOM_MARKERS.EVENTS.SAVE_DRAFT, handleManualSave)
			unregisterDirtyChecker()
		}
	}, [textarea, handleSaveDraft])

	useEffect(() => {
		if (status === 'saved' || status === 'restored') {
			const timer = setTimeout(() => {
				setShow(false)
				// Small delay to allow fade out animation to finish before removing content
				setTimeout(() => setStatus('idle'), 300)
			}, 3000)
			return () => clearTimeout(timer)
		}
	}, [status])

	// Called when user selects a draft to restore
	const handleRestoreDraft = async (data: { content: string; title?: string; category?: string; id?: string }) => {
		// If editor has content, show confirmation dialog
		if (textarea.value.trim() !== '') {
			setConfirmRestore({ open: true, pendingData: data })
			return
		}

		// Editor is empty, restore directly
		await applyDraftToEditor(data)
	}

	// Actually apply the draft content to the editor
	const applyDraftToEditor = async (data: { content: string; title?: string; category?: string; id?: string }) => {
		// 1. Apply content to textarea
		textarea.value = data.content
		textarea.dispatchEvent(new Event('input', { bubbles: true }))

		// 2. Apply title to #cabecera input (only on nuevo-hilo pages)
		if (data.title) {
			const titleInput = document.querySelector<HTMLInputElement>(MV_SELECTORS.EDITOR.TITLE_INPUT)
			if (titleInput) {
				titleInput.value = data.title
				titleInput.dispatchEvent(new Event('input', { bubbles: true }))
			}
		}

		// 3. Apply category to #tag select (only on nuevo-hilo pages)
		if (data.category) {
			const categorySelect = document.querySelector<HTMLSelectElement>(MV_SELECTORS.EDITOR.CATEGORY_SELECT)
			if (categorySelect) {
				categorySelect.value = data.category
				categorySelect.dispatchEvent(new Event('change', { bubbles: true }))
			}
		}

		// Track the draft ID so future saves update it
		if (data.id && !data.id.startsWith('autosave-')) {
			currentDraftIdRef.current = data.id
		}

		setStatus('restored')
		setShow(true)
		// Set initial content to loaded draft so dirty detection works correctly
		initialContentRef.current = data.content
		setHasUnsavedChanges(false)
	}

	// Handle confirmation dialog response
	const handleConfirmRestore = async () => {
		if (confirmRestore.pendingData) {
			await applyDraftToEditor(confirmRestore.pendingData)
		}
		setConfirmRestore({ open: false, pendingData: null })
	}

	// Find the inline status container created by save-draft-button-inject
	const statusContainer = document.getElementById(DOM_MARKERS.IDS.DRAFT_STATUS_CONTAINER)

	return (
		<>
			{/* Status indicator - portal to inline container if available */}
			{statusContainer &&
				createPortal(
					<div
						className={`inline-flex items-center pointer-events-auto transition-opacity duration-300 ${
							show ? 'opacity-100' : 'opacity-0 pointer-events-none'
						}`}
						style={{ height: '24px' }}
					>
						<DraftStatus status={status} lastSaved={lastSaved} />
					</div>,
					statusContainer
				)}

			<DraftsList isOpen={isListOpen} onClose={() => setIsListOpen(false)} onRestore={handleRestoreDraft} />

			{templateButtonEnabled && slashCommand.state?.isActive && slashCommand.state.matches.length > 0 && (
				<ShadowWrapper className="fixed inset-0 z-[99999] pointer-events-none">
					<SlashCommandPopover
						state={slashCommand.state}
						onSelect={slashCommand.selectTemplate}
						onClose={slashCommand.close}
						onSelectedIndexChange={slashCommand.setSelectedIndex}
						textareaRef={textareaRef}
					/>
				</ShadowWrapper>
			)}

			{/* Confirmation dialog for restoring draft over existing content */}
			{confirmRestore.open && (
				<ShadowWrapper className="fixed inset-0 z-[99999]">
					<AlertDialog
						open={confirmRestore.open}
						onOpenChange={open => !open && setConfirmRestore({ open: false, pendingData: null })}
					>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Reemplazar contenido</AlertDialogTitle>
								<AlertDialogDescription>
									El editor no está vacío. ¿Quieres reemplazar el contenido actual con el borrador seleccionado?
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancelar</AlertDialogCancel>
								<AlertDialogAction onClick={handleConfirmRestore}>Reemplazar</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</ShadowWrapper>
			)}

			{/* Confirmation dialog for saving when draft already exists */}
			{confirmSave.open && (
				<ShadowWrapper className="fixed inset-0 z-[99999]">
					<AlertDialog
						open={confirmSave.open}
						onOpenChange={open => !open && setConfirmSave({ open: false, pendingContent: '', existingDraftId: '' })}
					>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Ya existe un borrador</AlertDialogTitle>
								<AlertDialogDescription className="space-y-2">
									<span className="block">Ya tienes un borrador guardado para este subforo.</span>
									<span className="block font-medium">¿Qué quieres hacer?</span>
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter className="flex-col sm:flex-row gap-2">
								<AlertDialogCancel className="sm:mr-auto">Cancelar</AlertDialogCancel>
								<Button
									variant="outline"
									onClick={async () => {
										await doSaveDraft(confirmSave.pendingContent)
										setConfirmSave({ open: false, pendingContent: '', existingDraftId: '' })
									}}
								>
									Crear nuevo
								</Button>
								<Button
									onClick={async () => {
										await doSaveDraft(confirmSave.pendingContent, confirmSave.existingDraftId)
										setConfirmSave({ open: false, pendingContent: '', existingDraftId: '' })
									}}
								>
									Sobreescribir
								</Button>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</ShadowWrapper>
			)}
		</>
	)
}
