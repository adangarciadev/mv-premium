import CircleCheckIcon from 'lucide-react/dist/esm/icons/circle-check'
import InfoIcon from 'lucide-react/dist/esm/icons/info'
import Loader2Icon from 'lucide-react/dist/esm/icons/loader-2'
import OctagonXIcon from 'lucide-react/dist/esm/icons/octagon-x'
import TriangleAlertIcon from 'lucide-react/dist/esm/icons/triangle-alert'
import { useStoredTheme } from '@/hooks/use-stored-theme'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

interface CustomToasterProps extends ToasterProps {
	/** Shadow root for content script rendering - Sonner v2 native support */
	shadowRoot?: ShadowRoot
}

const Toaster = ({ shadowRoot, ...props }: CustomToasterProps) => {
	const theme = useStoredTheme()

	return (
		<Sonner
			theme={theme as ToasterProps['theme']}
			className="toaster group"
			// Pass shadowRoot if provided (for content script Shadow DOM)
			{...(shadowRoot && { shadowRoot })}
			icons={{
				success: <CircleCheckIcon className="h-4 w-4" />,
				info: <InfoIcon className="h-4 w-4" />,
				warning: <TriangleAlertIcon className="h-4 w-4" />,
				error: <OctagonXIcon className="h-4 w-4" />,
				loading: <Loader2Icon className="h-4 w-4 animate-spin" />,
			}}
			toastOptions={{
				classNames: {
					toast: 'group toast bg-popover text-popover-foreground border-border shadow-lg',
					description: 'text-muted-foreground font-medium',
					actionButton: 'bg-primary text-primary-foreground',
					cancelButton: 'bg-muted text-muted-foreground',
				},
			}}
			style={
				{
					'--normal-bg': 'var(--popover)',
					'--normal-text': 'var(--popover-foreground)',
					'--normal-border': 'var(--border)',
					'--border-radius': 'var(--radius)',
					'--muted-foreground': 'var(--muted-foreground)',
				} as React.CSSProperties
			}
			{...props}
		/>
	)
}

export { Toaster }
