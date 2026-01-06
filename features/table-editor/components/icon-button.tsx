import { cn } from '@/lib/utils'

interface IconButtonProps {
	onClick: () => void
	disabled?: boolean
	title: string
	children: React.ReactNode
	className?: string
}

export function IconButton({ onClick, disabled, title, children, className }: IconButtonProps) {
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			aria-label={title}
			className={cn(
				'h-7 w-7 flex items-center justify-center rounded-md transition-all border outline-none',
				disabled
					? 'opacity-30 cursor-not-allowed border-transparent bg-muted/20 text-muted-foreground'
					: 'cursor-pointer bg-secondary/50 border-border/30 text-muted-foreground hover:bg-secondary hover:border-primary/50 hover:text-primary active:scale-95 shadow-sm',
				className
			)}
		>
			{children}
		</button>
	)
}
