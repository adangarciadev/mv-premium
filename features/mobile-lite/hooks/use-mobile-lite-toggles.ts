import { useEffect, useState } from 'react'
import { getSettings, useSettingsStore } from '@/store/settings-store'
import { applyMobileLiteHiddenThreads } from '../logic/hidden-threads'
import { syncMobileLiteGalleryButton } from '../logic/gallery'
import { syncMobileLiteLiveThreadButton } from '../logic/live-thread'
import { syncMobileLiteQuoteSelection } from '../logic/quote-selection'
import { type SavingMobileLiteSetting } from '../components/panel-helpers'
import { useAutoDismiss } from './use-auto-dismiss'

/**
 * Mobile Lite feature toggles (live thread, gallery button, quote-on-selection,
 * hide-thread button). Each toggle writes to the settings store, runs its side
 * effect, and rolls back on failure.
 */
export function useMobileLiteToggles(open: boolean) {
	const [liveThreadEnabled, setLiveThreadEnabled] = useState(false)
	const [galleryButtonEnabled, setGalleryButtonEnabled] = useState(true)
	const [quoteSelectionEnabled, setQuoteSelectionEnabled] = useState(true)
	const [hideThreadButtonEnabled, setHideThreadButtonEnabled] = useState(true)
	const [savingMobileLiteSetting, setSavingMobileLiteSetting] = useState<SavingMobileLiteSetting>(null)
	const [statusMessage, setStatusMessage] = useState<string | null>(null)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	useAutoDismiss(statusMessage, setStatusMessage)

	useEffect(() => {
		if (!open) return

		let mounted = true
		getSettings()
			.then(settings => {
				if (!mounted) return
				setLiveThreadEnabled(settings.liveThreadEnabled === true)
				setGalleryButtonEnabled(settings.galleryButtonEnabled !== false)
				setQuoteSelectionEnabled(settings.quoteSelectionEnabled !== false)
				setHideThreadButtonEnabled(settings.hideThreadEnabled !== false)
				setStatusMessage(null)
				setErrorMessage(null)
			})
			.catch(() => {
				if (mounted) setErrorMessage('No se pudieron cargar los ajustes de Mobile Lite.')
			})

		return () => {
			mounted = false
		}
	}, [open])

	const toggleLiveThread = async () => {
		const nextEnabled = !liveThreadEnabled
		setSavingMobileLiteSetting('liveThreadEnabled')
		setErrorMessage(null)
		setStatusMessage(null)
		try {
			useSettingsStore.getState().setSetting('liveThreadEnabled', nextEnabled)
			setLiveThreadEnabled(nextEnabled)
			await syncMobileLiteLiveThreadButton(nextEnabled)
			setStatusMessage(nextEnabled ? 'Modo Live activado.' : 'Modo Live desactivado.')
		} catch {
			setLiveThreadEnabled(!nextEnabled)
			setErrorMessage('No se pudo cambiar el Modo Live.')
		} finally {
			setSavingMobileLiteSetting(null)
		}
	}

	const toggleGallery = async () => {
		const nextEnabled = !galleryButtonEnabled
		setSavingMobileLiteSetting('galleryButtonEnabled')
		setErrorMessage(null)
		setStatusMessage(null)
		try {
			useSettingsStore.getState().setSetting('galleryButtonEnabled', nextEnabled)
			setGalleryButtonEnabled(nextEnabled)
			await syncMobileLiteGalleryButton(nextEnabled)
			setStatusMessage(nextEnabled ? 'Botón de galería activado.' : 'Botón de galería desactivado.')
		} catch {
			setGalleryButtonEnabled(!nextEnabled)
			setErrorMessage('No se pudo cambiar el botón de galería.')
		} finally {
			setSavingMobileLiteSetting(null)
		}
	}

	const toggleQuoteSelection = async () => {
		const nextEnabled = !quoteSelectionEnabled
		setSavingMobileLiteSetting('quoteSelectionEnabled')
		setErrorMessage(null)
		setStatusMessage(null)
		try {
			useSettingsStore.getState().setSetting('quoteSelectionEnabled', nextEnabled)
			setQuoteSelectionEnabled(nextEnabled)
			await syncMobileLiteQuoteSelection(nextEnabled)
			setStatusMessage(nextEnabled ? 'Citar selección activado.' : 'Citar selección desactivado.')
		} catch {
			setQuoteSelectionEnabled(!nextEnabled)
			setErrorMessage('No se pudo cambiar Citar selección.')
		} finally {
			setSavingMobileLiteSetting(null)
		}
	}

	const toggleHideThread = () => {
		const nextEnabled = !hideThreadButtonEnabled
		setSavingMobileLiteSetting('hideThreadEnabled')
		setErrorMessage(null)
		setStatusMessage(null)
		try {
			useSettingsStore.getState().setSetting('hideThreadEnabled', nextEnabled)
			setHideThreadButtonEnabled(nextEnabled)
			applyMobileLiteHiddenThreads()
			setStatusMessage(nextEnabled ? 'Botón de ocultar hilos activado.' : 'Botón de ocultar hilos desactivado.')
		} catch {
			setHideThreadButtonEnabled(!nextEnabled)
			setErrorMessage('No se pudo cambiar el botón de ocultar hilos.')
		} finally {
			setSavingMobileLiteSetting(null)
		}
	}

	return {
		liveThreadEnabled,
		galleryButtonEnabled,
		quoteSelectionEnabled,
		hideThreadButtonEnabled,
		savingMobileLiteSetting,
		statusMessage,
		errorMessage,
		toggleLiveThread,
		toggleGallery,
		toggleQuoteSelection,
		toggleHideThread,
	}
}
