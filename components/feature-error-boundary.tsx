/**
 * Feature Error Boundary
 *
 * Specialized error boundary for content script features.
 * Catches errors in individual features without crashing the entire extension.
 *
 * Features:
 * - Logs feature name for easy debugging
 * - Minimal fallback UI that doesn't disrupt page layout
 * - Optional custom fallback
 */
import { Component, ErrorInfo, ReactNode } from 'react'
import { logger } from '@/lib/logger'

interface FeatureErrorBoundaryProps {
	featureName: string
	children?: ReactNode
	fallback?: ReactNode
	showFallback?: boolean
}

interface FeatureErrorBoundaryState {
	hasError: boolean
	error: Error | null
}

/**
 * FeatureErrorBoundary class component - Catches errors in individual features
 */
export class FeatureErrorBoundary extends Component<FeatureErrorBoundaryProps, FeatureErrorBoundaryState> {
	constructor(props: FeatureErrorBoundaryProps) {
		super(props)
		this.state = { hasError: false, error: null }
	}

	static getDerivedStateFromError(error: Error): FeatureErrorBoundaryState {
		return { hasError: true, error }
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		logger.error(`Error in feature "${this.props.featureName}":`, error, '\nComponent Stack:', errorInfo.componentStack)
	}

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback
			}

			if (this.props.showFallback === false) {
				return null
			}

			return (
				<div
					className="mvp-feature-error"
					style={{
						padding: '8px 12px',
						fontSize: '11px',
						color: '#ef4444',
						backgroundColor: 'rgba(239, 68, 68, 0.1)',
						borderRadius: 'var(--radius, 4px)',
						border: '1px solid rgba(239, 68, 68, 0.2)',
					}}
					title={this.state.error?.message}
				>
					⚠️ Error en {this.props.featureName}
				</div>
			)
		}

		return this.props.children
	}
}

/**
 * HOC to wrap a component with a FeatureErrorBoundary
 * @param WrappedComponent - The component to protect
 * @param featureName - Technical name for logging
 * @param options - Error boundary behavior options
 * @returns Protected component
 */
export function withFeatureErrorBoundary<P extends object>(
	WrappedComponent: React.ComponentType<P>,
	featureName: string,
	options?: { fallback?: ReactNode; showFallback?: boolean }
) {
	const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component'

	const WithErrorBoundary = (props: P) => (
		<FeatureErrorBoundary featureName={featureName} fallback={options?.fallback} showFallback={options?.showFallback}>
			<WrappedComponent {...props} />
		</FeatureErrorBoundary>
	)

	WithErrorBoundary.displayName = `withFeatureErrorBoundary(${displayName})`

	return WithErrorBoundary
}
