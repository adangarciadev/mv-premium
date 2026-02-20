import { useState, useEffect } from 'react'
import { getSettings } from '@/store/settings-store'

interface FeatureToggles {
	cinemaButtonEnabled: boolean
	gifPickerEnabled: boolean
	draftsButtonEnabled: boolean
	templateButtonEnabled: boolean
	gameButtonEnabled: boolean
	loading: boolean
}

export function useFeatureToggles(isPrivateMessage: boolean) {
	// Initial state
	const [toggles, setToggles] = useState<FeatureToggles>({
		cinemaButtonEnabled: true,
		gifPickerEnabled: true,
		draftsButtonEnabled: !isPrivateMessage, // Optimize initial state
		templateButtonEnabled: !isPrivateMessage,
		gameButtonEnabled: true,
		loading: true,
	})

	useEffect(() => {
		let ignore = false

		getSettings().then(settings => {
			// If the component unmounted, do nothing
			if (ignore) return

			setToggles({
				cinemaButtonEnabled: settings.cinemaButtonEnabled ?? true,
				gifPickerEnabled: settings.gifPickerEnabled ?? true,
				draftsButtonEnabled: isPrivateMessage ? false : (settings.draftsButtonEnabled ?? true),
				templateButtonEnabled: isPrivateMessage ? false : (settings.templateButtonEnabled ?? true),
				gameButtonEnabled: settings.gameButtonEnabled ?? true,
				loading: false,
			})
		})

		// Cleanup function to avoid Race Conditions
		return () => {
			ignore = true
		}
	}, [isPrivateMessage])

	return toggles
}
