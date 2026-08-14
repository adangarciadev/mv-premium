import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid'
import Rows3 from 'lucide-react/dist/esm/icons/rows-3'
import { cn } from '@/lib/utils'
import type { MovieReviewView } from '@/features/cine/logic/movie-review-view'

interface ViewModeToggleProps {
	value: MovieReviewView
	onChange: (view: MovieReviewView) => void
}

const OPTIONS = [
	{ id: 'gallery', label: 'Galería', Icon: LayoutGrid },
	{ id: 'diary', label: 'Diario', Icon: Rows3 },
] as const satisfies readonly { id: MovieReviewView; label: string; Icon: typeof LayoutGrid }[]

/**
 * Two modes, one control, no dropdown: with exactly two options a segmented switch shows both
 * names at once, and switching costs one click instead of two.
 */
export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
	function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
		if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
		event.preventDefault()
		onChange(value === 'gallery' ? 'diary' : 'gallery')
	}

	return (
		<div
			role="radiogroup"
			aria-label="Cómo ver la colección"
			onKeyDown={handleKeyDown}
			className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/30 p-0.5"
		>
			{OPTIONS.map(({ id, label, Icon }) => {
				const isSelected = value === id
				return (
					<button
						key={id}
						type="button"
						role="radio"
						aria-checked={isSelected}
						tabIndex={isSelected ? 0 : -1}
						onClick={() => onChange(id)}
						className={cn(
							'inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-xs transition-colors',
							'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
							isSelected
								? 'bg-background font-semibold text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						)}
					>
						<Icon className="h-3.5 w-3.5 shrink-0" />
						{label}
					</button>
				)
			})}
		</div>
	)
}
