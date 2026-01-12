import { useState, useEffect, useRef } from 'react'
import { logger } from '@/lib/logger'
import { toast } from '@/lib/lazy-toast'
import { uploadImage, validateImageFile, getApiKey } from '@/services/api/imgbb'
import { useSettingsStore } from '@/store/settings-store'

interface UseImageUploadOptions {
	onSuccess?: (url: string) => void
	onError?: (error: string) => void
}

/**
 * useImageUpload hood - Manages the multi-file image upload workflow.
 * Handles validation, progress tracking, and insertion via provide callbacks.
 * Designed for use with the distributed toolbar's image tools.
 *
 * @param textarea - The target editor element
 * @param options - Configuration for success/error handling
 */
export function useImageUpload(textarea: HTMLTextAreaElement, options: UseImageUploadOptions = {}) {
	const [isUploading, setIsUploading] = useState(false)
	const [uploadProgress, setUploadProgress] = useState(0)
	const [showApiKeyDialog, setShowApiKeyDialog] = useState(false)
	const [apiKeyValue, setApiKeyValue] = useState<string>('')
	const fileInputRef = useRef<HTMLInputElement>(null)
	
	const setImgbbApiKey = useSettingsStore(state => state.setImgbbApiKey)

	// Hydrate API key on mount
	useEffect(() => {
		const loadApiKey = async () => {
			const storedKey = await getApiKey()
			if (storedKey) setApiKeyValue(storedKey)
		}
		void loadApiKey()
	}, [])

	const processFile = async (file: File, index: number, total: number): Promise<boolean> => {
		logger.debug(`Processing file ${index + 1}/${total}: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`)

		const validation = validateImageFile(file)
		if (!validation.valid) {
			logger.error(`Validation failed for ${file.name}:`, validation.error)
			toast.error(`${file.name}: ${validation.error || 'Archivo no válido'}`)
			return false
		}

		try {
			logger.debug(`Starting upload for ${file.name}...`)
			const startTime = Date.now()
			const result = await uploadImage(file)
			const elapsed = Date.now() - startTime
			logger.debug(`Upload completed for ${file.name} in ${elapsed}ms:`, result)

			if (result.success && result.url) {
				options.onSuccess?.(result.url)
				return true
			} else {
				logger.error(`Upload failed for ${file.name}:`, result.error)
				toast.error(`Error al subir ${file.name}`, {
					description: result.error || 'Inténtalo de nuevo',
				})
				options.onError?.(result.error || 'Error al subir')
				return false
			}
		} catch (err) {
			logger.error(`Exception during upload of ${file.name}:`, err)
			return false
		}
	}

	/**
	 * Orchestrates the sequential upload of multiple files.
	 * Updates the overall progress and provides feedback via toasts.
	 */
	const uploadFiles = async (files: File[]) => {
		// No more API key check - Catbox works without it
		if (files.length === 0) return

		setIsUploading(true)
		setUploadProgress(0)

		let successCount = 0
		const total = files.length

		logger.debug(`Starting upload batch: ${total} files`)

		for (let i = 0; i < total; i++) {
			// Show some initial progress before upload starts
			setUploadProgress(Math.round(((i + 0.1) / total) * 100))

			const success = await processFile(files[i], i, total)
			if (success) successCount++

			// Update progress based on percentage of files processed
			setUploadProgress(Math.round(((i + 1) / total) * 100))
		}

		logger.debug(`Batch complete: ${successCount}/${total} successful`)

		if (successCount > 0) {
			toast.success(
				successCount === 1 ? 'Imagen subida correctamente' : `${successCount} imágenes subidas correctamente`,
				{
					description: 'Las imágenes se han insertado en el editor',
				}
			)
		}

		// Ensure 100% is shown
		setUploadProgress(100)

		// Allow React to render the 100% before we continue
		await new Promise(resolve => setTimeout(resolve, 50))

		// Brief delay to show 100%
		await new Promise(resolve => setTimeout(resolve, 350))

		// Dropzone closes after this function returns
		// Reset state in next tick so dropzone closes while still showing upload view
		setTimeout(() => {
			setIsUploading(false)
			setUploadProgress(0)
		}, 0)
	}

	const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files
		if (!files || files.length === 0) return

		await uploadFiles(Array.from(files))
		e.target.value = ''
	}

	const handleSaveApiKey = async () => {
		setImgbbApiKey(apiKeyValue)
		setShowApiKeyDialog(false)
		toast.success('API key guardada', {
			description: 'Ya puedes subir imágenes',
		})
	}

	// This is now purely for the hidden input trigger if needed outside dropzone
	const triggerImageUpload = () => {
		// No more API key check - Catbox works without it
		requestAnimationFrame(() => {
			fileInputRef.current?.click()
		})
	}

	return {
		isUploading,
		uploadProgress,
		showApiKeyDialog,
		apiKeyValue,
		fileInputRef,
		setShowApiKeyDialog,
		setApiKeyValue,
		uploadFiles,
		handleImageSelect,
		handleSaveApiKey,
		triggerImageUpload,
	}
}
