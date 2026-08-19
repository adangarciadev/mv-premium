import { useEffect, useMemo, useState } from 'react'
import { browser } from 'wxt/browser'
import CalendarClock from 'lucide-react/dist/esm/icons/calendar-clock'
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import Trophy from 'lucide-react/dist/esm/icons/trophy'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/settings-store'
import type { MatchdayGroup } from '../logic/group-matches'
import { findCurrentMatchdayIndex, groupByMatchday } from '../logic/group-matches'
import { formatStageLabel } from '../logic/format-match'
import { MatchDayBlock } from './match-day-block'
import {
	fetchCompetitionMatches,
	type FootballCompetitionCode,
	type FootballFetchResult,
	type FootballMatch,
} from '@/services'

type FootballErrorReason = Extract<FootballFetchResult, { ok: false }>['reason']

interface CompetitionState {
	loading: boolean
	matches: FootballMatch[] | null
	error: FootballErrorReason | null
}

const INITIAL_COMPETITION_STATE: CompetitionState = {
	loading: true,
	matches: null,
	error: null,
}

const COMPETITION_OPTIONS: Array<{ id: FootballCompetitionCode; label: string }> = [
	{ id: 'PD', label: 'La Liga' },
	{ id: 'CL', label: 'Champions' },
]

function createInitialCompetitionStates(): Record<FootballCompetitionCode, CompetitionState> {
	return {
		PD: { ...INITIAL_COMPETITION_STATE },
		CL: { ...INITIAL_COMPETITION_STATE },
	}
}

function SettingsLink() {
	return (
		<a
			href={browser.runtime.getURL('/options.html')}
			target="_blank"
			rel="noopener noreferrer"
			className="inline-flex shrink-0 items-center gap-1 font-bold text-primary hover:underline"
		>
			Ajustes
			<ExternalLink className="h-3 w-3" aria-hidden="true" />
		</a>
	)
}

function CalendarSkeleton() {
	return (
		<div className="grid gap-3 px-3 py-3" aria-label="Cargando calendario de fútbol">
			<div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
				Cargando partidos...
			</div>
			<div className="grid grid-cols-2 gap-x-6 gap-y-2">
				{Array.from({ length: 6 }, (_, index) => (
					<Skeleton key={index} className="h-9 rounded-md" />
				))}
			</div>
		</div>
	)
}

function NoKeyState() {
	return (
		<div className="mx-3 my-3 grid gap-2 rounded-lg border border-border bg-card/70 px-4 py-3 text-sm">
			<div className="flex items-center gap-2 font-bold text-foreground">
				<Trophy className="h-5 w-5 text-primary" aria-hidden="true" />
				<span>Configura una API key para ver el calendario</span>
			</div>
			<p className="text-muted-foreground">
				Necesitas una API key gratuita de football-data.org. Puedes registrarte en{' '}
				<a
					href="https://www.football-data.org/client/register"
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
				>
					football-data.org
					<ExternalLink className="h-3 w-3" aria-hidden="true" />
				</a>
				. Después, configúrala en los <SettingsLink /> de la extensión.
			</p>
		</div>
	)
}

function EmptyMatchesState({ competition }: { competition: FootballCompetitionCode }) {
	const message =
		competition === 'CL'
			? 'La Champions 2026/27 todavía no tiene calendario publicado'
			: 'No hay partidos en estas fechas.'

	return (
		<div className="mx-3 my-3 rounded-lg border border-border bg-card/50 px-4 py-4 text-center">
			<p className="text-sm font-semibold text-foreground">{message}</p>
			<p className="mt-1 text-xs text-muted-foreground">
				{competition === 'CL'
					? 'El calendario aparecerá aquí cuando football-data.org publique la nueva temporada.'
					: 'Prueba a consultar la otra competición.'}
			</p>
		</div>
	)
}

function ErrorState({
	reason,
	onRetry,
}: {
	reason: Exclude<FootballErrorReason, 'no-key'>
	onRetry: () => void
}) {
	const content = {
		'quota-exceeded': {
			title: 'Límite de peticiones alcanzado',
			description: 'Prueba de nuevo dentro de un minuto.',
		},
		'invalid-key': {
			title: 'La API key no es válida',
			description: 'Comprueba la clave en los ajustes.',
		},
		network: {
			title: 'No se pudo conectar con football-data.org',
			description: 'Revisa tu conexión y vuelve a intentarlo.',
		},
	}[reason]

	return (
		<div className="mx-3 my-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3">
			<div className="min-w-0">
				<p className="text-sm font-semibold text-foreground">{content.title}</p>
				<p className="mt-1 text-xs text-muted-foreground">{content.description}</p>
			</div>
			<div className="flex items-center gap-3">
				<SettingsLink />
				{reason === 'network' && (
					<Button type="button" size="sm" variant="outline" onClick={onRetry}>
						<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
						Reintentar
					</Button>
				)}
			</div>
		</div>
	)
}

function CompetitionTabs({
	competition,
	onChange,
}: {
	competition: FootballCompetitionCode
	onChange: (competition: FootballCompetitionCode) => void
}) {
	return (
		<div className="flex shrink-0 rounded-md bg-muted p-0.5">
			{COMPETITION_OPTIONS.map(option => (
				<button
					key={option.id}
					type="button"
					onClick={() => onChange(option.id)}
					aria-pressed={competition === option.id}
					className={cn(
						'h-7 rounded px-2.5 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
						competition === option.id && 'bg-primary text-primary-foreground shadow-sm hover:text-primary-foreground',
					)}
				>
					{option.label}
				</button>
			))}
		</div>
	)
}

function getMatchdayLabel(group: MatchdayGroup | undefined): string {
	if (!group) return 'Sin jornadas'
	if (group.matchday !== null) return `Jornada ${group.matchday}`

	const firstMatch = group.days[0]?.matches[0]
	return firstMatch ? formatStageLabel(firstMatch) : group.stage
}

function MatchdayNavigation({
	groups,
	currentIndex,
	onPrevious,
	onNext,
}: {
	groups: MatchdayGroup[]
	currentIndex: number
	onPrevious: () => void
	onNext: () => void
}) {
	const atStart = currentIndex <= 0
	const atEnd = groups.length === 0 || currentIndex >= groups.length - 1
	const currentGroup = groups[currentIndex]
	const currentLabel = getMatchdayLabel(currentGroup)

	return (
		<div className="flex shrink-0 items-center gap-1.5">
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				onClick={onPrevious}
				disabled={atStart}
				aria-label="Jornada anterior"
				className="h-6 w-6 rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
			>
				<ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
			</Button>
			{currentGroup?.matchday !== null && currentGroup !== undefined ? (
				<span className="flex items-baseline gap-1.5 rounded-md bg-muted px-2.5 py-1">
					<span className="text-[9px] uppercase tracking-wider text-muted-foreground">Jornada</span>
					<span className="text-sm font-black tabular-nums text-foreground">{currentGroup.matchday}</span>
				</span>
			) : (
				<span className="rounded-md bg-muted px-2.5 py-1 text-xs font-black uppercase text-foreground">
					{currentLabel}
				</span>
			)}
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				onClick={onNext}
				disabled={atEnd}
				aria-label="Jornada siguiente"
				className="h-6 w-6 rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
			>
				<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
			</Button>
		</div>
	)
}

export function FootballCalendar() {
	const favoriteTeamIds = useSettingsStore(state => state.footballFavoriteTeamIds)
	const setFootballFavoriteTeamIds = useSettingsStore(state => state.setFootballFavoriteTeamIds)
	const [competition, setCompetition] = useState<FootballCompetitionCode>('PD')
	const [onlyFavorites, setOnlyFavorites] = useState(false)
	const [currentMatchdayIndex, setCurrentMatchdayIndex] = useState(0)
	const [competitionStates, setCompetitionStates] = useState(createInitialCompetitionStates)
	const currentState = competitionStates[competition]
	const hasLoadedCurrentCompetition = currentState.matches !== null

	useEffect(() => {
		if (hasLoadedCurrentCompetition) return

		let cancelled = false
		setCompetitionStates(previous => ({
			...previous,
			[competition]: { ...previous[competition], loading: true, error: null },
		}))

		void fetchCompetitionMatches(competition)
			.then(result => {
				if (cancelled) return

				if (result.ok) {
					setCompetitionStates(previous => ({
						...previous,
						[competition]: { loading: false, matches: result.matches, error: null },
					}))
					return
				}

				setCompetitionStates(previous => ({
					...previous,
					[competition]: { loading: false, matches: [], error: result.reason },
				}))
			})
			.catch(error => {
				if (cancelled) return
				logger.error('Football calendar: failed to load matches', error)
				setCompetitionStates(previous => ({
					...previous,
					[competition]: { loading: false, matches: [], error: 'network' },
				}))
			})

		return () => {
			cancelled = true
		}
	}, [competition, hasLoadedCurrentCompetition])

	useEffect(() => {
		if (favoriteTeamIds.length === 0) setOnlyFavorites(false)
	}, [favoriteTeamIds.length])

	const matchdayGroups = useMemo(
		() =>
			currentState.matches === null
				? []
				: groupByMatchday(currentState.matches, { favoriteTeamIds, onlyFavorites }),
		[currentState.matches, favoriteTeamIds, onlyFavorites],
	)

	useEffect(() => {
		setCurrentMatchdayIndex(findCurrentMatchdayIndex(matchdayGroups))
	}, [competition, matchdayGroups])

	const visibleMatchdayIndex = Math.min(
		currentMatchdayIndex,
		Math.max(0, matchdayGroups.length - 1),
	)

	const handleToggleFavoriteTeam = (teamId: number) => {
		if (favoriteTeamIds.includes(teamId)) {
			setFootballFavoriteTeamIds(favoriteTeamIds.filter(id => id !== teamId))
			return
		}

		setFootballFavoriteTeamIds([...favoriteTeamIds, teamId])
	}

	const handleRetry = () => {
		setCompetitionStates(previous => ({
			...previous,
			[competition]: { loading: true, matches: null, error: null },
		}))
	}

	const content = currentState.loading ? (
		<CalendarSkeleton />
	) : currentState.error === 'no-key' ? (
		<NoKeyState />
	) : currentState.error ? (
		<ErrorState reason={currentState.error} onRetry={handleRetry} />
	) : currentState.matches?.length === 0 ? (
		<EmptyMatchesState competition={competition} />
	) : matchdayGroups.length > 0 ? (
		<div className="columns-2 [column-gap:26px] space-y-3 px-3 py-3" aria-label="Partidos de la jornada">
			{matchdayGroups[visibleMatchdayIndex]?.days.map(dayGroup => (
				<MatchDayBlock
					key={`${matchdayGroups[visibleMatchdayIndex].key}-${dayGroup.dayKey}`}
					group={dayGroup}
					dayGroupKey={matchdayGroups[visibleMatchdayIndex].key}
					favoriteTeamIds={favoriteTeamIds}
					onToggleFavoriteTeam={handleToggleFavoriteTeam}
				/>
			))}
		</div>
	) : (
		<p className="px-3 py-4 text-center text-sm text-muted-foreground">
			No hay partidos de tus equipos favoritos en estas fechas.
		</p>
	)

	return (
		<section className="mb-3 overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-[0_14px_40px_color-mix(in_srgb,var(--background)75%,transparent)]">
			<header className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-3 py-3">
				<div className="flex min-w-0 items-center gap-2">
					<CalendarClock className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
					<h2 className="truncate text-base font-black uppercase leading-none text-foreground">Calendario de fútbol</h2>
				</div>

				<div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
					<CompetitionTabs competition={competition} onChange={setCompetition} />
					<label className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
						<span>Solo mis equipos</span>
						<Switch
							checked={onlyFavorites}
							disabled={favoriteTeamIds.length === 0}
							title={favoriteTeamIds.length === 0 ? 'Marca primero algún equipo como favorito' : undefined}
							aria-label="Solo mis equipos"
							onCheckedChange={setOnlyFavorites}
						/>
					</label>
					<MatchdayNavigation
						groups={matchdayGroups}
						currentIndex={visibleMatchdayIndex}
						onPrevious={() => setCurrentMatchdayIndex(index => Math.max(0, index - 1))}
						onNext={() => setCurrentMatchdayIndex(index => Math.min(matchdayGroups.length - 1, index + 1))}
					/>
				</div>
			</header>
			{content}
		</section>
	)
}
