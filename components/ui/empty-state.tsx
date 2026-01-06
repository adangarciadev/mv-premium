import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
	icon?: LucideIcon
	title: string
	description: string
	action?: React.ReactNode
	className?: string
	iconColor?: string
}

export function EmptyState({ 
	icon: Icon, 
	title, 
	description, 
	action, 
	className,
	iconColor = 'text-muted-foreground'
}: EmptyStateProps) {
	return (
		<div className={cn(
			"flex flex-col items-center justify-center py-16 px-8 rounded-lg bg-card border border-border shadow-lg",
			className
		)}>
			{Icon && (
				<div 
					className={cn(
						"h-20 w-20 rounded-full flex items-center justify-center mb-6 shadow-inner",
						"bg-muted"
					)}
				>
					<Icon className={cn("h-10 w-10 opacity-80", iconColor)} />
				</div>
			)}
			
			<h3 className="text-xl font-semibold text-foreground mb-2">
				{title}
			</h3>
			
			<p className="text-sm text-muted-foreground text-center max-w-sm mb-6 leading-relaxed">
				{description}
			</p>
			
			{action && (
				<div className="mt-2">
					{action}
				</div>
			)}
		</div>
	)
}
