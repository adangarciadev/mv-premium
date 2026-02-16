/**
 * Save Thread Button Component
 *
 * Compact button that appears next to the favorites button.
 * Uses native Mediavida styling for seamless integration.
 */
import { useState, useEffect, useCallback } from 'react'
import { logger } from '@/lib/logger'
import { isThreadSaved, toggleSaveThread, watchSavedThreads } from '../logic/storage'
import { showSavedThreadToggledToast, showSaveThreadErrorToast } from '../logic/save-toast'

export function SaveThreadButton() {
	const [isSaved, setIsSaved] = useState(false)
	const [isLoading, setIsLoading] = useState(true)

	// Check initial state
	useEffect(() => {
		isThreadSaved().then(saved => {
			setIsSaved(saved)
			setIsLoading(false)
		})
	}, [])

	// Watch for external changes (e.g., from dashboard)
	useEffect(() => {
		const unwatch = watchSavedThreads(() => {
			isThreadSaved().then(setIsSaved)
		})
		return unwatch
	}, [])

	const handleClick = useCallback(async () => {
		if (isLoading) return

		try {
			const nowSaved = await toggleSaveThread()
			setIsSaved(nowSaved)
			showSavedThreadToggledToast(nowSaved)
		} catch (error) {
			logger.error('Error toggling save state:', error)
			showSaveThreadErrorToast()
		}
	}, [isLoading])

	const label = isLoading ? 'Cargando...' : isSaved ? 'Quitar de guardados' : 'Guardar hilo'
	const shortLabel = isLoading ? 'Cargando' : isSaved ? 'Guardado' : 'Guardar'

	// Native MV button style (side-mode may append short label via CSS).
	return (
		<a
			href="javascript:void(0);"
			onClick={handleClick}
			className="btn"
			title={label}
			aria-label={label}
			aria-pressed={isSaved}
			role="button"
			style={{
				cursor: isLoading ? 'wait' : 'pointer',
				opacity: isLoading ? 0.6 : 1,
			}}
		>
			<i
				className={isSaved ? 'fa fa-folder-open' : 'fa fa-folder-o'}
				style={{
					color: isSaved ? '#ffb400' : undefined,
					// Add text shadow (border effect) for better visibility in light mode
					textShadow: isSaved ? '0px 0px 1px #000, 0px 0px 1px #000' : undefined,
				}}
				aria-hidden="true"
			/>
			<span className="mvp-save-thread-label" style={{ marginLeft: '5px', display: 'none' }}>
				{shortLabel}
			</span>
		</a>
	)
}
