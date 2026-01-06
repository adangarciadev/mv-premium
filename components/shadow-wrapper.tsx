/**
 * ShadowWrapper
 *
 * Reusable wrapper that encapsulates content in a Shadow DOM
 * and injects the full Tailwind Preflight + Theme (shadow.css).
 * Use this for any component injected into the global DOM that needs isolation.
 *
 * Theme is read from browser.storage.local and synced with dashboard settings.
 * Also applies custom theme colors from the active preset.
 *
 * Includes ErrorBoundary for robustness - if a component fails, it shows
 * a user-friendly error UI instead of breaking the entire injection.
 */
import { useCallback, useRef, useEffect, ReactNode } from 'react'
import { ShadowRoot } from '@/lib/shadow-root'
import { useStoredTheme } from '@/hooks/use-stored-theme'
import { applyThemeColorsToShadow } from '@/lib/theme-sync'
import { AppErrorBoundary } from '@/components/error-boundary'
import { SHADOW_CSS } from '@/assets/shadow-styles'

interface ShadowWrapperProps {
	children: ReactNode
	className?: string
	errorVariant?: 'full' | 'compact' | 'minimal'
	noErrorBoundary?: boolean
}

/**
 * ShadowWrapper component - Encapsulates content in a Shadow DOM
 * Handles theme synchronization and automatic error boundary wrapping.
 * @param children - Content to isolate
 * @param className - Component container classes
 * @param errorVariant - Style for the internal ErrorBoundary
 * @param noErrorBoundary - If true, prevents wrapping children in an ErrorBoundary
 */
export function ShadowWrapper({
	children,
	className,
	errorVariant = 'compact',
	noErrorBoundary = false,
}: ShadowWrapperProps) {
	const theme = useStoredTheme()
	const cleanupRef = useRef<(() => void) | null>(null)

	const handleShadowRoot = useCallback((shadowRoot: ShadowRoot) => {
		cleanupRef.current = applyThemeColorsToShadow(shadowRoot)
	}, [])

	useEffect(() => {
		return () => {
			cleanupRef.current?.()
		}
	}, [])

	const content = noErrorBoundary ? children : <AppErrorBoundary variant={errorVariant}>{children}</AppErrorBoundary>

	return (
		<ShadowRoot
			styles={SHADOW_CSS}
			className={className}
			themeClassName={theme}
			innerClassName="text-foreground antialiased"
			onShadowRoot={handleShadowRoot}
		>
			{content}
		</ShadowRoot>
	)
}
