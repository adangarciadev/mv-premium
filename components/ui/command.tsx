import * as React from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import Search from 'lucide-react/dist/esm/icons/search'

import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogOverlay } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'

const Command = React.forwardRef<React.ComponentRef<typeof CommandPrimitive>, React.ComponentPropsWithoutRef<typeof CommandPrimitive>>(
	({ className, ...props }, ref) => (
		<CommandPrimitive
			ref={ref}
			className={cn(
				'flex h-full w-full flex-col overflow-hidden rounded-md bg-transparent text-popover-foreground',
				className
			)}
			{...props}
		/>
	)
)
Command.displayName = CommandPrimitive.displayName

interface CommandDialogProps extends React.ComponentProps<typeof Dialog> {
	shouldFilter?: boolean
	className?: string
}

const CommandDialog = ({ children, shouldFilter, className, ...props }: CommandDialogProps) => {
	return (
		<Dialog {...props}>
			<DialogContent className={cn("overflow-hidden p-0 shadow-2xl bg-transparent border-0 max-w-[640px]", className)}>
				<Command shouldFilter={shouldFilter} className="relative overflow-hidden rounded-[calc(var(--radius)*2)] border border-border bg-popover shadow-2xl">
					{children}
				</Command>
			</DialogContent>
		</Dialog>
	)
}

const CommandInput = React.forwardRef<React.ComponentRef<typeof CommandPrimitive.Input>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input> & { breadcrumbs?: React.ReactNode }>(
	({ className, breadcrumbs, ...props }, ref) => {
		return (
			<div className="flex items-center border-b border-border/40 bg-transparent px-6" cmdk-input-wrapper="">
				<Search className="mr-3 h-4 w-4 shrink-0 opacity-50 text-foreground" />
				{breadcrumbs && (
					<div className="mr-3 flex items-center border-r border-border/40 pr-3">
						{breadcrumbs}
					</div>
				)}
				<CommandPrimitive.Input
					ref={ref}
					className={cn(
						'flex h-14 w-full rounded-md bg-transparent py-3 text-[15px] outline-none placeholder:text-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-50 text-foreground',
						className
					)}
					{...props}
				/>
			</div>
		)
	}
)

CommandInput.displayName = CommandPrimitive.Input.displayName

const CommandList = React.forwardRef<React.ComponentRef<typeof CommandPrimitive.List>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>>(
	({ className, ...props }, ref) => (
		<CommandPrimitive.List
			ref={ref}
			className={cn('max-h-[420px] overflow-y-auto overflow-x-hidden p-3', className)}
			{...props}
		/>
	)
)

CommandList.displayName = CommandPrimitive.List.displayName

const CommandEmpty = React.forwardRef<React.ComponentRef<typeof CommandPrimitive.Empty>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>>(
	(props, ref) => (
		<CommandPrimitive.Empty
			ref={ref}
			className="py-10 text-center text-sm text-muted-foreground"
			{...props}
		/>
	)
)

CommandEmpty.displayName = CommandPrimitive.Empty.displayName

const CommandGroup = React.forwardRef<React.ComponentRef<typeof CommandPrimitive.Group>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>>(
	({ className, ...props }, ref) => (
		<CommandPrimitive.Group
			ref={ref}
			className={cn(
				'overflow-hidden p-2 text-foreground',
				// Group header styling
				'[&_[cmdk-group-heading]]:px-3',
				'[&_[cmdk-group-heading]]:pt-5',
				'[&_[cmdk-group-heading]]:pb-2',
				'[&_[cmdk-group-heading]]:text-[12px]',
				'[&_[cmdk-group-heading]]:font-bold',
				'[&_[cmdk-group-heading]]:uppercase',
				'[&_[cmdk-group-heading]]:tracking-[0.15em]',
				'[&_[cmdk-group-heading]]:text-primary/60',
				'[&_[cmdk-group-heading]]:flex',
				'[&_[cmdk-group-heading]]:items-center',
				'[&_[cmdk-group-heading]]:gap-2',
				// New Underline Style
				'[&_[cmdk-group-heading]]:border-b',
				'[&_[cmdk-group-heading]]:border-border/10',
				'[&_[cmdk-group-heading]]:mb-2',
				// Spacing between groups
				'[&_[cmdk-group]:not(:first-of-type)]:mt-4',
				className
			)}
			{...props}
		/>
	)
)

CommandGroup.displayName = CommandPrimitive.Group.displayName

const CommandSeparator = React.forwardRef<React.ComponentRef<typeof CommandPrimitive.Separator>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>>(
	({ className, ...props }, ref) => (
		<CommandPrimitive.Separator
			ref={ref}
			className={cn('-mx-1 h-px bg-border/40', className)}
			{...props}
		/>
	)
)
CommandSeparator.displayName = CommandPrimitive.Separator.displayName

const CommandItem = React.forwardRef<React.ComponentRef<typeof CommandPrimitive.Item>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>>(
	({ className, ...props }, ref) => (
		<CommandPrimitive.Item
			ref={ref}
			className={cn(
				"group relative mb-1 flex cursor-pointer items-center gap-3 overflow-hidden rounded-[var(--radius)] px-3.5 py-3 text-foreground/80 transition-all duration-200 outline-none select-none",
				"data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
				// Vertical accent on the left (Refined)
				"before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-0 before:w-[3px] before:rounded-r-full before:bg-primary before:opacity-0 before:transition-all before:duration-300",
				"data-[selected=true]:before:opacity-100 data-[selected=true]:before:h-3/4",
				// Background (Cleaner, no borders)
				"hover:bg-accent/40 hover:text-primary",
				"data-[selected=true]:bg-accent/60 data-[selected=true]:text-primary",
				className
			)}
			{...props}
		/>
	)
)

CommandItem.displayName = CommandPrimitive.Item.displayName

const CommandShortcut = ({
	className,
	...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
	return (
		<span
			className={cn(
				'ml-auto text-[10px] font-bold tracking-widest text-muted-foreground/50 border border-border/40 bg-muted/20 px-1.5 py-0.5 rounded-sm shadow-sm transition-colors group-hover:text-primary group-hover:border-primary/20 group-hover:bg-primary/10 group-data-[selected=true]:text-primary group-data-[selected=true]:border-primary/20 group-data-[selected=true]:bg-primary/10',
				className
			)}
			{...props}
		/>
	)
}

export {
	Command,
	CommandDialog,
	CommandInput,
	CommandList,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandShortcut,
	CommandSeparator,
}
