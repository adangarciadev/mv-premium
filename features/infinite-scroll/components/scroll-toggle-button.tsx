import { cn } from '@/lib/utils'
import InfinityIcon from 'lucide-react/dist/esm/icons/infinity'
import ArrowDown from 'lucide-react/dist/esm/icons/arrow-down'
import SquareX from 'lucide-react/dist/esm/icons/square-x'

interface InfiniteScrollButtonProps {
	isActive: boolean
	isDisabled: boolean
	onActivate: () => void
	onDeactivate: () => void
	currentPage?: number
	totalPages?: number
}

/**
 * Button to toggle infinite scroll mode on/off.
 * When inactive: shows activation button
 * When active: shows exit button with current page info
 * When disabled: grayed out (Live mode is active)
 */
export function InfiniteScrollButton({
	isActive,
	isDisabled,
	onActivate,
	onDeactivate,
	currentPage,
	totalPages,
}: InfiniteScrollButtonProps) {
	// Shared base styles mirroring LiveButton (.mvp-live-toggle-btn)
	const baseStyles = cn(
		'mvp-infinite-scroll-btn',
		'flex items-center justify-center gap-2 px-3 h-[30px] relative shadow-sm transition-all border',
		'rounded-[var(--radius)]',
		'border-border'
	)

	// Disabled state styles
	const disabledStyles = 'opacity-40 cursor-not-allowed pointer-events-none'

	if (isActive) {
		return (
			<button
				onClick={onDeactivate}
				className={cn(
					baseStyles,
					'cursor-pointer',
					'bg-primary/10 border-primary/30 text-primary',
					'hover:bg-primary/20'
				)}
				title={`Salir de Scroll Infinito (página ${currentPage}/${totalPages})`}
				aria-label="Salir de Scroll Infinito"
			>
				<SquareX className="h-4 w-4" />
				<span className="text-xs font-medium">
					{currentPage}/{totalPages}
				</span>
			</button>
		)
	}

	return (
		<button
			onClick={isDisabled ? undefined : onActivate}
			disabled={isDisabled}
			className={cn(
				baseStyles,
				'bg-card text-foreground',
				isDisabled ? disabledStyles : 'cursor-pointer hover:bg-secondary'
			)}
			title={isDisabled ? 'Desactivado (modo Live activo)' : 'Activar Scroll Infinito'}
			aria-label="Activar Scroll Infinito"
		>
			<ArrowDown className="h-4 w-4" />
			<InfinityIcon className="h-4 w-4" />
		</button>
	)
}
