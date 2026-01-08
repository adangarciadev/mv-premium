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
		'flex items-center justify-center gap-2 px-3 h-[30px] relative transition-all duration-200 border',
		'rounded-[var(--radius,4px)]',
		'shadow-sm hover:shadow-md'
	)

	// Inactive light mode polish
	const inactiveStyles = cn(
		'bg-[color-mix(in_srgb,var(--card)95%,transparent)] border-[color-mix(in_srgb,var(--border)60%,transparent)]',
		'dark:border-[color-mix(in_srgb,var(--border)40%,transparent)]',
		// Shaded background for light mode
		'[:root:not(.dark)_&]:bg-[color-mix(in_srgb,var(--secondary)50%,#ffffff)]',
		'[:root:not(.dark)_&]:border-[color-mix(in_srgb,var(--border)80%,transparent)]'
	)

	// Disabled state styles
	const disabledStyles = 'opacity-40 cursor-not-allowed grayscale'

	if (isActive) {
		return (
			<button
				onClick={onDeactivate}
				className={cn(
					baseStyles,
					'cursor-pointer',
					'bg-[color-mix(in_srgb,var(--primary)12%,var(--card))]',
					'border-[color-mix(in_srgb,var(--primary)45%,transparent)]',
					'text-primary',
					'hover:bg-[color-mix(in_srgb,var(--primary)18%,var(--card))]',
					// Light mode active state: slightly more punchy/recessed
					'[:root:not(.dark)_&]:bg-[color-mix(in_srgb,var(--primary)8%,#ffffff)]',
					'[:root:not(.dark)_&]:border-[color-mix(in_srgb,var(--primary)60%,transparent)]',
					'[:root:not(.dark)_&]:shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]'
				)}
				title={`Salir de Scroll Infinito (página ${currentPage}/${totalPages})`}
				aria-label="Salir de Scroll Infinito"
			>
				<SquareX className="h-4 w-4 stroke-[2.5px]" />
				<span className="text-[11px] font-bold tracking-tight">
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
				inactiveStyles,
				'text-foreground',
				isDisabled
					? disabledStyles
					: 'cursor-pointer hover:bg-[color-mix(in_srgb,var(--secondary)80%,transparent)] hover:border-[color-mix(in_srgb,var(--primary)30%,transparent)]'
			)}
			title={isDisabled ? 'Desactivado (modo Live activo)' : 'Activar Scroll Infinito'}
			aria-label="Activar Scroll Infinito"
		>
			<ArrowDown className="h-4 w-4" />
			<InfinityIcon className="h-4 w-4" />
		</button>
	)
}
