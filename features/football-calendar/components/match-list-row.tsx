import { useState } from 'react'
import Star from 'lucide-react/dist/esm/icons/star'
import { cn } from '@/lib/utils'
import type { FootballMatch, FootballTeam } from '@/services'
import { isFavoriteMatch } from '../logic/group-matches'
import { formatKickoffTime, formatScoreText } from '../logic/format-match'

interface MatchListRowProps {
	match: FootballMatch
	favoriteTeamIds: number[]
	onToggleFavoriteTeam: (teamId: number) => void
	isFirstOfDay: boolean
}

function TeamCrest({
	team,
	failed,
	isFavorite,
	onError,
}: {
	team: FootballTeam
	failed: boolean
	isFavorite: boolean
	onError: () => void
}) {
	const crestClassName = cn(
		'h-4 w-4 shrink-0 object-contain',
		isFavorite && 'rounded-full ring-1 ring-primary/60'
	)

	if (failed) {
		return (
			<span
				className={cn(
					'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[7px] font-black text-muted-foreground',
					isFavorite && 'ring-1 ring-primary/60'
				)}
				aria-label={`Escudo no disponible de ${team.shortName}`}
			>
				{team.tla}
			</span>
		)
	}

	return (
		<img
			key={team.id}
			src={team.crest}
			alt={`Escudo de ${team.shortName}`}
			className={crestClassName}
			loading="lazy"
			referrerPolicy="no-referrer"
			onError={onError}
		/>
	)
}

function FavoriteButton({
	team,
	isFavorite,
	onToggle,
}: {
	team: FootballTeam
	isFavorite: boolean
	onToggle: () => void
}) {
	return (
		<button
			type="button"
			aria-label={`${isFavorite ? 'Quitar' : 'Añadir'} a ${team.shortName} ${isFavorite ? 'de' : 'a'} favoritos`}
			aria-pressed={isFavorite}
			onClick={onToggle}
			className={cn(
				'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-opacity hover:bg-muted hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
				isFavorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
			)}
		>
			<Star className={cn('h-3.5 w-3.5', isFavorite && 'fill-primary text-primary')} aria-hidden="true" />
		</button>
	)
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

function LiveIndicator() {
	return (
		<span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
			<span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
			<span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
		</span>
	)
}

function MatchStatus({ match }: { match: FootballMatch }) {
	if (match.status === 'POSTPONED') {
		return <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Apl.</span>
	}

	if (match.status === 'SUSPENDED') {
		return <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Susp.</span>
	}

	if (match.status === 'IN_PLAY' || match.status === 'PAUSED') {
		return (
			<span className="flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-sm font-black tabular-nums text-foreground" aria-label="Partido en juego">
				<LiveIndicator />
				{match.score ? `${match.score.home} - ${match.score.away}` : '—'}
			</span>
		)
	}

	if (match.status === 'FINISHED') {
		return (
			<span className="flex items-center gap-0.5 rounded bg-muted/60 px-1.5 py-0.5 text-sm font-black tabular-nums">
				<span className={match.score && getWinner(match) === 'away' ? 'text-muted-foreground' : 'text-foreground'}>
					{match.score?.home ?? '—'}
				</span>
				<span className="text-foreground">-</span>
				<span className={match.score && getWinner(match) === 'home' ? 'text-muted-foreground' : 'text-foreground'}>
					{match.score?.away ?? '—'}
				</span>
			</span>
		)
	}

	return <span className="text-[13px] font-bold tabular-nums text-primary">{formatKickoffTime(match.utcDate) || '—'}</span>
}

export function MatchListRow({
	match,
	favoriteTeamIds,
	onToggleFavoriteTeam,
	isFirstOfDay,
}: MatchListRowProps) {
	const [crestFailed, setCrestFailed] = useState<Record<number, boolean>>({})
	const homeIsFavorite = favoriteTeamIds.includes(match.home.id)
	const awayIsFavorite = favoriteTeamIds.includes(match.away.id)
	const matchIsFavorite = isFavoriteMatch(match, favoriteTeamIds)
	const winner = getWinner(match)
	const homeIsLoser = winner === 'away'
	const awayIsLoser = winner === 'home'

	const markCrestFailed = (teamId: number) => {
		setCrestFailed(previous => ({ ...previous, [teamId]: true }))
	}

	return (
		<div
			className={cn(
				'group flex h-7 min-w-0 break-inside-avoid items-center gap-2 px-1.5 hover:bg-muted/40',
				!isFirstOfDay && 'border-t border-border/50',
				matchIsFavorite && 'rounded-md bg-primary/10 ring-1 ring-inset ring-primary/25'
			)}
			title={formatScoreText(match.score) ?? undefined}
		>
			<div className="flex min-w-0 flex-1 items-center gap-1.5">
				<TeamCrest
					team={match.home}
					failed={Boolean(crestFailed[match.home.id])}
					isFavorite={homeIsFavorite}
					onError={() => markCrestFailed(match.home.id)}
				/>
				<span className={cn('min-w-0 flex-1 truncate text-xs font-semibold', homeIsLoser ? 'text-muted-foreground' : 'text-foreground')}>
					{match.home.shortName}
				</span>
				<FavoriteButton
					team={match.home}
					isFavorite={homeIsFavorite}
					onToggle={() => onToggleFavoriteTeam(match.home.id)}
				/>
			</div>

			<div className="flex w-14 shrink-0 items-center justify-center text-center">
				<MatchStatus match={match} />
			</div>

			<div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-right">
				<FavoriteButton
					team={match.away}
					isFavorite={awayIsFavorite}
					onToggle={() => onToggleFavoriteTeam(match.away.id)}
				/>
				<span className={cn('min-w-0 flex-1 truncate text-xs font-semibold', awayIsLoser ? 'text-muted-foreground' : 'text-foreground')}>
					{match.away.shortName}
				</span>
				<TeamCrest
					team={match.away}
					failed={Boolean(crestFailed[match.away.id])}
					isFavorite={awayIsFavorite}
					onError={() => markCrestFailed(match.away.id)}
				/>
			</div>
		</div>
	)
}
