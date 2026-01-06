/**
 * Lazy Toaster - Completely isolated sonner import
 *
 * This file is designed to be dynamically imported ONLY.
 * It should NEVER be statically imported anywhere in the content script.
 *
 * The separation ensures that Vite/Rollup can properly tree-shake sonner
 * out of the main content script bundle.
 */
import { useEffect, useState } from 'react'
import CircleCheckIcon from 'lucide-react/dist/esm/icons/circle-check'
import InfoIcon from 'lucide-react/dist/esm/icons/info'
import Loader2Icon from 'lucide-react/dist/esm/icons/loader-2'
import OctagonXIcon from 'lucide-react/dist/esm/icons/octagon-x'
import TriangleAlertIcon from 'lucide-react/dist/esm/icons/triangle-alert'
import { useTheme } from 'next-themes'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

interface LazyToasterProps extends ToasterProps {
	/** Shadow root for content script rendering - Sonner v2 native support */
	shadowRoot?: ShadowRoot
}

/**
 * LazyToaster component - Use via dynamic import only!
 *
 * @example
 * // In a component that needs toasts:
 * const [Toaster, setToaster] = useState(null)
 * useEffect(() => {
 *   import('@/components/ui/lazy-toaster').then(m => setToaster(() => m.LazyToaster))
 * }, [])
 */
export function LazyToaster({ shadowRoot, ...props }: LazyToasterProps) {
	const { theme = 'system' } = useTheme()

	return (
		<Sonner
			theme={theme as ToasterProps['theme']}
			className="toaster group"
			{...(shadowRoot && { shadowRoot })}
			icons={{
				success: <CircleCheckIcon className="h-4 w-4" />,
				info: <InfoIcon className="h-4 w-4" />,
				warning: <TriangleAlertIcon className="h-4 w-4" />,
				error: <OctagonXIcon className="h-4 w-4" />,
				loading: <Loader2Icon className="h-4 w-4 animate-spin" />,
			}}
			style={
				{
					'--normal-bg': 'var(--popover)',
					'--normal-text': 'var(--popover-foreground)',
					'--normal-border': 'var(--border)',
					'--border-radius': 'var(--radius)',
				} as React.CSSProperties
			}
			{...props}
		/>
	)
}
