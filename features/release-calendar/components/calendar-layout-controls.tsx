import { cn } from '@/lib/utils'

export type CalendarLayout = 'showcase' | 'minimal' | 'bottom'

interface CalendarLayoutControlsProps {
	layout: CalendarLayout
	onChange: (layout: CalendarLayout) => void
}

const LAYOUT_OPTIONS: Array<{ id: CalendarLayout; label: string }> = [
	{ id: 'showcase', label: 'Carrusel' },
	{ id: 'minimal', label: 'Minimalista' },
	{ id: 'bottom', label: 'Inferior' },
]

export function CalendarLayoutControls({ layout, onChange }: CalendarLayoutControlsProps) {
	return (
		<div className="flex rounded-md bg-muted p-1">
			{LAYOUT_OPTIONS.map(option => (
				<button
					key={option.id}
					type="button"
					onClick={() => onChange(option.id)}
					aria-pressed={layout === option.id}
					className={cn(
						'h-8 rounded px-3 text-[12px] font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
						layout === option.id && 'bg-primary text-primary-foreground hover:text-primary-foreground'
					)}
				>
					{option.label}
				</button>
			))}
		</div>
	)
}
