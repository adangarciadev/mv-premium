/**
 * ErrorBoundary
 *
 * React Error Boundary component that catches rendering errors.
 * Uses react-error-boundary under the hood with custom fallback UIs.
 *
 * Features:
 * - Full and compact fallback modes
 * - Reset config button for state-related errors
 * - Shadcn/Tailwind styling
 * - Works inside Shadow DOM
 */
import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { logger } from '@/lib/logger'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import Settings from 'lucide-react/dist/esm/icons/settings'
import Bug from 'lucide-react/dist/esm/icons/bug'
import { Button } from '@/components/ui/button'
import type { ReactNode } from 'react'

import { storage } from '@wxt-dev/storage'

/**
 * Resets extension settings and reloads the page
 * Used as a recovery mechanism in the Error Boundary
 */
async function handleResetSettings(): Promise<void> {
	try {
		await storage.removeItem('local:settings')
		window.location.reload()
	} catch (e) {
		logger.error('Failed to reset settings:', e)
	}
}

/**
 * Full page error fallback UI
 */
export function ErrorFallbackFull({ error, resetErrorBoundary }: FallbackProps) {
	return (
		<div className="p-6">
			<div
				className="flex flex-col items-center justify-center bg-card border border-destructive/30 rounded-xl text-center min-h-50 p-6"
				role="alert"
				aria-live="assertive"
			>
				<div className="flex items-center justify-center w-14 h-14 rounded-full bg-destructive/10 mb-4">
					<Bug className="h-7 w-7 text-destructive" />
				</div>
				<h2 className="text-lg font-semibold text-foreground mb-2">Algo salió mal</h2>
				<p className="text-sm text-muted-foreground mb-4 max-w-xs">
					Un componente de la extensión ha fallado. Puedes intentar recargarlo o resetear la configuración.
				</p>

				{error && (
					<details className="w-full max-w-sm mb-4 text-left">
						<summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
							Ver detalles del error
						</summary>
						<pre className="mt-2 p-3 rounded bg-muted/50 text-xs overflow-auto max-h-24 font-mono text-foreground">
							{error.message}
						</pre>
					</details>
				)}

				<div className="flex items-center gap-2">
					<Button variant="default" size="sm" onClick={resetErrorBoundary} className="gap-1.5">
						<RefreshCw className="h-4 w-4" />
						Reintentar
					</Button>

					<Button variant="outline" size="sm" onClick={handleResetSettings} className="gap-1.5">
						<Settings className="h-4 w-4" />
						Resetear config
					</Button>
				</div>

				<p className="text-xs text-muted-foreground mt-4">Si el problema persiste, recarga la página (F5).</p>
			</div>
		</div>
	)
}

/**
 * Inline/Compact error fallback UI
 */
export function ErrorFallbackCompact({ error, resetErrorBoundary }: FallbackProps) {
	return (
		<div className="inline-flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-lg text-sm">
			<AlertTriangle className="w-4 h-4 text-destructive shrink-0" aria-hidden="true" />
			<span className="text-foreground">Error al cargar componente</span>
			<button
				onClick={resetErrorBoundary}
				className="ml-2 p-1 hover:bg-destructive/20 rounded transition-colors"
				title="Reintentar"
			>
				<RefreshCw className="h-3.5 w-3.5 text-destructive" />
			</button>
		</div>
	)
}

/**
 * Minimal icon-only error fallback UI
 */
export function ErrorFallbackMinimal({ resetErrorBoundary }: FallbackProps) {
	return (
		<button
			onClick={resetErrorBoundary}
			className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 rounded transition-colors"
			title="Error - Click para reintentar"
		>
			<AlertTriangle className="h-3.5 w-3.5" />
			<RefreshCw className="h-3 w-3" />
		</button>
	)
}

interface AppErrorBoundaryProps {
	children: ReactNode
	fallback?: ReactNode
	onReset?: () => void
	onError?: (error: Error, info: React.ErrorInfo) => void
	variant?: 'full' | 'compact' | 'minimal'
}

/**
 * AppErrorBoundary component - Root error boundary for the application
 * @param children - Components to wrap
 * @param fallback - Optional custom fallback UI
 * @param onReset - Callback when the error is reset
 * @param onError - Callback when an error is caught
 * @param variant - Visual style of the fallback UI
 */
export function AppErrorBoundary({ children, fallback, onReset, onError, variant = 'full' }: AppErrorBoundaryProps) {
	const handleError = (error: Error, info: React.ErrorInfo) => {
		logger.error('ErrorBoundary caught an error:', error)
		logger.error('Component stack:', info.componentStack)
		onError?.(error, info)
	}

	if (fallback) {
		return (
			<ReactErrorBoundary fallback={fallback} onError={handleError} onReset={onReset}>
				{children}
			</ReactErrorBoundary>
		)
	}

	const FallbackComponent =
		variant === 'minimal' ? ErrorFallbackMinimal : variant === 'compact' ? ErrorFallbackCompact : ErrorFallbackFull

	return (
		<ReactErrorBoundary FallbackComponent={FallbackComponent} onError={handleError} onReset={onReset}>
			{children}
		</ReactErrorBoundary>
	)
}
