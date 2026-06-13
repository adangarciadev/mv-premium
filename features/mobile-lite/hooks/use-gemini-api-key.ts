import { useEffect, useState } from 'react'
import { getMobileLiteGeminiApiKey, saveMobileLiteGeminiApiKey } from '../logic/gemini-api-key-storage'
import { useAutoDismiss } from './use-auto-dismiss'

/**
 * Gemini API key settings: the persisted key, its editable draft and the
 * save flow. Loads on panel open. Powers the AI thread-summary feature for
 * mobile-only users who never open the desktop dashboard.
 */
export function useGeminiApiKey(open: boolean) {
	const [geminiApiKey, setGeminiApiKey] = useState('')
	const [geminiApiKeyDraft, setGeminiApiKeyDraft] = useState('')
	const [savingGeminiApiKey, setSavingGeminiApiKey] = useState(false)
	const [statusMessage, setStatusMessage] = useState<string | null>(null)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	useAutoDismiss(statusMessage, setStatusMessage)

	useEffect(() => {
		if (!open) return

		let mounted = true
		getMobileLiteGeminiApiKey()
			.then(apiKey => {
				if (!mounted) return
				setGeminiApiKey(apiKey)
				setGeminiApiKeyDraft(apiKey)
				setStatusMessage(null)
				setErrorMessage(null)
			})
			.catch(() => {
				if (mounted) setErrorMessage('No se pudo cargar la API key de Gemini.')
			})

		return () => {
			mounted = false
		}
	}, [open])

	const isGeminiConfigured = Boolean(geminiApiKey.trim())
	const isGeminiDirty = geminiApiKeyDraft.trim() !== geminiApiKey

	const handleDraftChange = (value: string) => {
		setGeminiApiKeyDraft(value)
		setStatusMessage(null)
		setErrorMessage(null)
	}

	const saveGeminiApiKey = async () => {
		setSavingGeminiApiKey(true)
		setErrorMessage(null)
		setStatusMessage(null)
		try {
			const nextApiKey = geminiApiKeyDraft.trim()
			await saveMobileLiteGeminiApiKey(nextApiKey)
			setGeminiApiKey(nextApiKey)
			setGeminiApiKeyDraft(nextApiKey)
			setStatusMessage(nextApiKey ? 'API key de Gemini guardada.' : 'API key de Gemini eliminada.')
		} catch {
			setErrorMessage('No se pudo guardar la API key de Gemini.')
		} finally {
			setSavingGeminiApiKey(false)
		}
	}

	return {
		geminiApiKeyDraft,
		isGeminiConfigured,
		isGeminiDirty,
		savingGeminiApiKey,
		statusMessage,
		errorMessage,
		handleDraftChange,
		saveGeminiApiKey,
	}
}
