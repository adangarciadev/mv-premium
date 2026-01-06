/**
 * Lite App Provider - Lightweight provider for content scripts
 *
 * IMPORTANT: This provider does NOT include TanStack Query to avoid
 * bundling heavy dependencies into the main content script.
 *
 * For features that need React Query, use the full AppProvider instead.
 */
import { useEffect, useState } from 'react'
import { ThemeProvider } from './theme-provider'
import { ThemeColorsProvider } from './theme-colors-provider'
import { useSettingsStore, hasHydrated } from '@/store/settings-store'
import { AppErrorBoundary } from '@/components/error-boundary'
import { Toaster } from '@/components/ui/sonner'
import type { PropsWithChildren } from 'react'

// Global flag to prevent multiple Toaster mounts
let toasterMounted = false

interface LiteAppProviderProps extends PropsWithChildren {
	/** Apply dark mode class to wrapper (default: true for content scripts) */
	darkMode?: boolean
	/** Additional classes for the wrapper div */
	className?: string
}

/**
 * Lightweight provider for content scripts.
 *
 * Includes:
 * - ThemeProvider for dark mode
 * - ThemeColorsProvider for user-defined colors
 * - AppErrorBoundary for error handling
 * - Toaster for toast notifications (only mounted once globally)
 *
 * Does NOT include:
 * - QueryClientProvider (TanStack Query)
 *
 * Use this for content script features to keep bundle size small.
 */
export function LiteAppProvider({ children, darkMode = true, className = '' }: LiteAppProviderProps) {
	const [isReady, setIsReady] = useState(hasHydrated())
	const [shouldRenderToaster] = useState(() => {
		// Only the first LiteAppProvider instance renders the Toaster
		if (!toasterMounted) {
			toasterMounted = true
			return true
		}
		return false
	})

	// Rehydrate settings store from browser.storage.local
	useEffect(() => {
		if (hasHydrated()) {
			setIsReady(true)
			return
		}

		// Trigger rehydration and wait for it to complete
		useSettingsStore.persist.rehydrate()

		// Subscribe to store changes to detect when hydration completes
		const unsubscribe = useSettingsStore.persist.onFinishHydration(() => {
			setIsReady(true)
		})

		return () => unsubscribe?.()
	}, [])

	// Show nothing while loading to prevent flash of default values
	if (!isReady) {
		return null
	}

	return (
		<ThemeProvider defaultTheme={darkMode ? 'dark' : 'light'}>
			<ThemeColorsProvider>
				<div className={className}>
					<AppErrorBoundary variant="full">{children}</AppErrorBoundary>
					{shouldRenderToaster && <Toaster />}
				</div>
			</ThemeColorsProvider>
		</ThemeProvider>
	)
}
