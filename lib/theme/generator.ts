import { CSS_VAR_MAP, type ThemeColors } from '@/types/theme'
import { themeStateStorage, savedPresetsStorage, type Theme } from './storage'

// FIX: Import presets statically.
// Being an extension, manual code splitting here hurts build performance.
import { ALL_PRESETS } from '@/features/theme-editor/presets'

/**
 * Get colors for the active preset (built-in or saved)
 */
export async function getActivePresetColors(theme: Theme): Promise<Partial<ThemeColors>> {
	const state = await themeStateStorage.getValue()
	if (!state) return {}

	const customColors = theme === 'dark' ? state.customColorsDark : state.customColorsLight

	// Try to get saved preset colors first
	const savedPresets = await savedPresetsStorage.getValue()
	const savedPreset = savedPresets?.find(p => p.id === state.activePresetId)

	if (savedPreset) {
		const baseColors = theme === 'dark' ? savedPreset.colors.dark : savedPreset.colors.light
		return { ...baseColors, ...customColors }
	}

	// FIX: Removed dynamic try/catch import(...) block
	// Using ALL_PRESETS imported above directly.
	const builtInPreset = ALL_PRESETS.find(p => p.id === state.activePresetId)

	if (builtInPreset) {
		const baseColors = theme === 'dark' ? builtInPreset.colors.dark : builtInPreset.colors.light
		return { ...baseColors, ...customColors }
	}

	return customColors || {}
}

/**
 * Get the radius for the active preset
 */
export async function getActivePresetRadius(): Promise<string | undefined> {
	const state = await themeStateStorage.getValue()
	if (!state) return undefined

	// 1. Custom radius (editing mode)
	if (state.customRadius) return state.customRadius

	// 2. Saved preset
	const savedPresets = await savedPresetsStorage.getValue()
	const savedPreset = savedPresets?.find(p => p.id === state.activePresetId)
	if (savedPreset?.radius) return savedPreset.radius

	// 3. Built-in preset
	const builtInPreset = ALL_PRESETS.find(p => p.id === state.activePresetId)
	if (builtInPreset?.radius) return builtInPreset.radius

	// 4. Default fallback (should technically be covered by built-in, but just in case)
	return '0.625rem'
}

/**
 * Generate CSS string with theme variables for Shadow DOM injection.
 *
 * IMPORTANT: We generate SEPARATE rules for dark and light modes.
 * The `colors` parameter should contain the colors for ONE mode only.
 * The consuming code should call this twice (once per mode) if needed.
 */
export function generateThemeCSS(
	colors: Partial<ThemeColors>,
	options?: {
		mode?: 'dark' | 'light' | 'both'
		radius?: string
		font?: string
	}
): string {
	const { mode = 'both', radius, font } = options || {}
	const vars: string[] = []

	for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
		const value = colors[key as keyof ThemeColors]
		if (value) {
			// Use !important to override base theme.css defaults
			vars.push(`${cssVar}: ${value} !important;`)
		}
	}

	if (radius) {
		vars.push(`--radius: ${radius} !important;`)
	}

	if (font) {
		vars.push(`--font-sans: "${font}", system-ui, sans-serif !important;`)
	}

	if (vars.length === 0) return ''

	const varsStr = vars.join(' ')

	// Generate CSS for the specified mode(s)
	switch (mode) {
		case 'dark':
			// Apply to dark mode selectors - include #mvp-shadow-content.dark for dialog/dropdown specificity
			return `:host(.dark) { ${varsStr} } .dark { ${varsStr} } #mvp-shadow-content.dark { ${varsStr} }`
		case 'light':
			// Apply to light mode selectors - mirrors dark mode pattern
			return `:host(.light) { ${varsStr} } .light { ${varsStr} } #mvp-shadow-content.light { ${varsStr} }`
		case 'both':
		default:
			// Apply to all (for global overrides like font/radius)
			return `:host { ${varsStr} } :root { ${varsStr} } .dark { ${varsStr} } .light { ${varsStr} }`
	}
}
