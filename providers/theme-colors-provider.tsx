/**
 * Theme Colors Provider - Aplica los colores personalizados del tema
 * Debe estar dentro de ThemeProvider
 */
import { useEffect, useMemo, type ReactNode } from 'react'
import { useTheme, applyCustomColors } from '@/providers/theme-provider'
import { useThemeStore } from '@/features/theme-editor/theme-store'
import { getPresetById } from '@/features/theme-editor/presets'
import { defaultPreset } from '@/features/theme-editor/presets'

interface ThemeColorsProviderProps {
	children: ReactNode
}

export function ThemeColorsProvider({ children }: ThemeColorsProviderProps) {
	const { resolvedTheme } = useTheme()

	// Subscribe to primitive/object values that DO trigger re-renders
	const isLoaded = useThemeStore(state => state.isLoaded)
	const activePresetId = useThemeStore(state => state.activePresetId)
	const customColorsLight = useThemeStore(state => state.customColorsLight)
	const customColorsDark = useThemeStore(state => state.customColorsDark)
	const customRadius = useThemeStore(state => state.customRadius)
	const savedPresets = useThemeStore(state => state.savedPresets)
	const loadFromStorage = useThemeStore(state => state.loadFromStorage)

	// Cargar estado del store al montar
	useEffect(() => {
		if (!isLoaded) {
			loadFromStorage()
		}
	}, [isLoaded, loadFromStorage])

	// Compute activePreset locally to ensure reactivity
	const activePreset = useMemo(() => {
		const basePreset = getPresetById(activePresetId) || savedPresets.find(p => p.id === activePresetId) || defaultPreset

		return {
			...basePreset,
			colors: {
				light: { ...basePreset.colors.light, ...customColorsLight },
				dark: { ...basePreset.colors.dark, ...customColorsDark },
			},
			radius: customRadius || basePreset.radius,
		}
	}, [activePresetId, savedPresets, customColorsLight, customColorsDark, customRadius])

	// Aplicar colores cuando cambia el tema o los colores personalizados
	useEffect(() => {
		if (!isLoaded) return

		const root = document.documentElement
		const colors = resolvedTheme === 'dark' ? activePreset.colors.dark : activePreset.colors.light

		// Aplicar todos los colores del preset activo
		applyCustomColors(colors, root)

		// Aplicar radio personalizado si existe
		if (activePreset.radius) {
			root.style.setProperty('--radius', activePreset.radius)
		}
	}, [isLoaded, activePreset, resolvedTheme])

	return <>{children}</>
}
