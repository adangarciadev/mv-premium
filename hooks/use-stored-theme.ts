/**
 * useStoredTheme Hook
 *
 * Reads and listens to the UI theme from storage.
 * This enables theme synchronization between the dashboard (options page)
 * and all content script injected components (Shadow DOM).
 *
 * Uses WXT unified storage API with .watch() for reactivity
 */
import { useState, useEffect } from 'react'
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'

type ResolvedTheme = string

// Define typed storage item
const themeStorage = storage.defineItem<string>(`local:${STORAGE_KEYS.THEME}`, {
	defaultValue: 'dark',
})

/**
 * Hook that returns the current resolved theme ('dark' | 'light')
 * and automatically updates when the theme changes in storage.
 */
export function useStoredTheme(): ResolvedTheme {
	const [theme, setTheme] = useState<ResolvedTheme>('dark') // Default to dark

	useEffect(() => {
		// Read initial value from storage
		themeStorage.getValue().then(stored => {
			if (stored === 'light' || stored === 'dark') {
				setTheme(stored)
			}
		})

		// Listen for changes using WXT .watch() API
		const unwatch = themeStorage.watch(newValue => {
			if (newValue === 'light' || newValue === 'dark') {
				setTheme(newValue)
			}
		})

		return unwatch
	}, [])

	return theme
}
