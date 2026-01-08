/**
 * Theme Store - State and persistence for custom themes
 */
import { create } from 'zustand'
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'
import type { ThemeColors, ThemePreset, CustomThemeState, ThemeExport, CSS_VAR_MAP } from '@/types/theme'
import { ALL_PRESETS, getPresetById, defaultPreset } from '@/features/theme-editor/presets'
import { generateRandomTheme, validateAndFixTheme, type ColorHarmony } from './lib/color-generator'

// ============================================================================
// STORAGE ITEMS
// ============================================================================

const themeStateStorage = storage.defineItem<CustomThemeState>(`local:${STORAGE_KEYS.THEME_CUSTOM}`, {
	defaultValue: {
		activePresetId: 'mediavida',
		customColorsLight: {},
		customColorsDark: {},
		customRadius: undefined,
	},
})

const savedPresetsStorage = storage.defineItem<ThemePreset[]>(`local:${STORAGE_KEYS.THEME_SAVED_PRESETS}`, {
	defaultValue: [],
})

const customFontStorage = storage.defineItem<string>(`local:${STORAGE_KEYS.CUSTOM_FONT}`, {
	defaultValue: '',
})

const applyFontGloballyStorage = storage.defineItem<boolean>(`local:${STORAGE_KEYS.APPLY_FONT_GLOBALLY}`, {
	defaultValue: false,
})

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface ThemeStore {
	// State
	isLoaded: boolean
	activePresetId: string
	customColorsLight: Partial<ThemeColors>
	customColorsDark: Partial<ThemeColors>
	customRadius?: string
	customFont: string
	applyFontGlobally: boolean
	savedPresets: ThemePreset[]

	// Computed
	activePreset: ThemePreset
	allPresets: ThemePreset[]

	// Actions
	/**
	 * Loads all theme-related settings from local storage and initializes the store.
	 */
	loadFromStorage: () => Promise<void>
	setActivePreset: (id: string) => void
	setCustomColor: (key: keyof ThemeColors, value: string, mode: 'light' | 'dark') => void
	setCustomRadius: (radius: string) => void
	setCustomFont: (font: string) => void
	setApplyFontGlobally: (apply: boolean) => void
	/**
	 * Resets all color customizations to match the current preset's defaults.
	 */
	resetCustomColors: () => void
	/**
	 * Generates a random color theme based on an optional harmony algorithm.
	 */
	generateRandom: (harmony?: ColorHarmony) => void
	/**
	 * Saves the current theme state as a persistent custom preset.
	 */
	saveCurrentAsPreset: (name: string) => void
	/**
	 * Updates an existing custom preset with current changes.
	 */
	updatePreset: (id: string, name?: string) => void
	/**
	 * Creates a copy of an existing preset.
	 */
	duplicatePreset: (id: string) => void
	/**
	 * Deletes a previously saved custom preset.
	 */
	deletePreset: (id: string) => void
	/**
	 * Imports theme preset(s) from an external source.
	 */
	importPreset: (preset: ThemePreset) => void
	/**
	 * Imports multiple presets from an exported JSON file.
	 */
	importPresets: (presets: ThemePreset[]) => void
	/**
	 * Exports the current theme as a shareable JSON structure.
	 */
	exportCurrentTheme: (name: string) => ThemeExport
	/**
	 * Exports all saved (custom) presets as a JSON file for backup/sharing.
	 */
	exportAllSavedPresets: () => { version: number; exportedAt: string; presets: ThemePreset[] } | null
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useThemeStore = create<ThemeStore>((set, get) => ({
	// Initial state
	isLoaded: false,
	activePresetId: 'mediavida',
	customColorsLight: {},
	customColorsDark: {},
	customRadius: undefined,
	customFont: '',
	applyFontGlobally: false,
	savedPresets: [],

	// Computed: Get active preset
	get activePreset() {
		const state = get()
		const basePreset =
			getPresetById(state.activePresetId) ||
			state.savedPresets.find(p => p.id === state.activePresetId) ||
			defaultPreset

		// Merge with default preset to ensure all keys exist (migration for old presets)
		// This prevents crashes if new color keys (like tables) are added but missing in saved presets
		const mergedBaseColors = {
			light: { ...defaultPreset.colors.light, ...basePreset.colors.light },
			dark: { ...defaultPreset.colors.dark, ...basePreset.colors.dark },
		}

		// Apply customizations on top of base preset
		return {
			...basePreset,
			colors: {
				light: { ...mergedBaseColors.light, ...state.customColorsLight },
				dark: { ...mergedBaseColors.dark, ...state.customColorsDark },
			},
			radius: state.customRadius || basePreset.radius,
		}
	},

	// Computed: All available presets
	get allPresets() {
		return [...ALL_PRESETS, ...get().savedPresets]
	},

	// Load from storage
	loadFromStorage: async () => {
		const [state, saved, font, applyGlobally] = await Promise.all([
			themeStateStorage.getValue(),
			savedPresetsStorage.getValue(),
			customFontStorage.getValue(),
			applyFontGloballyStorage.getValue(),
		])

		set({
			isLoaded: true,
			activePresetId: state.activePresetId,
			customColorsLight: state.customColorsLight,
			customColorsDark: state.customColorsDark,
			customRadius: state.customRadius,
			customFont: font,
			applyFontGlobally: applyGlobally,
			savedPresets: saved,
		})
	},

	// Change active preset
	setActivePreset: (id: string) => {
		set({
			activePresetId: id,
			customColorsLight: {},
			customColorsDark: {},
			customRadius: undefined,
		})

		// Persist
		themeStateStorage.setValue({
			activePresetId: id,
			customColorsLight: {},
			customColorsDark: {},
			customRadius: undefined,
		})
	},

	// Set custom color
	setCustomColor: (key: keyof ThemeColors, value: string, mode: 'light' | 'dark') => {
		const state = get()

		if (mode === 'light') {
			const newColors = { ...state.customColorsLight, [key]: value }
			set({ customColorsLight: newColors })
			themeStateStorage.setValue({
				activePresetId: state.activePresetId,
				customColorsLight: newColors,
				customColorsDark: state.customColorsDark,
				customRadius: state.customRadius,
			})
		} else {
			const newColors = { ...state.customColorsDark, [key]: value }
			set({ customColorsDark: newColors })
			themeStateStorage.setValue({
				activePresetId: state.activePresetId,
				customColorsLight: state.customColorsLight,
				customColorsDark: newColors,
				customRadius: state.customRadius,
			})
		}
	},

	// Set custom radius
	setCustomRadius: (radius: string) => {
		const state = get()
		set({ customRadius: radius })
		themeStateStorage.setValue({
			activePresetId: state.activePresetId,
			customColorsLight: state.customColorsLight,
			customColorsDark: state.customColorsDark,
			customRadius: radius,
		})
	},

	// Set custom font
	setCustomFont: (font: string) => {
		set({ customFont: font })
		customFontStorage.setValue(font)
	},

	// Set if font should be applied globally
	setApplyFontGlobally: (apply: boolean) => {
		set({ applyFontGlobally: apply })
		applyFontGloballyStorage.setValue(apply)
	},

	// Reset custom colors
	resetCustomColors: () => {
		const state = get()
		set({
			customColorsLight: {},
			customColorsDark: {},
			customRadius: undefined,
		})
		themeStateStorage.setValue({
			activePresetId: state.activePresetId,
			customColorsLight: {},
			customColorsDark: {},
			customRadius: undefined,
		})
	},

	// Generate random theme (preview only, does NOT save)
	generateRandom: (harmony?: ColorHarmony) => {
		const randomPreset = validateAndFixTheme(generateRandomTheme({ harmony }))

		// Apply colors as customColors on top of current preset
		// We do NOT save as new preset - user must click "Save" manually
		set({
			customColorsLight: randomPreset.colors.light,
			customColorsDark: randomPreset.colors.dark,
			customRadius: randomPreset.radius,
		})

		// Persist only custom colors
		const state = get()
		themeStateStorage.setValue({
			activePresetId: state.activePresetId,
			customColorsLight: randomPreset.colors.light,
			customColorsDark: randomPreset.colors.dark,
			customRadius: randomPreset.radius,
		})
	},

	// Save current state as a new preset
	saveCurrentAsPreset: (name: string) => {
		const state = get()

		// Get base preset
		const basePreset =
			getPresetById(state.activePresetId) ||
			state.savedPresets.find(p => p.id === state.activePresetId) ||
			defaultPreset

		// Combine with customColors to get actual current colors
		const currentColors = {
			light: { ...basePreset.colors.light, ...state.customColorsLight },
			dark: { ...basePreset.colors.dark, ...state.customColorsDark },
		}

		const newPreset: ThemePreset = {
			id: `custom-${Date.now()}`,
			name,
			description: 'Custom theme',
			colors: currentColors,
			radius: state.customRadius ?? basePreset.radius ?? '0.625rem',
		}

		const newSaved = [...state.savedPresets, newPreset]
		set({
			savedPresets: newSaved,
			activePresetId: newPreset.id,
			customColorsLight: {},
			customColorsDark: {},
			customRadius: undefined,
		})

		savedPresetsStorage.setValue(newSaved)
		themeStateStorage.setValue({
			activePresetId: newPreset.id,
			customColorsLight: {},
			customColorsDark: {},
			customRadius: undefined,
		})
	},

	// Update an existing preset
	updatePreset: (id: string, name?: string) => {
		const state = get()

		// Find the preset to update
		const existingIndex = state.savedPresets.findIndex(p => p.id === id)
		if (existingIndex === -1) return // Can't update if not found

		const existingPreset = state.savedPresets[existingIndex]

		// Combine existing preset colors with current custom colors
		const updatedColors = {
			light: { ...existingPreset.colors.light, ...state.customColorsLight },
			dark: { ...existingPreset.colors.dark, ...state.customColorsDark },
		}

		// Ensure radius is never undefined. Prioritize customRadius, then existing, then default.
		const finalRadius = state.customRadius ?? existingPreset.radius ?? '0.625rem'

		const updatedPreset: ThemePreset = {
			...existingPreset,
			name: name || existingPreset.name,
			colors: updatedColors,
			radius: finalRadius,
		}

		// Update the array
		const newSaved = [...state.savedPresets]
		newSaved[existingIndex] = updatedPreset

		set({
			savedPresets: newSaved,
			// Clear custom changes as they are now saved
			customColorsLight: {},
			customColorsDark: {},
			customRadius: undefined,
		})

		savedPresetsStorage.setValue(newSaved)

		// Update persistent state to reflect clean slate
		themeStateStorage.setValue({
			activePresetId: id,
			customColorsLight: {},
			customColorsDark: {},
			customRadius: undefined,
		})
	},

	// Duplicate a preset
	duplicatePreset: (id: string) => {
		const state = get()

		// Find source preset (can be built-in or saved)
		const sourcePreset = getPresetById(id) || state.savedPresets.find(p => p.id === id)
		if (!sourcePreset) return // Should not happen

		const newPreset: ThemePreset = {
			...sourcePreset,
			id: `custom-${Date.now()}`,
			name: `Copia de ${sourcePreset.name}`,
			description: `Copia basada en ${sourcePreset.name}`,
		}

		const newSaved = [...state.savedPresets, newPreset]
		set({
			savedPresets: newSaved,
			activePresetId: newPreset.id,
			// Reset custom changes when switching to new duplicate
			customColorsLight: {},
			customColorsDark: {},
			customRadius: undefined,
		})

		savedPresetsStorage.setValue(newSaved)
		themeStateStorage.setValue({
			activePresetId: newPreset.id,
			customColorsLight: {},
			customColorsDark: {},
			customRadius: undefined,
		})
	},

	// Delete a saved preset
	deletePreset: (id: string) => {
		const state = get()
		const newSaved = state.savedPresets.filter(p => p.id !== id)
		set({ savedPresets: newSaved })
		savedPresetsStorage.setValue(newSaved)

		// If active preset is deleted, revert to mediavida
		if (state.activePresetId === id) {
			set({ activePresetId: 'mediavida' })
			themeStateStorage.setValue({
				activePresetId: 'mediavida',
				customColorsLight: {},
				customColorsDark: {},
				customRadius: undefined,
			})
		}
	},

	// Import preset from JSON
	importPreset: (preset: ThemePreset) => {
		const state = get()

		// Assign new ID to avoid collisions
		const importedPreset: ThemePreset = {
			...preset,
			id: `imported-${Date.now()}`,
		}

		const newSaved = [...state.savedPresets, importedPreset]
		set({
			savedPresets: newSaved,
			activePresetId: importedPreset.id,
			customColorsLight: {},
			customColorsDark: {},
		})

		savedPresetsStorage.setValue(newSaved)
		themeStateStorage.setValue({
			activePresetId: importedPreset.id,
			customColorsLight: {},
			customColorsDark: {},
			customRadius: undefined,
		})
	},

	// Export current theme as JSON
	exportCurrentTheme: (name: string): ThemeExport => {
		const currentPreset = get().activePreset

		return {
			version: 1,
			name,
			exportedAt: new Date().toISOString(),
			preset: {
				...currentPreset,
				id: 'exported',
				name,
			},
		}
	},

	// Import multiple presets from exported JSON
	importPresets: (presets: ThemePreset[]) => {
		const state = get()

		// Assign new IDs to avoid collisions
		const importedPresets: ThemePreset[] = presets.map((preset, index) => ({
			...preset,
			id: `imported-${Date.now()}-${index}`,
		}))

		const newSaved = [...state.savedPresets, ...importedPresets]
		set({
			savedPresets: newSaved,
			// Activate the first imported preset
			activePresetId: importedPresets[0]?.id ?? state.activePresetId,
			customColorsLight: {},
			customColorsDark: {},
		})

		savedPresetsStorage.setValue(newSaved)
		themeStateStorage.setValue({
			activePresetId: importedPresets[0]?.id ?? state.activePresetId,
			customColorsLight: {},
			customColorsDark: {},
			customRadius: undefined,
		})
	},

	// Export all saved (custom) presets
	exportAllSavedPresets: () => {
		const state = get()
		if (state.savedPresets.length === 0) return null

		return {
			version: 1,
			exportedAt: new Date().toISOString(),
			presets: state.savedPresets,
		}
	},
}))
