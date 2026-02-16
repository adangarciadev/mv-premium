import { browser, type Browser } from 'wxt/browser'
import { themeStorage, customFontStorage, type Theme } from './storage'
import { getActivePresetColors, getActivePresetRadius, generateThemeCSS } from './generator'
import { DOM_MARKERS } from '@/constants/dom-markers'
import { STORAGE_KEYS } from '@/constants/storage-keys'
import { CSS_VAR_MAP, type ThemeColors } from '@/types/theme'
import { ensureGoogleFontLoaded } from './fonts'

// Track which elements already have theme applied (prevents duplicate listeners)
const initializedThemeElements = new WeakSet<HTMLElement>()

/**
 * Apply the stored theme class to an element and listen for changes.
 * Only applies dark/light class, NOT custom colors.
 * Idempotent: calling multiple times on the same element has no effect.
 */
export function applyStoredTheme(element: HTMLElement, defaultTheme: Theme = 'dark'): () => void {
	// Skip if already initialized (prevents duplicate listeners)
	if (initializedThemeElements.has(element)) {
		return () => {} // Return no-op cleanup
	}
	initializedThemeElements.add(element)

	element.classList.add(defaultTheme)

	const applyTheme = (theme: Theme) => {
		element.classList.remove('dark', 'light')
		element.classList.add(theme)
	}

	// Initial application
	themeStorage.getValue().then(theme => {
		applyTheme(theme || defaultTheme)
	})

	// Listen for theme mode changes
	const listener = (changes: Record<string, Browser.storage.StorageChange>, areaName: string) => {
		if (areaName === 'local' && changes[STORAGE_KEYS.THEME]) {
			const newTheme = (changes[STORAGE_KEYS.THEME].newValue as Theme) || defaultTheme
			applyTheme(newTheme)
		}
	}

	browser.storage.onChanged.addListener(listener)

	return () => {
		browser.storage.onChanged.removeListener(listener)
	}
}

// Track which shadow roots already have theme colors applied (prevents duplicate listeners)
const initializedShadowRoots = new WeakSet<ShadowRoot>()

/**
 * Apply theme colors to a Shadow DOM by injecting/updating a dynamic style tag.
 * This is the correct way to override CSS variables inside Shadow DOM.
 * Idempotent: calling multiple times on the same shadowRoot has no effect.
 */
export function applyThemeColorsToShadow(shadowRoot: ShadowRoot): () => void {
	// Skip if already initialized (prevents duplicate listeners)
	if (initializedShadowRoots.has(shadowRoot)) {
		return () => {} // Return no-op cleanup
	}
	initializedShadowRoots.add(shadowRoot)

	const STYLE_ID = DOM_MARKERS.IDS.DYNAMIC_THEME

	// Create style element
	const styleEl = document.createElement('style')
	styleEl.id = STYLE_ID
	shadowRoot.appendChild(styleEl)

	const updateColors = async () => {
		// Get colors for BOTH modes to ensure proper theme switching
		const darkColors = await getActivePresetColors('dark')
		const lightColors = await getActivePresetColors('light')
		const radius = await getActivePresetRadius()
		const font = await customFontStorage.getValue()

		// Generate CSS for each mode separately
		const darkCss = generateThemeCSS(darkColors, { mode: 'dark' })
		const lightCss = generateThemeCSS(lightColors, { mode: 'light' })

		// Generate global CSS for radius and font (applies to both modes)
		const globalCss = generateThemeCSS(
			{},
			{
				mode: 'both',
				radius,
				font: font || undefined,
			}
		)

		// Load Google Font globally (fonts can't be loaded inside Shadow DOM)
		if (font) {
			ensureGoogleFontLoaded(font)
		}

		if (styleEl) {
			// Combine all CSS rules
			styleEl.textContent = [darkCss, lightCss, globalCss].filter(Boolean).join('\n')
		}
	}

	// Initial update
	updateColors()

	// Listen for all theme-related changes (including font)
	const listener = (changes: Record<string, Browser.storage.StorageChange>, areaName: string) => {
		if (areaName === 'local') {
			if (
				changes[STORAGE_KEYS.THEME] ||
				changes[STORAGE_KEYS.THEME_CUSTOM] ||
				changes[STORAGE_KEYS.THEME_SAVED_PRESETS] ||
				changes[STORAGE_KEYS.CUSTOM_FONT]
			) {
				updateColors()
			}
		}
	}

	browser.storage.onChanged.addListener(listener)

	return () => {
		browser.storage.onChanged.removeListener(listener)
	}
}

// Track if global theme listener is already initialized
let globalThemeListenerInitialized = false

/**
 * Initialize global theme colors listener
 * This applies theme color variables to the document :root for global scrollbars, etc.
 * Also applies the theme class (dark/light) to documentElement for Light DOM components.
 */
export function initGlobalThemeListener(): () => void {
	if (globalThemeListenerInitialized) return () => {}
	globalThemeListenerInitialized = true

	const STYLE_ID = DOM_MARKERS.IDS.GLOBAL_THEME_VARS
	const SCROLLBAR_STYLE_ID = DOM_MARKERS.IDS.GLOBAL_SCROLLBAR

	const updateGlobalThemeVars = async () => {
		const theme = (await themeStorage.getValue()) || 'dark'
		const colors = await getActivePresetColors(theme)
		const radius = await getActivePresetRadius()

		// Apply theme class to documentElement for Light DOM components using Tailwind
		document.documentElement.classList.remove('dark', 'light')
		document.documentElement.classList.add(theme)

		// Remove existing styles
		document.getElementById(STYLE_ID)?.remove()
		document.getElementById(SCROLLBAR_STYLE_ID)?.remove()

		// Generate CSS vars for :root (with !important to override theme.css)
		const vars: string[] = []
		for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
			const value = colors[key as keyof ThemeColors]
			if (value) {
				vars.push(`${cssVar}: ${value} !important;`)
			}
		}
		if (radius) {
			vars.push(`--radius: ${radius} !important;`)
		}

		if (vars.length === 0) return

		// Create style that updates :root AND .dark/.light variables
		// This ensures Light DOM components with Tailwind classes work correctly
		const style = document.createElement('style')
		style.id = STYLE_ID
		const varsStr = vars.join(' ')
		// Apply to :root, .dark, and .light to cover all cases
		// Also target html element directly for maximum specificity
		style.textContent = `html, :root { ${varsStr} } html.dark, .dark { ${varsStr} } html.light, .light { ${varsStr} }`
		document.head.appendChild(style)

		// Chrome caches scrollbar styles based on concrete values, not CSS variables
		// So we need to inject scrollbar styles with actual color values
		const mutedForeground = colors.mutedForeground
		const foreground = colors.foreground

		if (mutedForeground || foreground) {
			const scrollbarStyle = document.createElement('style')
			scrollbarStyle.id = SCROLLBAR_STYLE_ID
			// Use the same selectors as theme.css but with concrete values
			// This overrides the CSS variable-based scrollbar in theme.css
			scrollbarStyle.textContent = `
				::-webkit-scrollbar-thumb {
					background-color: ${mutedForeground || 'var(--muted-foreground)'} !important;
				}
				::-webkit-scrollbar-thumb:hover {
					background-color: ${foreground || 'var(--foreground)'} !important;
				}
				.custom-scroll {
					scrollbar-color: ${mutedForeground || 'var(--muted-foreground)'} transparent !important;
				}
			`
			document.head.appendChild(scrollbarStyle)
		}
	}

	// Initial update
	updateGlobalThemeVars()

	// Listen for theme changes
	const listener = (changes: Record<string, Browser.storage.StorageChange>, areaName: string) => {
		if (areaName === 'local') {
			const themeKeys: string[] = [STORAGE_KEYS.THEME, STORAGE_KEYS.THEME_CUSTOM, STORAGE_KEYS.THEME_SAVED_PRESETS]
			const changedKeys = Object.keys(changes).filter(k => themeKeys.includes(k))
			if (changedKeys.length > 0) {
				updateGlobalThemeVars()
			}
		}
	}

	browser.storage.onChanged.addListener(listener)

	return () => {
		browser.storage.onChanged.removeListener(listener)
		globalThemeListenerInitialized = false
	}
}
