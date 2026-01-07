import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import XIcon from 'lucide-react/dist/esm/icons/x'

import { cn } from '@/lib/utils'
import { applyStoredTheme, applyThemeColorsToShadow } from '@/lib/theme-sync'
import { SHADOW_CSS } from '@/assets/shadow-styles'
import { DOM_MARKERS } from '@/constants/dom-markers'

/**
 * Get or create shadow root container for isolated styling.
 * Uses a singleton shadow host to render dialogs with encapsulated CSS.
 * Injects compiled Tailwind CSS so all utility classes work inside the portal.
 * 
 * NOTE: All Radix portals (Dialog, Tooltip, Popover, DropdownMenu, Select) 
 * use this function, so changes here affect all portal-based components.
 */
function getShadowContainer(): HTMLElement {
	let container = document.getElementById(DOM_MARKERS.IDS.SHADOW_HOST) as HTMLDivElement | null

	if (!container) {
		container = document.createElement('div')
		container.id = DOM_MARKERS.IDS.SHADOW_HOST
		// Make container invisible - only its shadow DOM content should be visible
		container.style.cssText =
			'position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647; pointer-events: none; overflow: visible;'
		document.body.appendChild(container)

		// Apply theme class to host element (dark/light)
		applyStoredTheme(container)

		// Use 'open' in development for debugging, 'closed' in production for security
		const shadowMode = import.meta.env.MODE === 'development' ? 'open' : 'closed'
		const shadow = container.attachShadow({ mode: shadowMode })
		
		// Store shadow reference on container for closed mode access
		// In closed mode, container.shadowRoot returns null, so we need this reference
		;(container as any).__shadowRoot = shadow

		// Create style element with CSS
		const style = document.createElement('style')
		style.id = 'mvp-shadow-styles'
		style.textContent = SHADOW_CSS
		shadow.appendChild(style)

		// Create container for React content
		const innerContainer = document.createElement('div')
		innerContainer.id = DOM_MARKERS.IDS.SHADOW_CONTENT
		// Apply font styles AND dark class for Tailwind dark mode variants
		innerContainer.className = 'dark font-sans text-foreground antialiased'
		innerContainer.style.cssText =
			'position: absolute; top: 0; left: 0; width: 0; height: 0; overflow: visible; pointer-events: none;'
		shadow.appendChild(innerContainer)
		
		/**
		 * CRITICAL: Firewall for keyboard events
		 * Stop events from bubbling out of the Shadow DOM.
		 * This prevents Mediavida from seeing events originating from our inputs,
		 * which corrects the issue where Shadow DOM retargeting makes inputs look like divs (host).
		 * 
		 * We use the BUBBLING phase (default) so that internal React events work first.
		 */
		const preventBubbling = (e: KeyboardEvent) => {
			e.stopPropagation()
			// We don't use stopImmediatePropagation here to allow other listeners on this container to fire if needed
		}

		// Block all key events from escaping
		innerContainer.addEventListener('keydown', preventBubbling)
		innerContainer.addEventListener('keyup', preventBubbling)
		innerContainer.addEventListener('keypress', preventBubbling)
		
		// Apply theme colors (only once when container is created)
		applyThemeColorsToShadow(shadow)
		
		// Also sync dark/light class to innerContainer when theme changes
		applyStoredTheme(innerContainer)
	}

	// Access shadow via stored reference (works in both open and closed modes)
	const shadow = (container as any).__shadowRoot || container.shadowRoot
	return shadow?.getElementById(DOM_MARKERS.IDS.SHADOW_CONTENT) || container
}

/**
 * Dialog component - Root for Radix Dialog
 */
function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
	// Use modal={false} to prevent body scroll lock which causes layout shift
	// when the scrollbar appears/disappears. We handle overlay click manually.
	return <DialogPrimitive.Root data-slot="dialog" modal={false} {...props} />
}

/**
 * DialogTrigger component - Button that opens the dialog
 */
function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
	return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

/**
 * DialogClose component - Button that closes the dialog
 */
function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
	return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

/**
 * DialogPortal component - Handles rendering the dialog into a separate DOM node
 * In content scripts, it uses a Shadow DOM container for style isolation.
 */
function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
	// 1. Detect if we are in the Dashboard (options.html)
	// WXT serves the dashboard at /options.html
	const isDashboard = window.location.pathname.endsWith('options.html')

	// 2. DASHBOARD CASE: Standard rendering
	// We don't use Shadow DOM here. The dialog mounts to the body and inherits
	// the Inter font defined in style.css.
	if (isDashboard) {
		return <DialogPrimitive.Portal {...props} />
	}

	// 3. CONTENT SCRIPT CASE: Isolated rendering
	// We use the Shadow DOM container that injects shadow.css.
	const container = getShadowContainer()
	return <DialogPrimitive.Portal container={container} {...props} />
}

/**
 * DialogOverlay component - The dimmed background behind the dialog
 */
function DialogOverlay({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="dialog-overlay"
			className={cn(
				// 1. Positioning and Z-index
				'fixed inset-0 z-50',

				// 2. Background and Blur
				'bg-black/40',
				'backdrop-blur-sm',
				'[backdrop-filter:blur(4px)]',
				'[-webkit-backdrop-filter:blur(4px)]',

				// 3. Behavior - CRITICAL for blocking clicks
				'pointer-events-auto',

				// 4. GPU layer promotion for Firefox
				'will-change-[opacity,backdrop-filter]',

				// 5. Animations
				'animate-in fade-in-0 duration-200',
				className
			)}
			{...props}
		/>
	)
}

/**
 * DialogContent component - The actual dialog window content
 */
function DialogContent({
	className,
	children,
	showCloseButton = true,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
	showCloseButton?: boolean
}) {
	return (
		<DialogPortal>
			<DialogOverlay />
			<DialogPrimitive.Content
				data-slot="dialog-content"
				className={cn(
					// Positioning
					'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
					// GPU layer promotion for smooth Firefox animations
					'will-change-transform',
					// Sizing
					'grid w-full max-w-lg max-h-[85vh] gap-4 overflow-y-auto',
					// Appearance
					'rounded-lg border border-border bg-card text-card-foreground p-6',
					'shadow-2xl',
					// pointer-events-auto to interact with content
					'pointer-events-auto',
					// Animation
					'data-[state=open]:animate-in data-[state=closed]:animate-out',
					'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
					'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
					'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
					'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
					'duration-200',
					className
				)}
				{...props}
			>
				{children}
				{showCloseButton && (
					<DialogPrimitive.Close
						data-slot="dialog-close"
						className={cn(
							'absolute right-4 top-4',
							'flex items-center justify-center w-6 h-6',
							'rounded-sm opacity-70 transition-opacity',
							'hover:opacity-100',
							'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
							'disabled:pointer-events-none'
						)}
					>
						<XIcon className="h-4 w-4" />
						<span className="sr-only">Close</span>
					</DialogPrimitive.Close>
				)}
			</DialogPrimitive.Content>
		</DialogPortal>
	)
}

/**
 * DialogHeader component - Top section of the dialog
 */
function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
	return <div data-slot="dialog-header" className={cn('flex flex-col gap-2 text-left', className)} {...props} />
}

/**
 * DialogFooter component - Bottom section of the dialog
 */
function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
	return <div data-slot="dialog-footer" className={cn('flex flex-row justify-end gap-2', className)} {...props} />
}

/**
 * DialogTitle component - The main heading of the dialog
 */
function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
	return (
		<DialogPrimitive.Title
			data-slot="dialog-title"
			className={cn('text-lg font-semibold leading-none text-card-foreground', className)}
			{...props}
		/>
	)
}

/**
 * DialogDescription component - Supporting text for the title
 */
function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
	return (
		<DialogPrimitive.Description
			data-slot="dialog-description"
			className={cn('text-sm text-muted-foreground', className)}
			{...props}
		/>
	)
}

export {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogOverlay,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
	getShadowContainer,
}
