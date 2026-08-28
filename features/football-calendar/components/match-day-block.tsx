import { cn } from '@/lib/utils'
import type { MatchDayGroup } from '../logic/group-matches'
import { formatDayLabelParts } from '../logic/format-match'
import { FixtureCell } from './fixture-cell'

interface MatchDayBlockProps {
	group: MatchDayGroup
	dayGroupKey: string
	favoriteTeamIds: number[]
	onToggleFavoriteTeam: (teamId: number) => void
}

export function MatchDayBlock({
	group,
	dayGroupKey,
	favoriteTeamIds,
	onToggleFavoriteTeam,
}: MatchDayBlockProps) {
	const headingId = `football-day-${dayGroupKey}-${group.dayKey}`
	const dayLabel = formatDayLabelParts(group.dayKey)
	const railLabel = dayLabel.isRelative ? dayLabel.weekday : dayLabel.weekday.slice(0, 3)

	return (
		<section className="flex items-start gap-2.5" aria-labelledby={headingId}>
			<h3 id={headingId} className="flex w-[52px] shrink-0 items-baseline justify-end gap-1.5 pt-1.5">
				<span
					className={cn(
						'text-[10px] font-black uppercase leading-none tracking-[0.1em]',
						dayLabel.isRelative ? 'text-primary' : 'text-muted-foreground'
					)}
				>
					{railLabel.toUpperCase()}
				</span>
				{dayLabel.dayNumber !== null && (
					<span
						className={cn(
							'text-[13px] font-black leading-none tabular-nums',
							dayLabel.isToday ? 'text-primary' : 'text-foreground'
						)}
					>
						{dayLabel.dayNumber}
					</span>
				)}
			</h3>
			<div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5 md:grid-cols-2">
				{group.matches.map(match => (
					<FixtureCell
						key={match.id}
						match={match}
						favoriteTeamIds={favoriteTeamIds}
						onToggleFavoriteTeam={onToggleFavoriteTeam}
					/>
				))}
			</div>
		</section>
	)
}
