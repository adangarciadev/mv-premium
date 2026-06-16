/**
 * ActivityViewToggle - segmented control to switch the dashboard's main
 * activity card between the "Tiempo en Mediavida" clock and the contributions heatmap.
 */
import Clock from 'lucide-react/dist/esm/icons/clock'
import Calendar from 'lucide-react/dist/esm/icons/calendar'
import { cn } from '@/lib/utils'
import type { ActivityViewMode } from '../logic/activity-view'

const OPTIONS: Array<{ value: ActivityViewMode; label: string; icon: typeof Clock }> = [
	{ value: 'rhythm', label: 'Reloj', icon: Clock },
	{ value: 'heatmap', label: 'Calendario', icon: Calendar },
]

const segmentedRadiusStyle = { borderRadius: 'var(--radius)' } as const
const segmentedItemRadiusStyle = { borderRadius: 'max(2px, calc(var(--radius) - 2px))' } as const

export function ActivityViewToggle({
	value,
	onChange,
}: {
	value: ActivityViewMode
	onChange: (mode: ActivityViewMode) => void
}) {
	return (
		<div
			role="tablist"
			aria-label="Vista de actividad"
			className="inline-flex gap-0.5 border border-border/80 bg-background/60 p-0.5"
			style={segmentedRadiusStyle}
		>
			{OPTIONS.map(({ value: optValue, label, icon: Icon }) => {
				const active = value === optValue
				return (
					<button
						key={optValue}
						type="button"
						role="tab"
						aria-selected={active}
						onClick={() => onChange(optValue)}
						style={segmentedItemRadiusStyle}
						className={cn(
							'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold transition-colors',
							active
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:text-foreground'
						)}
					>
						<Icon className="h-3.5 w-3.5" />
						{label}
					</button>
				)
			})}
		</div>
	)
}
