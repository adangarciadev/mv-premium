/**
 * Theme Provider
 * Provides dark/light mode context for the dashboard and content scripts
 *
 * Uses WXT unified storage API as single source of truth for theme persistence
 * across all contexts (dashboard, content scripts, popup).
 *
 * Supports custom theme presets with full color customization via the Theme Editor.
 */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants/storage-keys'
import { CSS_VAR_MAP, type ThemeColors } from '@/types/theme'

type Theme = 'dark' | 'light' | 'system'
type ResolvedTheme = 'dark' | 'light'

interface ThemeContextValue {
	theme: Theme
	resolvedTheme: ResolvedTheme
	setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

// Define typed storage items for mode only (custom colors are in theme-store)
const themeResolvedStorage = storage.defineItem<ResolvedTheme>(`local:${STORAGE_KEYS.THEME}`, {
	defaultValue: 'dark',
})
const themeRawStorage = storage.defineItem<Theme>(`local:${STORAGE_KEYS.THEME_RAW}`, {
	defaultValue: 'dark',
})

interface ThemeProviderProps {
	children: ReactNode
	defaultTheme?: Theme
}

/** Resolves 'system' theme to 'dark' or 'light' based on user preference */
function resolveTheme(theme: Theme): ResolvedTheme {
	if (theme === 'system') {
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
	}
	return theme
}

/** Syncs the theme mode to storage */
async function saveThemeMode(theme: Theme) {
	const resolved = resolveTheme(theme)
	await themeResolvedStorage.setValue(resolved)
	await themeRawStorage.setValue(theme)
}

/** Applies custom theme colors as CSS variables */
export function applyCustomColors(
	colors: Partial<ThemeColors>,
	root: HTMLElement | ShadowRoot = document.documentElement
) {
	const target = root instanceof ShadowRoot ? (root.host as HTMLElement) : root

	for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
		const value = colors[key as keyof ThemeColors]
		if (value) {
			target.style.setProperty(cssVar, value)
		} else {
			target.style.removeProperty(cssVar)
		}
	}
}

/** Clears all custom theme colors */
export function clearCustomColors(root: HTMLElement | ShadowRoot = document.documentElement) {
	const target = root instanceof ShadowRoot ? (root.host as HTMLElement) : root

	for (const cssVar of Object.values(CSS_VAR_MAP)) {
		target.style.removeProperty(cssVar)
	}
}

export function ThemeProvider({ children, defaultTheme = 'dark' }: ThemeProviderProps) {
	const [theme, setThemeState] = useState<Theme>(defaultTheme)
	const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(resolveTheme(defaultTheme))
	const [isLoaded, setIsLoaded] = useState(false)

	// Load theme from storage on mount AND listen for external changes
	useEffect(() => {
		// Initial load
		Promise.all([themeRawStorage.getValue(), themeResolvedStorage.getValue()]).then(([rawTheme, storedResolved]) => {
			// Try raw preference first (may include 'system')
			if (rawTheme === 'dark' || rawTheme === 'light' || rawTheme === 'system') {
				setThemeState(rawTheme)
				setResolvedTheme(resolveTheme(rawTheme))
			} else if (storedResolved === 'dark' || storedResolved === 'light') {
				// Fallback to resolved theme
				setThemeState(storedResolved)
				setResolvedTheme(storedResolved)
			}
			setIsLoaded(true)
		})

		// Listen for external changes using native browser API (works with both WXT and raw browser.storage)
		const listener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, areaName: string) => {
			if (areaName !== 'local') return

			// Check for raw theme changes
			if (changes[STORAGE_KEYS.THEME_RAW]) {
				const newValue = changes[STORAGE_KEYS.THEME_RAW].newValue as string
				if (newValue === 'dark' || newValue === 'light' || newValue === 'system') {
					setThemeState(newValue)
					setResolvedTheme(resolveTheme(newValue))
				}
			}
		}

		// Import browser and add listener
		import('wxt/browser').then(({ browser }) => {
			browser.storage.onChanged.addListener(listener)
		})

		return () => {
			import('wxt/browser').then(({ browser }) => {
				browser.storage.onChanged.removeListener(listener)
			})
		}
	}, [])

	// Apply theme to DOM and sync to storage
	useEffect(() => {
		if (!isLoaded) return

		const root = window.document.documentElement
		const resolved = resolveTheme(theme)

		// Apply dark/light mode class
		root.classList.remove('light', 'dark')
		root.classList.add(resolved)
		setResolvedTheme(resolved)

		// Save mode to storage
		saveThemeMode(theme)
	}, [theme, isLoaded])

	// Listen for system theme changes when using 'system' mode
	useEffect(() => {
		if (theme !== 'system') return

		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
		const handleChange = () => {
			const root = window.document.documentElement
			const resolved = resolveTheme('system')
			root.classList.remove('light', 'dark')
			root.classList.add(resolved)
			setResolvedTheme(resolved)
			saveThemeMode('system')
		}

		mediaQuery.addEventListener('change', handleChange)
		return () => mediaQuery.removeEventListener('change', handleChange)
	}, [theme])

	const value = {
		theme,
		resolvedTheme,
		setTheme: useCallback((newTheme: Theme) => {
			setThemeState(newTheme)
		}, []),
	}

	// Render children even before load to avoid flash,
	// but initial class will be applied quickly
	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
	const context = useContext(ThemeContext)
	if (context === undefined) {
		throw new Error('useTheme must be used within a ThemeProvider')
	}
	return context
}
