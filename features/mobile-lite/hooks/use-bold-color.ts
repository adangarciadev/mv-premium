import { useEffect, useState } from 'react'
import {
	getMobileLiteBoldColorSettings,
	normalizeMobileLiteBoldColor,
	saveMobileLiteBoldColorSettings,
} from '../logic/bold-color'
import { DEFAULT_BOLD_COLOR } from '../components/panel-helpers'
import { useAutoDismiss } from './use-auto-dismiss'

/**
 * Custom bold-text colour settings: persisted colour + enabled flag, the
 * editable draft, the expand state and the save/toggle/reset flows.
 */
export function useBoldColor(open: boolean) {
	const [boldColor, setBoldColor] = useState(DEFAULT_BOLD_COLOR)
	const [boldColorDraft, setBoldColorDraft] = useState(DEFAULT_BOLD_COLOR)
	const [boldColorEnabled, setBoldColorEnabled] = useState(false)
	const [boldColorExpanded, setBoldColorExpanded] = useState(false)
	const [savingBoldColor, setSavingBoldColor] = useState(false)
	const [statusMessage, setStatusMessage] = useState<string | null>(null)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	useAutoDismiss(statusMessage, setStatusMessage)

	useEffect(() => {
		if (!open) return

		let mounted = true
		getMobileLiteBoldColorSettings()
			.then(settings => {
				if (!mounted) return
				setBoldColor(settings.color)
				setBoldColorDraft(settings.color)
				setBoldColorEnabled(settings.enabled)
				setStatusMessage(null)
				setErrorMessage(null)
			})
			.catch(() => {
				if (mounted) setErrorMessage('No se pudo cargar el color de negrita.')
			})

		return () => {
			mounted = false
		}
	}, [open])

	const normalizedBoldColorDraft = normalizeMobileLiteBoldColor(boldColorDraft)
	const isBoldColorDirty = normalizedBoldColorDraft !== boldColor

	const handleDraftChange = (value: string) => {
		setBoldColorDraft(value)
		setStatusMessage(null)
		setErrorMessage(null)
	}

	const toggleExpanded = () => setBoldColorExpanded(value => !value)

	const saveBoldColor = async () => {
		setSavingBoldColor(true)
		setErrorMessage(null)
		setStatusMessage(null)
		try {
			const nextSettings = await saveMobileLiteBoldColorSettings({
				color: normalizedBoldColorDraft,
				enabled: boldColorEnabled,
			})
			setBoldColor(nextSettings.color)
			setBoldColorDraft(nextSettings.color)
			setBoldColorEnabled(nextSettings.enabled)
			setStatusMessage('Color de negrita guardado.')
		} catch {
			setErrorMessage('No se pudo guardar el color de negrita.')
		} finally {
			setSavingBoldColor(false)
		}
	}

	const toggleBoldColor = async () => {
		const nextEnabled = !boldColorEnabled
		setSavingBoldColor(true)
		setErrorMessage(null)
		setStatusMessage(null)
		try {
			const nextSettings = await saveMobileLiteBoldColorSettings({
				enabled: nextEnabled,
			})
			setBoldColor(nextSettings.color)
			setBoldColorDraft(nextSettings.color)
			setBoldColorEnabled(nextSettings.enabled)
			setStatusMessage(nextSettings.enabled ? 'Color personalizado activado.' : 'Color personalizado desactivado.')
		} catch {
			setErrorMessage('No se pudo cambiar el color de negrita.')
		} finally {
			setSavingBoldColor(false)
		}
	}

	const resetBoldColor = async () => {
		setSavingBoldColor(true)
		setErrorMessage(null)
		setStatusMessage(null)
		try {
			const nextSettings = await saveMobileLiteBoldColorSettings({
				color: DEFAULT_BOLD_COLOR,
				enabled: boldColorEnabled,
			})
			setBoldColor(nextSettings.color)
			setBoldColorDraft(nextSettings.color)
			setBoldColorEnabled(nextSettings.enabled)
			setStatusMessage('Color de negrita restaurado.')
		} catch {
			setErrorMessage('No se pudo restaurar el color de negrita.')
		} finally {
			setSavingBoldColor(false)
		}
	}

	return {
		boldColor,
		boldColorDraft,
		normalizedBoldColorDraft,
		boldColorEnabled,
		boldColorExpanded,
		isBoldColorDirty,
		savingBoldColor,
		statusMessage,
		errorMessage,
		handleDraftChange,
		toggleExpanded,
		saveBoldColor,
		toggleBoldColor,
		resetBoldColor,
	}
}
