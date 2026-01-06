/**
 * App Provider - Root provider for all React components
 * Wraps ThemeProvider, QueryClientProvider and Toaster for both content script and popup
 */
import { useEffect, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { queryClient } from '../lib/query-client'
import { ThemeProvider } from './theme-provider'
import { ThemeColorsProvider } from './theme-colors-provider'
import { useSettingsStore, hasHydrated, initCrossTabSync } from '@/store/settings-store'
import { AppErrorBoundary } from '@/components/error-boundary'
import type { PropsWithChildren } from 'react'

interface AppProviderProps extends PropsWithChildren {
	/** Whether to show the Toaster (default: true) */
	withToaster?: boolean
	/** Apply dark mode class to wrapper (default: true for content scripts) */
	darkMode?: boolean
	/** Additional classes for the wrapper div */
	className?: string
}

/**
 * Root provider component that wraps:
 * - ThemeProvider for dark mode
 * - QueryClientProvider for TanStack Query
 * - Toaster for sonner notifications
 * - ReactQueryDevtools (development only, first instance only)
 *
 * Use this to wrap all React trees in content script and popup
 */
export function AppProvider({ children, withToaster = true, darkMode = true, className = '' }: AppProviderProps) {
	const [isReady, setIsReady] = useState(hasHydrated())

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

	// Enable cross-tab sync for real-time settings updates
	useEffect(() => {
		if (!isReady) return
		const unwatch = initCrossTabSync()
		return () => unwatch()
	}, [isReady])

	// Show nothing while loading to prevent flash of default values
	if (!isReady) {
		return null
	}

	return (
		<ThemeProvider defaultTheme={darkMode ? 'dark' : 'light'}>
			<ThemeColorsProvider>
				<QueryClientProvider client={queryClient}>
					<div className={className}>
						<AppErrorBoundary variant="full">{children}</AppErrorBoundary>
						{withToaster && <Toaster />}
					</div>
				</QueryClientProvider>
			</ThemeColorsProvider>
		</ThemeProvider>
	)
}
