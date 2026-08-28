import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CalendarCheck from 'lucide-react/dist/esm/icons/calendar-check'
import ListOrdered from 'lucide-react/dist/esm/icons/list-ordered'
import CalendarClock from 'lucide-react/dist/esm/icons/calendar-clock'
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Info from 'lucide-react/dist/esm/icons/info'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import Star from 'lucide-react/dist/esm/icons/star'
import Trophy from 'lucide-react/dist/esm/icons/trophy'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/settings-store'
import type { MatchdayGroup } from '../logic/group-matches'
import { findCurrentMatchdayIndex, groupByMatchday } from '../logic/group-matches'
import { formatStageLabel } from '../logic/format-match'
import { mergeMatchProgress } from '../logic/merge-matches'
import { CompetitionTabs } from './competition-tabs'
import { MatchDayBlock } from './match-day-block'
import { SettingsLink } from './settings-link'
import { StandingsPanel } from './standings-panel'
import { SURFACE } from './surfaces'
import {
	fetchCompetitionMatches,
	shouldPollMatches,
	shouldWatchMatches,
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


function createInitialCompetitionStates(): Record<FootballCompetitionCode, CompetitionState> {
	return {
		PD: { ...INITIAL_COMPETITION_STATE },
		CL: { ...INITIAL_COMPETITION_STATE },
	}
}

/**
 * Explains where the fixtures come from and how often they move. Rendered inline
 * rather than in a popover so it cannot interact with the standings panel's
 * outside-click dismissal.
 */
function MatchesInfo() {
	return (
		<div className={cn('mx-3 mt-3 grid gap-1.5 rounded-lg px-3 py-2.5 text-[11px] leading-snug', SURFACE.panel)}>
			<p className="text-muted-foreground">
				Los partidos vienen de{' '}
				<a
					href="https://www.football-data.org"
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
				>
					football-data.org
					<ExternalLink className="h-3 w-3" aria-hidden="true" />
				</a>
				. Se pide la temporada entera de una vez, así que moverte entre jornadas no gasta ninguna petición.
			</p>
			<p className="text-muted-foreground">
				El calendario se guarda hasta 6 horas, pero nunca más allá del siguiente saque inicial. Cuando hay algún
				partido en juego se actualiza solo cada minuto, y deja de hacerlo al terminar la jornada.
			</p>
			<p className="text-muted-foreground">
				Los horarios se muestran en tu hora local. El minuto de un partido en directo solo aparece si la API lo
				envía, y no lo hace siempre.
			</p>
		</div>
	)
}

function CalendarSkeleton() {
	return (
		<div className="grid gap-3 px-3 py-3" aria-label="Cargando calendario de fútbol">
			{Array.from({ length: 3 }, (_, row) => (
				<div key={row} className="flex items-start gap-2.5">
					<Skeleton className="mt-1.5 h-2.5 w-[52px] shrink-0 rounded-sm" />
					<div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5 md:grid-cols-2">
						{Array.from({ length: 2 }, (_, index) => (
							<div
								key={index}
								className={cn('flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5', SURFACE.fixture)}
							>
								<Skeleton className="h-3 max-w-[144px] flex-1 rounded-sm" />
								<Skeleton className="h-5 w-5 rounded-full" />
								<Skeleton className="h-[22px] w-[52px] shrink-0 rounded-sm" />
								<Skeleton className="h-5 w-5 rounded-full" />
								<Skeleton className="h-3 max-w-[144px] flex-1 rounded-sm" />
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	)
}

function NoKeyState() {
	return (
		<div className={cn('mx-3 my-3 grid gap-2 rounded-lg px-4 py-3 text-sm', SURFACE.panel)}>
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
		<div className={cn('mx-3 my-3 rounded-lg px-4 py-4 text-center', SURFACE.panel)}>
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
		<div className={cn('mx-3 my-3 flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3', SURFACE.panelDanger)}>
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


function FavoritesToggle({
	enabled,
	disabled,
	onToggle,
}: {
	enabled: boolean
	disabled: boolean
	onToggle: (enabled: boolean) => void
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={enabled}
			aria-label="Solo mis equipos"
			disabled={disabled}
			title={disabled ? 'Marca primero algún equipo como favorito' : 'Mostrar solo tus equipos'}
			onClick={() => onToggle(!enabled)}
			className={cn(
				'flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-muted-foreground',
				enabled && cn('border-primary text-primary hover:text-primary', SURFACE.toggleOn),
			)}
		>
			<Star className={cn('h-3.5 w-3.5', enabled && 'fill-primary')} aria-hidden="true" />
			Mis equipos
		</button>
	)
}

function getMatchdayLabel(group: MatchdayGroup | undefined): string {
	if (!group) return 'Sin jornadas'
	if (group.matchday !== null) return `Jornada ${group.matchday}`

	const firstMatch = group.days[0]?.matches[0]
	return firstMatch ? formatStageLabel(firstMatch) : group.stage
}

function MatchdayNavigation({
	className,
	groups,
	currentIndex,
	isOnLiveMatchday,
	isLoading,
	onPrevious,
	onNext,
	onReturnToLive,
}: {
	className?: string
	groups: MatchdayGroup[]
	currentIndex: number
	/** True when the visible matchday is the one being played right now. */
	isOnLiveMatchday: boolean
	isLoading: boolean
	onPrevious: () => void
	onNext: () => void
	onReturnToLive: () => void
}) {
	const atStart = currentIndex <= 0
	const atEnd = groups.length === 0 || currentIndex >= groups.length - 1
	const currentGroup = groups[currentIndex]
	const currentLabel = getMatchdayLabel(currentGroup)
	const pillClassName = 'flex h-7 min-w-0 flex-1 items-center justify-center rounded-md bg-muted px-1.5'
	const pillContent =
		isLoading || (currentGroup?.matchday !== null && currentGroup !== undefined) ? (
			<span className="flex items-baseline gap-1.5">
				<span className="text-[9px] uppercase tracking-wider text-muted-foreground">Jornada</span>
				<span
					className={cn(
						'text-sm font-black tabular-nums',
						isLoading ? 'text-muted-foreground' : 'text-foreground',
					)}
				>
					{isLoading ? '—' : currentGroup?.matchday}
				</span>
			</span>
		) : (
			<span className="truncate text-xs font-black uppercase text-foreground">{currentLabel}</span>
		)

	return (
		// Fixed width so switching competition cannot shove the header around, sized
		// for the longest label the pill can hold ("Tercer puesto", "Sin jornadas").
		<div className={cn('flex w-[232px] shrink-0 items-center gap-1.5', className)}>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				onClick={onPrevious}
				disabled={atStart}
				aria-label="Jornada anterior"
				className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
			>
				<ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
			</Button>
			<span className={pillClassName} title={currentLabel}>
				{pillContent}
			</span>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				onClick={onNext}
				disabled={atEnd}
				aria-label="Jornada siguiente"
				className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
			>
				<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				onClick={onReturnToLive}
				aria-label="Volver a la jornada en curso"
				title="Volver a la jornada en curso"
				aria-hidden={isOnLiveMatchday}
				tabIndex={isOnLiveMatchday ? -1 : undefined}
				className={cn(
					'h-7 w-7 rounded-md bg-muted text-primary hover:bg-secondary hover:text-primary',
					isOnLiveMatchday && 'pointer-events-none invisible',
				)}
			>
				<CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
			</Button>
		</div>
	)
}

export function FootballCalendar() {
	const favoriteTeamIds = useSettingsStore(state => state.footballFavoriteTeamIds)
	const setFootballFavoriteTeamIds = useSettingsStore(state => state.setFootballFavoriteTeamIds)
	const [competition, setCompetition] = useState<FootballCompetitionCode>('PD')
	const [onlyFavorites, setOnlyFavorites] = useState(false)
	const [standingsOpen, setStandingsOpen] = useState(false)
	const [infoOpen, setInfoOpen] = useState(false)
	const standingsButtonRef = useRef<HTMLButtonElement>(null)
	/**
	 * The matchday the reader navigated to, tagged with the view it belongs to.
	 * Storing a bare index and resetting it from an effect painted one frame with
	 * the previous competition's matchday before correcting itself.
	 */
	const [selectedMatchday, setSelectedMatchday] = useState<{
		competition: FootballCompetitionCode
		onlyFavorites: boolean
		index: number
	} | null>(null)
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
						[competition]: {
							loading: false,
							// The API can answer with an older snapshot than the one on screen.
							matches: mergeMatchProgress(previous[competition].matches, result.matches),
							error: null,
						},
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

	const liveMatchdayIndex = useMemo(() => findCurrentMatchdayIndex(matchdayGroups), [matchdayGroups])

	const lastMatchdayIndex = Math.max(0, matchdayGroups.length - 1)
	const followsLive =
		selectedMatchday === null ||
		selectedMatchday.competition !== competition ||
		selectedMatchday.onlyFavorites !== onlyFavorites
	const visibleMatchdayIndex = followsLive
		? liveMatchdayIndex
		: Math.min(Math.max(selectedMatchday.index, 0), lastMatchdayIndex)

	const goToMatchday = (index: number) => {
		setSelectedMatchday({
			competition,
			onlyFavorites,
			index: Math.min(Math.max(index, 0), lastMatchdayIndex),
		})
	}
	const visibleGroup = matchdayGroups[visibleMatchdayIndex]

	const handleToggleFavoriteTeam = (teamId: number) => {
		if (favoriteTeamIds.includes(teamId)) {
			setFootballFavoriteTeamIds(favoriteTeamIds.filter(id => id !== teamId))
			return
		}

		setFootballFavoriteTeamIds([...favoriteTeamIds, teamId])
	}

	const refreshMatches = useCallback(async (target: FootballCompetitionCode) => {
		try {
			const result = await fetchCompetitionMatches(target)
			if (!result.ok) {
				// Surfaced on purpose: a swallowed failure leaves the card frozen on an
				// old snapshot with no sign that anything went wrong.
				logger.warn('Football calendar: live refresh failed, keeping the previous snapshot', {
					competition: target,
					reason: result.reason,
				})
				return
			}

			setCompetitionStates(previous => ({
				...previous,
				[target]: {
					loading: false,
					matches: mergeMatchProgress(previous[target].matches, result.matches),
					error: null,
				},
			}))
		} catch (error) {
			logger.error('Football calendar: live refresh failed', error)
		}
	}, [])

	// The ticker reads the latest matches without restarting on every refresh.
	const matchesRef = useRef(currentState.matches)
	useEffect(() => {
		matchesRef.current = currentState.matches
	})

	/**
	 * Keep a ticker alive around a matchday and let it decide, on each tick,
	 * whether to fetch.
	 *
	 * The decision has to be re-made over time rather than when the data changes:
	 * with the page open before kickoff nothing in the data moves, so an effect
	 * keyed on the matches alone never noticed the match starting and the card sat
	 * on the kickoff time until a manual reload.
	 */
	const watchesMatchday = currentState.matches !== null && shouldWatchMatches(currentState.matches)

	useEffect(() => {
		if (!watchesMatchday) return

		const intervalId = setInterval(() => {
			const matches = matchesRef.current
			if (matches !== null && shouldPollMatches(matches)) void refreshMatches(competition)
		}, 60_000)

		return () => clearInterval(intervalId)
	}, [competition, watchesMatchday, refreshMatches])

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
		<div className="grid gap-2.5 px-3 py-3" aria-label="Partidos de la jornada">
			{visibleGroup?.days.map(dayGroup => (
				<MatchDayBlock
					key={`${visibleGroup.key}-${dayGroup.dayKey}`}
					group={dayGroup}
					dayGroupKey={visibleGroup.key}
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
			<header className="border-b border-border">
				{/* The title owns its own band: the controls used to sit eight pixels under
				    it whenever the row wrapped, reading as one cramped block. */}
				<div className="flex min-w-0 items-center gap-2 border-b border-border px-3 py-2.5">
					<CalendarClock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
					<h2 className="truncate text-[13px] font-black uppercase leading-none tracking-[0.14em] text-foreground">
						Calendario de fútbol
					</h2>
					<button
						type="button"
						onClick={() => setInfoOpen(open => !open)}
						aria-expanded={infoOpen}
						aria-label="Sobre estos datos"
						title="Sobre estos datos"
						className={cn(
							'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
							infoOpen && 'text-primary hover:text-primary',
						)}
					>
						<Info className="h-3.5 w-3.5" aria-hidden="true" />
					</button>
				</div>

				<div className="flex min-w-0 flex-wrap items-center gap-2 px-3 py-2.5">
					<CompetitionTabs competition={competition} onChange={setCompetition} />
					<Button
						type="button"
						variant="ghost"
						size="sm"
						ref={standingsButtonRef}
						onClick={() => setStandingsOpen(isOpen => !isOpen)}
						aria-haspopup="dialog"
						aria-expanded={standingsOpen}
						className="h-7 shrink-0 gap-1.5 rounded-md border border-border px-2.5 text-[11px] font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
					>
						<ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />
						Clasificación
					</Button>
					<FavoritesToggle
						enabled={onlyFavorites}
						disabled={favoriteTeamIds.length === 0}
						onToggle={setOnlyFavorites}
					/>
					<MatchdayNavigation
						className="ml-auto"
						groups={matchdayGroups}
						currentIndex={visibleMatchdayIndex}
						isOnLiveMatchday={visibleMatchdayIndex === liveMatchdayIndex}
						isLoading={currentState.loading}
						onPrevious={() => goToMatchday(visibleMatchdayIndex - 1)}
						onNext={() => goToMatchday(visibleMatchdayIndex + 1)}
						onReturnToLive={() => setSelectedMatchday(null)}
					/>
				</div>
			</header>
			{infoOpen && <MatchesInfo />}
			{content}

			<StandingsPanel
				open={standingsOpen}
				competition={competition}
				favoriteTeamIds={favoriteTeamIds}
				triggerRef={standingsButtonRef}
				onOpenChange={setStandingsOpen}
				onCompetitionChange={setCompetition}
			/>
		</section>
	)
}
