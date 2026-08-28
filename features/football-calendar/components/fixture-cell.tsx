import { useState } from 'react'
import Star from 'lucide-react/dist/esm/icons/star'
import { formatIsoDateKey } from '@/lib/date-utils'
import { cn } from '@/lib/utils'
import type { FootballMatch, FootballTeam } from '@/services'
import { isFavoriteMatch } from '../logic/group-matches'
import {
	formatKickoffTime,
	formatLiveMinute,
	formatScoreText,
	isLiveStatusStale,
	isUpcomingToday,
} from '../logic/format-match'
import { SURFACE } from './surfaces'

interface FixtureCellProps {
	match: FootballMatch
	favoriteTeamIds: number[]
	onToggleFavoriteTeam: (teamId: number) => void
}

function getWinner(match: FootballMatch): 'home' | 'away' | null {
	if (match.status !== 'FINISHED' || match.score === null) return null
	if (match.score.home > match.score.away) return 'home'
	if (match.score.away > match.score.home) return 'away'
	if (match.score.penalties === null) return null
	if (match.score.penalties.home > match.score.penalties.away) return 'home'
	if (match.score.penalties.away > match.score.penalties.home) return 'away'
	return null
}

/**
 * One team of a fixture. The name sits against its own crest so the pairing is
 * never ambiguous, and the whole side toggles the team as a favourite.
 */
function TeamSide({
	team,
	isFavorite,
	side,
	onToggle,
}: {
	team: FootballTeam
	isFavorite: boolean
	side: 'home' | 'away'
	onToggle: () => void
}) {
	const [crestFailed, setCrestFailed] = useState(false)

	const crest = (
		<span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
			{crestFailed ? (
				<span
					className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[7px] font-black text-muted-foreground"
					aria-hidden="true"
				>
					{team.tla}
				</span>
			) : (
				<img
					src={team.crest}
					alt=""
					className="h-5 w-5 object-contain"
					loading="lazy"
					referrerPolicy="no-referrer"
					onError={() => setCrestFailed(true)}
				/>
			)}
			<span
				className={cn(
					'absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-card transition-opacity',
					isFavorite
						? 'opacity-100'
						: 'opacity-0 group-hover/team:opacity-100 group-focus-visible/team:opacity-100'
				)}
				aria-hidden="true"
			>
				<Star className={cn('h-2 w-2', isFavorite ? 'fill-primary text-primary' : 'text-muted-foreground')} />
			</span>
		</span>
	)

	const name = (
		<span
			className={cn(
				'min-w-0 flex-1 truncate text-[11px] font-bold leading-none text-foreground',
				side === 'home' ? 'text-right' : 'text-left'
			)}
		>
			{team.name}
		</span>
	)

	return (
		<button
			type="button"
			aria-pressed={isFavorite}
			aria-label={`${isFavorite ? 'Quitar' : 'Añadir'} a ${team.name} ${isFavorite ? 'de' : 'a'} favoritos`}
			title={team.name}
			onClick={onToggle}
			className="group/team flex min-w-0 max-w-[170px] flex-1 items-center gap-1.5 rounded-sm transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
		>
			{side === 'home' ? (
				<>
					{name}
					{crest}
				</>
			) : (
				<>
					{crest}
					{name}
				</>
			)}
		</button>
	)
}

/**
 * The anchor between both teams: kickoff time, live score, or final score.
 * A solid chip is what makes each fixture read as one unit.
 */
function FixtureChip({ match }: { match: FootballMatch }) {
	const chipClassName =
		'flex h-[22px] w-[52px] shrink-0 items-center justify-center rounded-sm text-[12.5px] font-black leading-none tabular-nums tracking-tight'

	if (match.status === 'POSTPONED' || match.status === 'SUSPENDED') {
		return (
			<span className={cn(chipClassName, 'bg-card text-[9px] uppercase tracking-wider text-muted-foreground')}>
				{match.status === 'POSTPONED' ? 'Apl.' : 'Susp.'}
			</span>
		)
	}

	// A status stuck on IN_PLAY must not keep pulsing forever: fall through to the
	// plain score below once the match cannot possibly still be running.
	if ((match.status === 'IN_PLAY' || match.status === 'PAUSED') && !isLiveStatusStale(match)) {
		const liveMinute = formatLiveMinute(match)

		return (
			<span
				className={cn(chipClassName, 'gap-1 bg-primary text-primary-foreground')}
				aria-label={`Partido en juego${liveMinute === null ? '' : `, ${liveMinute}`}`}
				title={liveMinute ?? undefined}
			>
				<span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
					<span className="absolute inline-flex h-full w-full rounded-full bg-primary-foreground motion-safe:animate-ping" />
					<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-foreground" />
				</span>
				{match.score ? `${match.score.home}-${match.score.away}` : '—'}
			</span>
		)
	}

	if (match.status === 'FINISHED' || match.status === 'IN_PLAY' || match.status === 'PAUSED') {
		const winner = getWinner(match)

		if (match.score === null) {
			return <span className={cn(chipClassName, SURFACE.result, 'text-background')}>—</span>
		}

		// The goals carry the result on their own: the loser's number recedes and
		// both team names stay at full strength. The loser is dimmed with a mix
		// rather than muted-foreground, which loses contrast on the raised chip.
		const loser = 'text-[color:color-mix(in_srgb,var(--background)70%,transparent)]'

		return (
			<span className={cn(chipClassName, SURFACE.result)}>
				<span className={winner === 'away' ? loser : 'text-background'}>{match.score.home}</span>
				<span className={loser}>-</span>
				<span className={winner === 'home' ? loser : 'text-background'}>{match.score.away}</span>
			</span>
		)
	}

	return (
		<span className={cn(chipClassName, 'bg-card', isUpcomingToday(match) ? 'text-primary' : 'text-foreground')}>
			{formatKickoffTime(match.utcDate) || '—'}
		</span>
	)
}

export function FixtureCell({ match, favoriteTeamIds, onToggleFavoriteTeam }: FixtureCellProps) {
	const matchIsFavorite = isFavoriteMatch(match, favoriteTeamIds)
	const scoreText = formatScoreText(match.score)
	const matchTitle = `${match.home.name} - ${match.away.name}${scoreText === null ? '' : ` · ${scoreText}`}`

	return (
		<div
			className={cn(
				'flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 transition-colors',
				matchIsFavorite ? SURFACE.favorite : SURFACE.fixture
			)}
			title={matchTitle}
		>
			<TeamSide
				team={match.home}
				side="home"
				isFavorite={favoriteTeamIds.includes(match.home.id)}
				onToggle={() => onToggleFavoriteTeam(match.home.id)}
			/>
			<FixtureChip match={match} />
			<TeamSide
				team={match.away}
				side="away"
				isFavorite={favoriteTeamIds.includes(match.away.id)}
				onToggle={() => onToggleFavoriteTeam(match.away.id)}
			/>
		</div>
	)
}
