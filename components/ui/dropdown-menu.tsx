import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import CheckIcon from 'lucide-react/dist/esm/icons/check'
import ChevronRightIcon from 'lucide-react/dist/esm/icons/chevron-right'
import CircleIcon from 'lucide-react/dist/esm/icons/circle'

import { cn } from '@/lib/utils'
import { getShadowContainer } from './dialog'

function DropdownMenu({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
	return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
	return <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
}

function DropdownMenuTrigger({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
	return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({
	className,
	sideOffset = 4,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
	const container = getShadowContainer()

	return (
		<DropdownMenuPrimitive.Portal container={container}>
			<DropdownMenuPrimitive.Content
				data-slot="dropdown-menu-content"
				sideOffset={sideOffset}
				className={cn(
					// Base
					'z-50 min-w-45 max-h-80 overflow-y-auto',
					// Appearance
					'rounded-lg border border-border bg-popover p-1.5',
					'text-popover-foreground shadow-xl',
					// Animation
					'animate-in fade-in-0 zoom-in-95 duration-150',
					'data-[side=bottom]:slide-in-from-top-2',
					'data-[side=left]:slide-in-from-right-2',
					'data-[side=right]:slide-in-from-left-2',
					'data-[side=top]:slide-in-from-bottom-2',
					className
				)}
				style={{ pointerEvents: 'auto' }}
				{...props}
			/>
		</DropdownMenuPrimitive.Portal>
	)
}

function DropdownMenuGroup({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
	return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
}

function DropdownMenuItem({
	className,
	inset,
	variant = 'default',
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
	inset?: boolean
	variant?: 'default' | 'destructive'
}) {
	return (
		<DropdownMenuPrimitive.Item
			data-slot="dropdown-menu-item"
			data-inset={inset}
			data-variant={variant}
			className={cn(
				// Base
				'relative flex items-center gap-2 rounded-md px-2.5 py-2',
				'text-sm font-normal cursor-pointer select-none outline-none',
				// Transition
				'transition-colors duration-100',
				// Focus/Hover states
				'focus:bg-accent focus:text-accent-foreground',
				'hover:bg-accent hover:text-accent-foreground',
				// Disabled
				'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
				// Variant: destructive
				variant === 'destructive' && 'text-destructive focus:text-destructive hover:text-destructive',
				// Inset
				inset && 'pl-8',
				className
			)}
			{...props}
		/>
	)
}

function DropdownMenuCheckboxItem({
	className,
	children,
	checked,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
	return (
		<DropdownMenuPrimitive.CheckboxItem
			data-slot="dropdown-menu-checkbox-item"
			className={cn(
				'relative flex items-center gap-2 rounded-md py-2 pl-8 pr-2.5',
				'text-sm cursor-pointer select-none outline-none',
				'transition-colors duration-100',
				'focus:bg-accent focus:text-accent-foreground',
				'hover:bg-accent hover:text-accent-foreground',
				'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
				className
			)}
			checked={checked}
			{...props}
		>
			<span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
				<DropdownMenuPrimitive.ItemIndicator>
					<CheckIcon className="h-4 w-4 text-primary" />
				</DropdownMenuPrimitive.ItemIndicator>
			</span>
			{children}
		</DropdownMenuPrimitive.CheckboxItem>
	)
}

function DropdownMenuRadioGroup({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
	return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />
}

function DropdownMenuRadioItem({
	className,
	children,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
	return (
		<DropdownMenuPrimitive.RadioItem
			data-slot="dropdown-menu-radio-item"
			className={cn(
				'relative flex items-center gap-2 rounded-md py-2 pl-8 pr-2.5',
				'text-sm cursor-pointer select-none outline-none',
				'transition-colors duration-100',
				'focus:bg-accent focus:text-accent-foreground',
				'hover:bg-accent hover:text-accent-foreground',
				'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
				className
			)}
			{...props}
		>
			<span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
				<DropdownMenuPrimitive.ItemIndicator>
					<CircleIcon className="h-2 w-2 fill-primary text-primary" />
				</DropdownMenuPrimitive.ItemIndicator>
			</span>
			{children}
		</DropdownMenuPrimitive.RadioItem>
	)
}

function DropdownMenuLabel({
	className,
	inset,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
	inset?: boolean
}) {
	return (
		<DropdownMenuPrimitive.Label
			data-slot="dropdown-menu-label"
			data-inset={inset}
			className={cn(
				'px-2.5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide',
				inset && 'pl-8',
				className
			)}
			{...props}
		/>
	)
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
	return (
		<DropdownMenuPrimitive.Separator
			data-slot="dropdown-menu-separator"
			className={cn('h-px bg-border my-1.5 -mx-1', className)}
			{...props}
		/>
	)
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<'span'>) {
	return (
		<span
			data-slot="dropdown-menu-shortcut"
			className={cn('ml-auto text-xs text-muted-foreground tracking-widest', className)}
			{...props}
		/>
	)
}

function DropdownMenuSub({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
	return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
	className,
	inset,
	children,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
	inset?: boolean
}) {
	return (
		<DropdownMenuPrimitive.SubTrigger
			data-slot="dropdown-menu-sub-trigger"
			data-inset={inset}
			className={cn(
				'flex items-center gap-2 rounded-md px-2.5 py-2',
				'text-sm cursor-pointer select-none outline-none',
				'transition-colors duration-100',
				'focus:bg-accent focus:text-accent-foreground',
				'hover:bg-accent hover:text-accent-foreground',
				'data-[state=open]:bg-accent',
				inset && 'pl-8',
				className
			)}
			{...props}
		>
			{children}
			<ChevronRightIcon className="ml-auto h-4 w-4 text-muted-foreground" />
		</DropdownMenuPrimitive.SubTrigger>
	)
}

function DropdownMenuSubContent({
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
	const container = getShadowContainer()

	return (
		<DropdownMenuPrimitive.Portal container={container}>
			<DropdownMenuPrimitive.SubContent
				data-slot="dropdown-menu-sub-content"
				className={cn(
					'z-50 min-w-[180px] overflow-hidden',
					'rounded-lg border border-border bg-popover p-1.5',
					'text-popover-foreground shadow-xl',
					'animate-in fade-in-0 zoom-in-95 duration-150',
					'data-[side=bottom]:slide-in-from-top-2',
					'data-[side=left]:slide-in-from-right-2',
					'data-[side=right]:slide-in-from-left-2',
					'data-[side=top]:slide-in-from-bottom-2',
					className
				)}
				style={{ pointerEvents: 'auto' }}
				{...props}
			/>
		</DropdownMenuPrimitive.Portal>
	)
}

export {
	DropdownMenu,
	DropdownMenuPortal,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuItem,
	DropdownMenuCheckboxItem,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
}
