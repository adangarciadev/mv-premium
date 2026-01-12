/**
 * useUploadState - Centralized image upload state management
 *
 * Encapsulates all upload-related state and logic:
 * - Upload progress tracking
 * - Drag & drop state
 * - API key management
 * - File processing with validation
 */
import { useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import { uploadImage, getApiKey, validateImageFile } from '@/services/api/imgbb'
import { useSettingsStore } from '@/store/settings-store'
import type { UseDialogManagerReturn } from './use-dialog-manager'

export interface UseUploadStateOptions {
	/** Dialog manager for opening dropzone/apiKey dialogs */
	dialogs: UseDialogManagerReturn
	/** Callback to insert uploaded image URL into editor */
	onInsertImage: (bbcode: string) => void
}

export interface UseUploadStateReturn {
	/** Whether files are currently being uploaded */
	isUploading: boolean
	/** Upload progress percentage (0-100) */
	uploadProgress: number
	/** Whether user is dragging files over the dropzone */
	isDraggingOver: boolean
	/** Current API key value for the dialog */
	apiKeyValue: string
	/** Set API key value (for controlled input) */
	setApiKeyValue: (value: string) => void
	/** Open the image upload flow (checks API key first) */
	openUpload: () => Promise<void>
	/** Save API key and open dropzone */
	saveApiKey: () => Promise<void>
	/** Handle file selection and upload */
	handleFilesSelect: (files: File[]) => Promise<void>
	/** Handle drag enter event */
	handleDragEnter: (e: React.DragEvent) => void
	/** Handle drag leave event */
	handleDragLeave: (e: React.DragEvent, containerRef: React.RefObject<HTMLElement | null>) => void
	/** Handle drag over event */
	handleDragOver: (e: React.DragEvent) => void
	/** Handle drop event */
	handleDrop: (e: React.DragEvent) => void
	/** Reset upload state */
	reset: () => void
}

/**
 * Hook for managing image upload state and logic.
 *
 * @example
 * ```tsx
 * const upload = useUploadState({
 *   dialogs,
 *   onInsertImage: (bbcode) => editor.insertAtCursor(bbcode),
 * })
 *
 * // In dropzone
 * <ImageDropzone
 *   isUploading={upload.isUploading}
 *   uploadProgress={upload.uploadProgress}
 *   onFilesSelect={upload.handleFilesSelect}
 * />
 * ```
 */
export function useUploadState({ dialogs, onInsertImage }: UseUploadStateOptions): UseUploadStateReturn {
	const [isUploading, setIsUploading] = useState(false)
	const [uploadProgress, setUploadProgress] = useState(0)
	const [isDraggingOver, setIsDraggingOver] = useState(false)
	const [apiKeyValue, setApiKeyValue] = useState('')

	// Track if API key was loaded
	const apiKeyLoadedRef = useRef(false)

	// Load API key on first access
	const ensureApiKeyLoaded = useCallback(async () => {
		if (!apiKeyLoadedRef.current) {
			const key = await getApiKey()
			if (key) setApiKeyValue(key)
			apiKeyLoadedRef.current = true
		}
	}, [])

	const openUpload = useCallback(async () => {
		await ensureApiKeyLoaded()
		const key = await getApiKey()
		if (!key) {
			dialogs.open('apiKey')
		} else {
			dialogs.open('dropzone')
		}
	}, [dialogs, ensureApiKeyLoaded])

	const setImgbbApiKey = useSettingsStore(state => state.setImgbbApiKey)

	const saveApiKey = useCallback(async () => {
		setImgbbApiKey(apiKeyValue)
		toast.success('API key guardada', {
			description: 'Ya puedes subir imágenes',
		})
		dialogs.open('dropzone')
	}, [apiKeyValue, dialogs, setImgbbApiKey])

	const handleFilesSelect = useCallback(
		async (files: File[]) => {
			if (files.length === 0) return

			logger.debug(`Starting upload of ${files.length} files`)
			setIsUploading(true)
			setUploadProgress(0)

			let successCount = 0
			const total = files.length

			for (let i = 0; i < total; i++) {
				const file = files[i]

				// Show incremental progress before starting each file upload
				// This prevents the UI from showing 0% while waiting for the first upload
				setUploadProgress(Math.round(((i + 0.1) / total) * 100))

				logger.debug(`Processing file ${i + 1}/${total}: ${file.name}`)
				const validation = validateImageFile(file)

				if (!validation.valid) {
					logger.error(`Validation failed for ${file.name}:`, validation.error)
					toast.error(`${file.name}: ${validation.error}`)
					continue
				}

				try {
					logger.debug(`Uploading ${file.name}...`)
					const startTime = Date.now()
					const result = await uploadImage(file)
					const elapsed = Date.now() - startTime
					logger.debug(`Upload result for ${file.name} (${elapsed}ms):`, result)

					if (result.success && result.url) {
						logger.debug(`Inserting image tag for ${file.name}`)
						onInsertImage(`[img]${result.url}[/img]\n`)
						successCount++
						logger.debug(`Image inserted, successCount: ${successCount}`)
					} else if (result.error === 'API_KEY_REQUIRED') {
						dialogs.open('apiKey')
						break
					} else {
						logger.error(`Upload failed for ${file.name}:`, result.error)
						toast.error(`Error al subir ${file.name}`, {
							description: result.error || 'Inténtalo de nuevo',
						})
					}
				} catch (err) {
					logger.error(`Exception during upload of ${file.name}:`, err)
					toast.error(`Error de conexión con ${file.name}`)
				}

				setUploadProgress(Math.round(((i + 1) / total) * 100))
			}

			logger.debug(`Upload batch complete: ${successCount}/${total} successful`)

			if (successCount > 0) {
				toast.success(successCount === 1 ? 'Imagen subida correctamente' : `${successCount} imágenes subidas`, {
					description: 'Insertada en el editor',
				})
			}

			setTimeout(() => {
				setIsUploading(false)
				setUploadProgress(0)
				dialogs.close()
			}, 800)
		},
		[dialogs, onInsertImage]
	)

	const handleDragEnter = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			e.stopPropagation()
			if (e.dataTransfer?.types.includes('Files')) {
				setIsDraggingOver(true)
				dialogs.open('dropzone')
			}
		},
		[dialogs]
	)

	const handleDragLeave = useCallback(
		(e: React.DragEvent, containerRef: React.RefObject<HTMLElement | null>) => {
			e.preventDefault()
			e.stopPropagation()
			const rect = containerRef.current?.getBoundingClientRect()
			if (rect) {
				const { clientX, clientY } = e
				if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
					setIsDraggingOver(false)
					if (!isUploading) {
						dialogs.close()
					}
				}
			}
		},
		[isUploading, dialogs]
	)

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
	}, [])

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setIsDraggingOver(false)
	}, [])

	const reset = useCallback(() => {
		setIsUploading(false)
		setUploadProgress(0)
		setIsDraggingOver(false)
	}, [])

	return {
		isUploading,
		uploadProgress,
		isDraggingOver,
		apiKeyValue,
		setApiKeyValue,
		openUpload,
		saveApiKey,
		handleFilesSelect,
		handleDragEnter,
		handleDragLeave,
		handleDragOver,
		handleDrop,
		reset,
	}
}
