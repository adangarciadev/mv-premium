import { useEffect, useState } from 'react'
import { getMobileLiteImgbbApiKey, saveMobileLiteImgbbApiKey } from '../logic/imgbb-api-key-storage'
import { useAutoDismiss } from './use-auto-dismiss'

/**
 * ImgBB API key settings: the persisted key, its editable draft and the
 * save flow. Loads on panel open.
 */
export function useImgbbApiKey(open: boolean) {
	const [imgbbApiKey, setImgbbApiKey] = useState('')
	const [imgbbApiKeyDraft, setImgbbApiKeyDraft] = useState('')
	const [savingImgbbApiKey, setSavingImgbbApiKey] = useState(false)
	const [statusMessage, setStatusMessage] = useState<string | null>(null)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	useAutoDismiss(statusMessage, setStatusMessage)

	useEffect(() => {
		if (!open) return

		let mounted = true
		getMobileLiteImgbbApiKey()
			.then(apiKey => {
				if (!mounted) return
				setImgbbApiKey(apiKey)
				setImgbbApiKeyDraft(apiKey)
				setStatusMessage(null)
				setErrorMessage(null)
			})
			.catch(() => {
				if (mounted) setErrorMessage('No se pudo cargar la API key de ImgBB.')
			})

		return () => {
			mounted = false
		}
	}, [open])

	const isImgbbConfigured = Boolean(imgbbApiKey.trim())
	const isImgbbDirty = imgbbApiKeyDraft.trim() !== imgbbApiKey

	const handleDraftChange = (value: string) => {
		setImgbbApiKeyDraft(value)
		setStatusMessage(null)
		setErrorMessage(null)
	}

	const saveImgbbApiKey = async () => {
		setSavingImgbbApiKey(true)
		setErrorMessage(null)
		setStatusMessage(null)
		try {
			const nextApiKey = imgbbApiKeyDraft.trim()
			await saveMobileLiteImgbbApiKey(nextApiKey)
			setImgbbApiKey(nextApiKey)
			setImgbbApiKeyDraft(nextApiKey)
			setStatusMessage(nextApiKey ? 'API key de ImgBB guardada.' : 'API key de ImgBB eliminada.')
		} catch {
			setErrorMessage('No se pudo guardar la API key de ImgBB.')
		} finally {
			setSavingImgbbApiKey(false)
		}
	}

	return {
		imgbbApiKeyDraft,
		isImgbbConfigured,
		isImgbbDirty,
		savingImgbbApiKey,
		statusMessage,
		errorMessage,
		handleDraftChange,
		saveImgbbApiKey,
	}
}
