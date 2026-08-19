import type { MatchDayGroup } from '../logic/group-matches'
import { formatDayLabelParts } from '../logic/format-match'
import { MatchListRow } from './match-list-row'

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

	return (
		<section className="break-inside-avoid" aria-labelledby={headingId}>
			<h3
				id={headingId}
				className="mb-1.5 flex items-center gap-1.5 border-b border-border/60 pb-1.5 text-xs font-black uppercase leading-4 tracking-wide"
			>
				{dayLabel.isToday && <span className="h-3 w-0.5 rounded-full bg-primary" aria-hidden="true" />}
				<span className={dayLabel.isRelative ? 'text-primary' : 'text-muted-foreground'}>
					{dayLabel.weekday.toUpperCase()}
				</span>
				{!dayLabel.isRelative && dayLabel.dayNumber !== null && (
					<span className="text-foreground">{dayLabel.dayNumber}</span>
				)}
			</h3>
			<div>
				{group.matches.map((match, index) => (
					<MatchListRow
						key={match.id}
						match={match}
						favoriteTeamIds={favoriteTeamIds}
						onToggleFavoriteTeam={onToggleFavoriteTeam}
						isFirstOfDay={index === 0}
					/>
				))}
			</div>
		</section>
	)
}
