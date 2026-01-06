/**
 * useDraftEditor Hook
 * Manages draft/template loading, saving, and autosave logic
 */

import { useState, useEffect, useCallback } from 'react'
import { logger } from '@/lib/logger'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { getCategoriesForSubforum } from '@/lib/subforum-categories'
import {
	type DraftFolder,
	getDraft,
	createDraft,
	updateDraft,
	getFolders,
	createFolder,
} from '@/features/drafts/storage'
import type { UseDraftEditorOptions, DraftFormData } from './types'

// Autosave configuration
const AUTOSAVE_DELAY = 3000

interface UseDraftEditorReturn {
	// State
	folders: DraftFolder[]
	saving: boolean
	error: string | null
	lastSavedAt: Date | null
	isEditing: boolean

	// Actions
	handleSubmit: () => Promise<void>
	handleCreateFolder: (name: string, icon: string, type: 'draft' | 'template') => Promise<void>
	setError: (error: string | null) => void
}

export function useDraftEditor({ docType, form }: UseDraftEditorOptions): UseDraftEditorReturn {
	const { id } = useParams<{ id: string }>()
	const navigate = useNavigate()
	const isEditing = Boolean(id)

	// State
	const [folders, setFolders] = useState<DraftFolder[]>([])
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

	// Watch form values for autosave
	const title = form.watch('title')
	const trigger = form.watch('trigger')
	const content = form.watch('content')
	const subforum = form.watch('subforum')
	const category = form.watch('category')
	const folderId = form.watch('folderId')
	const isDirty = form.formState.isDirty

	// Load folders on mount
	useEffect(() => {
		const loadData = async () => {
			try {
				const foldersData = await getFolders()
				setFolders(Array.isArray(foldersData) ? foldersData : [])
			} catch (err) {
				logger.error('Error loading draft editor data:', err)
				setFolders([])
			}
		}
		void loadData()
	}, [])

	// Load existing draft if editing
	useEffect(() => {
		if (id) {
			const loadDraft = async () => {
				const decodedId = decodeURIComponent(id)
				const draft = await getDraft(decodedId)
				if (draft) {
					form.setValue('title', draft.title || '')
					form.setValue('content', draft.content || '')
					form.setValue('subforum', draft.subforum || 'none')
					form.setValue('category', draft.category || 'none')
					form.setValue('folderId', draft.folderId || 'none')
					form.setValue('trigger', draft.trigger || '')
				} else {
					toast.error('Borrador no encontrado')
					navigate(docType === 'template' ? '/templates' : '/drafts')
				}
			}
			void loadDraft()
		}
	}, [id, navigate, docType, form])

	// Autosave logic
	useEffect(() => {
		if (!isDirty || !content.trim()) return

		const timer = setTimeout(async () => {
			try {
				const categories = subforum !== 'none' ? getCategoriesForSubforum(subforum) : []
				const selectedCat = categories.find(c => c.value === category)

				const draftData = {
					title: title.trim(),
					content,
					type: docType,
					subforum: subforum === 'none' ? undefined : subforum,
					category: category === 'none' ? undefined : category,
					categoryLabel: selectedCat?.label,
					folderId: folderId === 'none' ? undefined : folderId,
					trigger: docType === 'template' ? trigger.trim() || undefined : undefined,
				}

				if (isEditing && id) {
					const decodedId = decodeURIComponent(id)
					await updateDraft(decodedId, draftData)
					setLastSavedAt(new Date())
					form.reset(form.getValues())
				}
			} catch (err) {
				logger.error('Draft autosave error:', err)
			}
		}, AUTOSAVE_DELAY)

		return () => clearTimeout(timer)
	}, [content, title, subforum, category, folderId, trigger, isDirty, isEditing, id, docType, form])

	// Submit handler
	const handleSubmit = useCallback(async () => {
		if (!content.trim()) {
			setError('El contenido es obligatorio')
			return
		}

		setSaving(true)
		setError(null)

		try {
			const categories = subforum !== 'none' ? getCategoriesForSubforum(subforum) : []
			const selectedCat = categories.find(c => c.value === category)

			const draftData = {
				title: title.trim(),
				content,
				type: docType,
				subforum: subforum === 'none' ? undefined : subforum,
				category: category === 'none' ? undefined : category,
				categoryLabel: selectedCat?.label,
				folderId: folderId === 'none' ? undefined : folderId,
				trigger: docType === 'template' ? trigger.trim() || undefined : undefined,
			}

			if (isEditing && id) {
				const decodedId = decodeURIComponent(id)
				await updateDraft(decodedId, draftData)
			} else {
				const newDraft = await createDraft(draftData)
				const basePath = docType === 'template' ? '/templates' : '/drafts'
				navigate(`${basePath}/edit/${encodeURIComponent(newDraft.id)}`, { replace: true })
			}

			setLastSavedAt(new Date())
			form.reset(form.getValues())

			const message =
				docType === 'template'
					? isEditing
						? 'Plantilla guardada'
						: 'Plantilla creada'
					: isEditing
					? 'Borrador guardado'
					: 'Borrador creado'

			toast.success(message, { description: title || 'Sin título' })
		} catch (err) {
			logger.error('Error saving draft:', err)
			setError('Error al guardar')
		} finally {
			setSaving(false)
		}
	}, [content, title, subforum, category, folderId, trigger, docType, isEditing, id, navigate, form])

	// Create folder handler
	const handleCreateFolder = useCallback(
		async (name: string, icon: string, type: 'draft' | 'template') => {
			if (!name.trim()) return

			try {
				const folder = await createFolder({
					name: name.trim(),
					icon: icon || 'lucide:folder',
					type: type || docType,
				})

				const foldersData = await getFolders()
				setFolders(foldersData)
				form.setValue('folderId', folder.id)

				toast.success('Carpeta creada', { description: folder.name })
			} catch {
				toast.error('Error al crear carpeta')
			}
		},
		[docType, form]
	)

	return {
		folders,
		saving,
		error,
		lastSavedAt,
		isEditing,
		handleSubmit,
		handleCreateFolder,
		setError,
	}
}
