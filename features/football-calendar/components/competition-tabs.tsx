import { cn } from '@/lib/utils'
import type { FootballCompetitionCode } from '@/services'

const COMPETITION_OPTIONS: Array<{ id: FootballCompetitionCode; label: string }> = [
	{ id: 'PD', label: 'La Liga' },
	{ id: 'CL', label: 'Champions' },
]

/** Human label for a competition code, for captions and accessible names. */
export function getCompetitionLabel(competition: FootballCompetitionCode): string {
	return COMPETITION_OPTIONS.find(option => option.id === competition)?.label ?? ''
}

/** Segmented control shared by the calendar header and the standings panel. */
export function CompetitionTabs({
	competition,
	className,
	onChange,
}: {
	competition: FootballCompetitionCode
	className?: string
	onChange: (competition: FootballCompetitionCode) => void
}) {
	return (
		<div className={cn('flex w-fit shrink-0 rounded-md bg-muted p-0.5', className)}>
			{COMPETITION_OPTIONS.map(option => (
				<button
					key={option.id}
					type="button"
					onClick={() => onChange(option.id)}
					aria-pressed={competition === option.id}
					className={cn(
						'h-7 rounded-sm px-2.5 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
						competition === option.id && 'bg-primary text-primary-foreground shadow-sm hover:text-primary-foreground'
					)}
				>
					{option.label}
				</button>
			))}
		</div>
	)
}
