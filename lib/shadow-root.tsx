/**
 * ShadowRoot - Shadow DOM wrapper for CSS isolation
 * Allows using Tailwind CSS and shadcn/ui inside content scripts
 * without style conflicts with the host page
 */
import { useRef, useEffect, useState, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface ShadowRootProps {
	children: ReactNode
	styles?: string
	/** Class name for the HOST element (Light DOM) - Used for layout positioning */
	className?: string
	/** Theme class to apply ('dark' | 'light') - Applied to inner wrapper for CSS variable cascade */
	themeClassName?: string
	/** Class name for the INNER wrapper (Shadow DOM) - Used for font/text inheritance */
	innerClassName?: string
	/** Callback when shadow root is created - use to apply dynamic theme colors */
	onShadowRoot?: (shadowRoot: ShadowRoot) => void
}

/**
 * Creates an isolated Shadow DOM container for React components
 * This prevents CSS conflicts between your components and the host page
 *
 * Theme class is applied to the inner wrapper so CSS variables cascade correctly
 */
export function ShadowRoot({
	children,
	styles,
	className,
	themeClassName,
	innerClassName,
	onShadowRoot,
}: ShadowRootProps) {
	const hostRef = useRef<HTMLDivElement>(null)
	const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null)

	useEffect(() => {
		if (hostRef.current && !hostRef.current.shadowRoot) {
			// Use 'open' in development for debugging, 'closed' in production for security
			const shadowMode = import.meta.env.MODE === 'development' ? 'open' : 'closed'
			const shadow = hostRef.current.attachShadow({ mode: shadowMode })
			setShadowRoot(shadow)
			onShadowRoot?.(shadow)
		}
	}, [onShadowRoot])

	/**
	 * CRITICAL: Firewall for keyboard events
	 * Stop events from bubbling out of the Shadow DOM.
	 * This prevents Mediavida from seeing events originating from our inputs.
	 *
	 * We use the BUBBLING phase (default) so that internal React events work first.
	 * We block ALL key events from escaping, as we want the extension to be isolated.
	 */
	const preventBubbling = useCallback((e: React.KeyboardEvent) => {
		e.stopPropagation()
	}, [])

	return (
		<div ref={hostRef} className={cn('w-full', className, themeClassName)}>
			{shadowRoot &&
				createPortal(
					<>
						{styles && <style>{styles}</style>}
						<div
							className={cn('w-full h-full pointer-events-auto', themeClassName, innerClassName)}
							onKeyDown={preventBubbling}
							onKeyUp={preventBubbling}
						>
							{children}
						</div>
					</>,
					shadowRoot as unknown as Element
				)}
		</div>
	)
}
