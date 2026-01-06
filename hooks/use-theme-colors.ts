/**
 * useThemeColors - Hook para aplicar colores personalizados del tema
 *
 * Este hook se encarga de:
 * 1. Cargar el estado del theme-store
 * 2. Aplicar los colores CSS al documento
 * 3. Reaccionar a cambios en el modo (light/dark)
 */
import { useEffect } from 'react'
import { useTheme, applyCustomColors, clearCustomColors } from '@/providers/theme-provider'
import { useThemeStore } from '@/features/theme-editor/theme-store'

export function useThemeColors() {
	const { resolvedTheme } = useTheme()
	const { isLoaded, activePreset, loadFromStorage, customRadius } = useThemeStore()

	// Cargar estado del store al montar
	useEffect(() => {
		if (!isLoaded) {
			loadFromStorage()
		}
	}, [isLoaded, loadFromStorage])

	// Aplicar colores cuando cambia el tema o los colores personalizados
	useEffect(() => {
		if (!isLoaded) return

		const root = document.documentElement
		const colors = resolvedTheme === 'dark' ? activePreset.colors.dark : activePreset.colors.light

		// Aplicar todos los colores del preset activo
		applyCustomColors(colors, root)

		// Aplicar radio personalizado si existe
		if (customRadius || activePreset.radius) {
			root.style.setProperty('--radius', customRadius || activePreset.radius || '0.625rem')
		}

		// Cleanup: no hacemos clear porque queremos mantener los colores
	}, [isLoaded, activePreset, resolvedTheme, customRadius])

	return { isLoaded }
}
