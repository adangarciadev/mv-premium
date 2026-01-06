
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'
import type { ThemeColors, ThemePreset } from '@/types/theme'

export type Theme = 'dark' | 'light'

// Theme state storage (same key as theme-store.ts)
export interface StoredThemeState {
	activePresetId: string
	customColorsLight: Partial<ThemeColors>
	customColorsDark: Partial<ThemeColors>
	customRadius?: string
}

// Define typed storage items
export const themeStorage = storage.defineItem<Theme>(`local:${STORAGE_KEYS.THEME}`, {
	defaultValue: 'dark',
})

export const themeStateStorage = storage.defineItem<StoredThemeState>(
	`local:${STORAGE_KEYS.THEME_CUSTOM}`,
	{
		defaultValue: {
			activePresetId: 'mediavida',
			customColorsLight: {},
			customColorsDark: {},
			customRadius: undefined,
		},
	}
)

// Saved presets storage
export const savedPresetsStorage = storage.defineItem<ThemePreset[]>(
	`local:${STORAGE_KEYS.THEME_SAVED_PRESETS}`,
	{
		defaultValue: [],
	}
)

// Custom font storage
export const customFontStorage = storage.defineItem<string>(
	`local:${STORAGE_KEYS.CUSTOM_FONT}`,
	{
		defaultValue: '',
	}
)

// Apply font globally storage
export const applyFontGloballyStorage = storage.defineItem<boolean>(
	`local:${STORAGE_KEYS.APPLY_FONT_GLOBALLY}`,
	{
		defaultValue: false,
	}
)
