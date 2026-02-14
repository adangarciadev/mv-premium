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
	// Estado inicial
	const [toggles, setToggles] = useState<FeatureToggles>({
		cinemaButtonEnabled: true,
		gifPickerEnabled: true,
		draftsButtonEnabled: !isPrivateMessage, // Optimizamos el estado inicial
		templateButtonEnabled: !isPrivateMessage,
		gameButtonEnabled: true,
		loading: true,
	})

	useEffect(() => {
		let ignore = false

		getSettings().then(settings => {
			// Si el componente se desmontó, no hacemos nada
			if (ignore) return

			console.log('Settings loaded (Hook):', settings)

			setToggles({
				cinemaButtonEnabled: settings.cinemaButtonEnabled ?? true,
				gifPickerEnabled: settings.gifPickerEnabled ?? true,
				// Aplicamos la lógica de negocio aquí
				draftsButtonEnabled: isPrivateMessage ? false : (settings.draftsButtonEnabled ?? true),
				templateButtonEnabled: isPrivateMessage ? false : (settings.templateButtonEnabled ?? true),
				gameButtonEnabled: settings.gameButtonEnabled ?? true,
				loading: false,
			})
		})

		// Función de limpieza para evitar Race Conditions
		return () => {
			ignore = true
		}
	}, [isPrivateMessage])

	return toggles
}
