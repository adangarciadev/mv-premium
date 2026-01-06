import Search from 'lucide-react/dist/esm/icons/search'
import { cn } from '@/lib/utils'
import { Kbd } from '@/components/ui/kbd'

interface CommandMenuTriggerProps {
	onClick: () => void
	className?: string
}

/**
 * CommandMenuTrigger component - A stylized button that opens the command menu
 * @param onClick - Callback when the trigger is clicked
 * @param className - Optional CSS classes
 */
export function CommandMenuTrigger({ onClick, className }: CommandMenuTriggerProps) {
	return (
		<button
			onClick={onClick}
			className={cn(
				'flex items-center gap-2 w-full px-3 py-2',
				'text-sm text-muted-foreground',
				'bg-muted/50 hover:bg-muted',
				'border border-border/40 hover:border-border/60',
				'rounded-lg transition-all duration-200',
				'group cursor-pointer',
				className
			)}
		>
			<Search className="h-4 w-4 opacity-50 group-hover:opacity-70" />
			<span className="flex-1 text-left text-muted-foreground/70 group-hover:text-muted-foreground">Buscar...</span>
			<div className="hidden sm:flex items-center">
				<Kbd className="h-5 px-2 text-[10px] bg-background border-border/50 shadow-none font-medium text-muted-foreground/50">⌘ K</Kbd>
			</div>
		</button>
	)
}
