import { useEffect, useMemo, useRef, useState } from 'react'
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days'
import Clock3 from 'lucide-react/dist/esm/icons/clock-3'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Gamepad2 from 'lucide-react/dist/esm/icons/gamepad-2'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import MessageSquarePlus from 'lucide-react/dist/esm/icons/message-square-plus'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import Info from 'lucide-react/dist/esm/icons/info'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Z_INDEXES } from '@/constants'
import { useSettingsStore } from '@/store/settings-store'
import type { GameReleaseCalendarLayout } from '@/store/settings-types'
import {
	getGameTemplateString,
	getUpcomingGameReleases,
	hasIgdbCredentials,
	type UpcomingGameRelease,
} from '@/services/api/igdb'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { saveReleaseThreadPrefill } from '../logic/thread-prefill'

interface ReleaseState {
	releases: UpcomingGameRelease[]
	loading: boolean
	error: string | null
	hasCredentials: boolean | null
}

type PlatformFilter = 'all' | 'pc' | 'playstation' | 'xbox' | 'switch'
type PlatformKind = 'pc' | 'playstation' | 'xbox' | 'switch' | 'other'

interface PlatformBadge {
	kind: PlatformKind
	label: string
}

const PLATFORM_FILTERS: Array<{ id: PlatformFilter; label: string; tokens: string[] }> = [
	{ id: 'all', label: 'Todos', tokens: [] },
	{ id: 'pc', label: 'PC', tokens: ['pc', 'windows'] },
	{ id: 'playstation', label: 'PlayStation', tokens: ['playstation', 'ps4', 'ps5'] },
	{ id: 'xbox', label: 'Xbox', tokens: ['xbox'] },
	{ id: 'switch', label: 'Switch', tokens: ['switch', 'nintendo'] },
]
const RELEASE_WINDOW_DAYS = 30
const MAX_FEATURED_RELEASES_PER_DAY = 5
const MIN_FEATURED_RELEASE_SCORE = 40
const MIN_FALLBACK_RELEASE_SCORE = 25
const LOADING_SKELETON_COUNT = 24

function addDays(date: Date, days: number): Date {
	const next = new Date(date)
	next.setDate(next.getDate() + days)
	return next
}

function formatReleaseDate(dateString: string): string {
	const date = new Date(`${dateString}T00:00:00`)
	return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(date).replace('.', '')
}

function getPlatformBadge(platform: string): PlatformBadge {
	const normalized = platform.toLowerCase()
	if (normalized.includes('pc') || normalized.includes('win')) return { kind: 'pc', label: 'PC' }
	if (normalized.includes('switch') || normalized.includes('nintendo')) return { kind: 'switch', label: 'Nintendo Switch' }
	if (normalized.includes('xbox') || normalized.includes('series x') || normalized.includes('series s')) {
		return { kind: 'xbox', label: 'Xbox' }
	}
	if (normalized.includes('ps') || normalized.includes('playstation')) {
		return { kind: 'playstation', label: 'PlayStation' }
	}
	return { kind: 'other', label: platform || 'Por confirmar' }
}

function getVisiblePlatforms(platforms: string[], priorityFilter: PlatformFilter = 'all'): PlatformBadge[] {
	const badges = (platforms.length > 0 ? platforms : ['Por confirmar']).map(getPlatformBadge)
	const unique = new Map<PlatformKind | string, PlatformBadge>()

	for (const badge of badges) {
		const key = badge.kind === 'other' ? badge.label : badge.kind
		if (!unique.has(key)) unique.set(key, badge)
	}

	const visible = [...unique.values()]
	if (priorityFilter === 'all') return visible

	const priorityIndex = visible.findIndex(platform => platform.kind === priorityFilter)
	if (priorityIndex <= 0) return visible

	const [priorityPlatform] = visible.splice(priorityIndex, 1)
	return [priorityPlatform, ...visible]
}

function getPlatformBadgeClass(platform: PlatformBadge): string {
	if (platform.kind === 'pc') {
		return 'border-[color-mix(in_srgb,var(--chart-1)45%,var(--border))] bg-[color-mix(in_srgb,var(--chart-1)18%,var(--card))] text-foreground'
	}
	if (platform.kind === 'switch') {
		return 'border-[color-mix(in_srgb,var(--chart-2)45%,var(--border))] bg-[color-mix(in_srgb,var(--chart-2)18%,var(--card))] text-foreground'
	}
	if (platform.kind === 'xbox') {
		return 'border-[color-mix(in_srgb,var(--chart-3)45%,var(--border))] bg-[color-mix(in_srgb,var(--chart-3)18%,var(--card))] text-foreground'
	}
	if (platform.kind === 'playstation') {
		return 'border-[color-mix(in_srgb,var(--chart-4)45%,var(--border))] bg-[color-mix(in_srgb,var(--chart-4)18%,var(--card))] text-foreground'
	}
	return 'border-border bg-muted text-muted-foreground'
}

function getDaysUntilRelease(dateString: string): number {
	const today = new Date()
	today.setHours(0, 0, 0, 0)
	const releaseDate = new Date(`${dateString}T00:00:00`)
	releaseDate.setHours(0, 0, 0, 0)
	return Math.round((releaseDate.getTime() - today.getTime()) / 86_400_000)
}

function getReleaseTimingLabel(dateString: string): string {
	const days = getDaysUntilRelease(dateString)
	if (days <= 0) return 'Hoy'
	if (days === 1) return 'Mañana'
	if (days < 7) return `${days} días`
	if (days < 14) return 'Esta semana'
	return formatReleaseDate(dateString)
}

function getDateBadgeClass(dateString: string): string {
	const days = getDaysUntilRelease(dateString)
	if (days <= 0) return 'bg-primary text-primary-foreground'
	if (days === 1) return 'bg-[color-mix(in_srgb,var(--primary)75%,var(--chart-3))] text-primary-foreground'
	return 'bg-[color-mix(in_srgb,var(--foreground)90%,transparent)] text-background'
}

function matchesPlatformFilter(release: UpcomingGameRelease, filter: PlatformFilter): boolean {
	if (filter === 'all') return true

	const config = PLATFORM_FILTERS.find(item => item.id === filter)
	if (!config) return true

	const platforms = release.platforms.length > 0 ? release.platforms : release.releasePlatforms
	const platformBadges = platforms.map(getPlatformBadge)

	if (filter === 'pc') return platformBadges.some(platform => platform.kind === 'pc')
	if (filter === 'playstation') return platformBadges.some(platform => platform.kind === 'playstation')
	if (filter === 'xbox') return platformBadges.some(platform => platform.kind === 'xbox')
	if (filter === 'switch') return platformBadges.some(platform => platform.kind === 'switch')

	return config.tokens.some(token => platforms.join(' ').toLowerCase().includes(token))
}

function getDisplayPlatforms(release: UpcomingGameRelease): string[] {
	return release.platforms.length > 0 ? release.platforms : release.releasePlatforms
}

function getReleasePlatformSummary(release: UpcomingGameRelease): string {
	const platforms = getDisplayPlatforms(release)
	const badges = getVisiblePlatforms(platforms)
	if (badges.length === 0) return 'plataformas por confirmar'
	return badges.map(platform => platform.label).join(', ')
}

function isNotableRelease(release: UpcomingGameRelease): boolean {
	return (
		release.relevanceScore >= MIN_FEATURED_RELEASE_SCORE ||
		release.hypes > 0 ||
		release.follows >= 10 ||
		release.ratingCount >= 5
	)
}

function sortByImportance(a: UpcomingGameRelease, b: UpcomingGameRelease): number {
	return (
		b.relevanceScore - a.relevanceScore ||
		b.hypes - a.hypes ||
		b.follows - a.follows ||
		a.name.localeCompare(b.name, 'es') ||
		a.id - b.id
	)
}

function selectFeaturedReleases(releases: UpcomingGameRelease[]): UpcomingGameRelease[] {
	const byDay = new Map<string, UpcomingGameRelease[]>()

	for (const release of releases) {
		const dayReleases = byDay.get(release.releaseDate) ?? []
		dayReleases.push(release)
		byDay.set(release.releaseDate, dayReleases)
	}

	const selected: UpcomingGameRelease[] = []
	for (const [, dayReleases] of byDay) {
		const ranked = [...dayReleases].sort(sortByImportance)
		const notable = ranked.filter(isNotableRelease)
		const candidates = notable.length > 0 ? notable : ranked.filter(release => release.relevanceScore >= MIN_FALLBACK_RELEASE_SCORE)
		selected.push(...candidates.slice(0, MAX_FEATURED_RELEASES_PER_DAY))
	}

	return selected.sort((a, b) => a.releaseTimestamp - b.releaseTimestamp || sortByImportance(a, b))
}

export function ReleaseCalendar() {
	const railRef = useRef<HTMLDivElement | null>(null)
	const bottomBarRef = useRef<HTMLDivElement | null>(null)
	const previousBodyPaddingRef = useRef<string | null>(null)
	const [state, setState] = useState<ReleaseState>({
		releases: [],
		loading: true,
		error: null,
		hasCredentials: null,
	})
	const [creatingId, setCreatingId] = useState<number | null>(null)
	const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')
	const [scrollState, setScrollState] = useState({ canScrollPrevious: false, canScrollNext: false })
	const savedLayout = useSettingsStore(state => state.gameReleaseCalendarLayout)
	const [layout, setLayout] = useState<GameReleaseCalendarLayout>(savedLayout)
	const setSetting = useSettingsStore(state => state.setSetting)

	const dateRange = useMemo(() => {
		const from = new Date()
		from.setHours(0, 0, 0, 0)
		const to = addDays(from, RELEASE_WINDOW_DAYS)
		return { from, to }
	}, [])

	async function loadReleases() {
		setState(prev => ({ ...prev, loading: true, error: null }))

		try {
			const hasCredentials = await hasIgdbCredentials()
			if (!hasCredentials) {
				setState({ releases: [], loading: false, error: null, hasCredentials: false })
				return
			}

			const releases = await getUpcomingGameReleases(dateRange)
			setState({ releases, loading: false, error: null, hasCredentials: true })
		} catch (error) {
			logger.error('Release calendar: failed to load upcoming games', error)
			setState(prev => ({
				...prev,
				loading: false,
				error: 'No se han podido cargar los próximos lanzamientos.',
				hasCredentials: prev.hasCredentials ?? true,
			}))
		}
	}

	useEffect(() => {
		void loadReleases()
		// eslint-disable-next-line react-hooks/exhaustive-deps -- dateRange is intentionally stable for this mount.
	}, [])

	useEffect(() => {
		setLayout(savedLayout)
	}, [savedLayout])

	useEffect(() => {
		if (layout !== 'bottom') {
			if (previousBodyPaddingRef.current !== null) {
				document.body.style.paddingBottom = previousBodyPaddingRef.current
				previousBodyPaddingRef.current = null
			}
			return
		}

		if (previousBodyPaddingRef.current === null) {
			previousBodyPaddingRef.current = document.body.style.paddingBottom
		}

		const updateBodyPadding = () => {
			const bottomHeight = bottomBarRef.current?.offsetHeight ?? 0
			if (bottomHeight <= 0) return

			const computedPadding = Number.parseFloat(window.getComputedStyle(document.body).paddingBottom) || 0
			document.body.style.paddingBottom = `${Math.max(computedPadding, bottomHeight + 16)}px`
		}

		updateBodyPadding()
		window.addEventListener('resize', updateBodyPadding)

		return () => {
			window.removeEventListener('resize', updateBodyPadding)
			if (previousBodyPaddingRef.current !== null) {
				document.body.style.paddingBottom = previousBodyPaddingRef.current
				previousBodyPaddingRef.current = null
			}
		}
	}, [layout, state.loading])

	const filteredReleases = useMemo(() => {
		const releases = state.releases.filter(release => matchesPlatformFilter(release, platformFilter))
		return selectFeaturedReleases(releases)
	}, [state.releases, platformFilter])

	function updateScrollState() {
		const rail = railRef.current
		if (!rail) {
			setScrollState({ canScrollPrevious: false, canScrollNext: false })
			return
		}

		const maxScrollLeft = rail.scrollWidth - rail.clientWidth
		setScrollState({
			canScrollPrevious: rail.scrollLeft > 1,
			canScrollNext: maxScrollLeft - rail.scrollLeft > 1,
		})
	}

	useEffect(() => {
		updateScrollState()
	}, [layout, state.loading, filteredReleases.length])

	useEffect(() => {
		const rail = railRef.current
		if (!rail) return

		rail.addEventListener('scroll', updateScrollState, { passive: true })
		window.addEventListener('resize', updateScrollState)
		updateScrollState()

		return () => {
			rail.removeEventListener('scroll', updateScrollState)
			window.removeEventListener('resize', updateScrollState)
		}
	}, [layout, state.loading, filteredReleases.length])

	function scrollRail(direction: 'previous' | 'next') {
		if (!railRef.current) return

		railRef.current?.scrollBy({
			left: direction === 'next' ? railRef.current.clientWidth : -railRef.current.clientWidth,
			behavior: 'smooth',
		})
		window.setTimeout(updateScrollState, 250)
	}

	function selectLayout(nextLayout: GameReleaseCalendarLayout) {
		setLayout(nextLayout)
		setSetting('gameReleaseCalendarLayout', nextLayout)
	}

	async function handleCreateThread(release: UpcomingGameRelease) {
		if (creatingId !== null) return

		setCreatingId(release.id)
		try {
			const body = await getGameTemplateString(release.id)
			if (!body) throw new Error('Empty game template')

			saveReleaseThreadPrefill({
				subforum: 'juegos',
				title: `[Hilo Oficial] ${release.name}`,
				body,
			})
			window.location.assign('/foro/juegos/nuevo-hilo')
		} catch (error) {
			logger.error('Release calendar: failed to prepare thread prefill', error)
			setState(prev => ({
				...prev,
				error: 'No se ha podido preparar la plantilla del hilo.',
			}))
			setCreatingId(null)
		}
	}

	function renderPosterRail(showActions = false) {
		const cardClass = showActions
			? 'group grid w-[96px] shrink-0 gap-1.5 rounded-md border border-border bg-card p-1.5 transition-colors hover:border-primary/70'
			: 'group grid w-[78px] shrink-0 gap-1 rounded border border-border bg-card p-1 transition-colors hover:border-primary/70'
		const posterClass = showActions
			? 'relative flex h-[128px] w-full items-center justify-center overflow-hidden rounded bg-background'
			: 'relative flex h-[104px] w-full items-center justify-center overflow-hidden rounded-sm bg-background'
		const dateClass = showActions
			? 'border-t border-border pt-1.5 text-center text-[11px] font-black uppercase leading-none text-primary'
			: 'border-t border-border pt-1 text-center text-[10px] font-black uppercase leading-none text-primary'

		return (
			<div className={cn('flex', showActions ? 'gap-2.5' : 'gap-2')}>
				{filteredReleases.map(release => {
					const isCreating = creatingId === release.id
					const title = `${release.name} · ${formatReleaseDate(release.releaseDate)} · Plataformas: ${getReleasePlatformSummary(release)}`
					const poster = (
						<div className={posterClass}>
							{release.coverUrl ? (
								<img
									src={release.coverUrl}
									alt={release.name}
									loading="lazy"
									referrerPolicy="no-referrer"
									className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
								/>
							) : (
								<Gamepad2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
							)}
							{showActions ? (
									<div className="absolute inset-x-1 bottom-1 flex justify-end gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
									<a
										href={release.igdbUrl}
										target="_blank"
										rel="noreferrer"
											title="Ver en IGDB"
											aria-label={`Ver ${release.name} en IGDB`}
											className="flex h-7 w-7 items-center justify-center rounded bg-background/85 text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
										>
											<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
										</a>
									<button
										type="button"
										title="Crear hilo con plantilla"
											aria-label={`Crear hilo de ${release.name}`}
											onClick={() => void handleCreateThread(release)}
											disabled={creatingId !== null}
											className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
										>
											{isCreating ? (
												<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
											) : (
												<MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
											)}
										</button>
								</div>
							) : null}
						</div>
					)

					if (showActions) {
						return (
							<article
								key={`${release.id}-${release.releaseDate}`}
								title={title}
								className={cn(cardClass, 'focus-within:border-primary/70')}
							>
								{poster}
								<span className={dateClass}>
									{formatReleaseDate(release.releaseDate)}
								</span>
							</article>
						)
					}

					return (
						<a
							key={`${release.id}-${release.releaseDate}`}
							href={release.igdbUrl}
							target="_blank"
							rel="noreferrer"
							title={title}
							className={cn(cardClass, 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary')}
						>
							{poster}
							<span className={dateClass}>
								{formatReleaseDate(release.releaseDate)}
							</span>
						</a>
					)
				})}
			</div>
		)
	}

	function renderPosterRailSkeleton(showActions = false) {
		const cardClass = showActions
			? 'grid w-[96px] shrink-0 gap-1.5 rounded-md border border-border bg-card p-1.5'
			: 'grid w-[78px] shrink-0 gap-1 rounded border border-border bg-card p-1'
		const posterClass = showActions
			? 'h-[128px] rounded bg-[linear-gradient(110deg,color-mix(in_srgb,var(--muted)78%,transparent)_8%,color-mix(in_srgb,var(--foreground)14%,transparent)_18%,color-mix(in_srgb,var(--muted)78%,transparent)_33%)] bg-[length:200%_100%] animate-[release-calendar-shimmer_1.15s_linear_infinite]'
			: 'h-[104px] rounded-sm bg-[linear-gradient(110deg,color-mix(in_srgb,var(--muted)78%,transparent)_8%,color-mix(in_srgb,var(--foreground)14%,transparent)_18%,color-mix(in_srgb,var(--muted)78%,transparent)_33%)] bg-[length:200%_100%] animate-[release-calendar-shimmer_1.15s_linear_infinite]'
		const dateClass = showActions
			? 'mx-auto h-3 w-12 rounded-full bg-primary/20'
			: 'mx-auto h-2.5 w-10 rounded-full bg-primary/20'

		return (
			<div className={cn('flex min-w-max', showActions ? 'gap-2.5' : 'gap-2')} aria-hidden="true">
				{Array.from({ length: LOADING_SKELETON_COUNT }, (_, index) => (
					<div key={index} className={cardClass}>
						<div className={posterClass} />
						<div className="border-t border-border pt-1.5">
							<div className={dateClass} />
						</div>
					</div>
				))}
			</div>
		)
	}

	function renderShowcaseSkeleton() {
		return (
			<div className="flex items-start gap-3" aria-hidden="true">
				{Array.from({ length: 6 }, (_, index) => (
					<article
						key={index}
						className="flex h-[442px] w-[168px] shrink-0 flex-col overflow-hidden rounded-md border border-border bg-[color-mix(in_srgb,var(--card)94%,var(--background))]"
					>
						<div className="h-[220px] shrink-0 bg-[linear-gradient(110deg,color-mix(in_srgb,var(--muted)78%,transparent)_8%,color-mix(in_srgb,var(--foreground)14%,transparent)_18%,color-mix(in_srgb,var(--muted)78%,transparent)_33%)] bg-[length:200%_100%] animate-[release-calendar-shimmer_1.15s_linear_infinite]" />
						<div className="flex min-h-0 flex-1 flex-col p-2.5">
							<div className="h-4 w-5/6 rounded bg-muted" />
							<div className="mt-2 h-4 w-2/3 rounded bg-muted/80" />
							<div className="mt-5 h-2.5 w-20 rounded-full bg-muted/80" />
							<div className="mt-2 flex flex-wrap gap-1.5">
								<div className="h-6 w-12 rounded border border-border bg-muted/70" />
								<div className="h-6 w-20 rounded border border-border bg-muted/70" />
							</div>
							<div className="mt-auto border-t border-border pt-2">
								<div className="h-11 rounded-md border border-border bg-background/55" />
							</div>
						</div>
					</article>
				))}
			</div>
		)
	}

	const layoutControls = (
		<div className="flex rounded-md bg-muted p-1">
			<button
				type="button"
				onClick={() => selectLayout('showcase')}
				aria-pressed={layout === 'showcase'}
				className={cn(
					'h-8 rounded px-3 text-[12px] font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
					layout === 'showcase' && 'bg-primary text-primary-foreground hover:text-primary-foreground'
				)}
			>
				Carrusel
			</button>
			<button
				type="button"
				onClick={() => selectLayout('minimal')}
				aria-pressed={layout === 'minimal'}
				className={cn(
					'h-8 rounded px-3 text-[12px] font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
					layout === 'minimal' && 'bg-primary text-primary-foreground hover:text-primary-foreground'
				)}
			>
				Minimalista
			</button>
			<button
				type="button"
				onClick={() => selectLayout('bottom')}
				aria-pressed={layout === 'bottom'}
				className={cn(
					'h-8 rounded px-3 text-[12px] font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
					layout === 'bottom' && 'bg-primary text-primary-foreground hover:text-primary-foreground'
				)}
			>
				Inferior
			</button>
		</div>
	)

	const platformControls = (
		<div className="flex max-w-full gap-1 overflow-x-auto rounded-md bg-muted p-1">
			{PLATFORM_FILTERS.map(filter => (
				<button
					key={filter.id}
					type="button"
					onClick={() => setPlatformFilter(filter.id)}
					aria-pressed={platformFilter === filter.id}
					className={cn(
						'h-8 shrink-0 rounded px-2.5 text-[12px] font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
						platformFilter === filter.id && 'bg-primary text-primary-foreground shadow-sm hover:text-primary-foreground'
					)}
				>
					{filter.label}
				</button>
			))}
		</div>
	)

	const navigationControls =
		layout === 'showcase' || layout === 'bottom' ? (
			<div className="flex items-center gap-1">
				<button
					type="button"
					onClick={() => scrollRail('previous')}
					disabled={!scrollState.canScrollPrevious}
					className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-primary/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-muted-foreground"
					title="Anterior"
					aria-label="Anterior"
				>
					<ChevronLeft className="h-4 w-4" />
				</button>
				<button
					type="button"
					onClick={() => scrollRail('next')}
					disabled={!scrollState.canScrollNext}
					className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-primary/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-muted-foreground"
					title="Siguiente"
					aria-label="Siguiente"
				>
					<ChevronRight className="h-4 w-4" />
				</button>
			</div>
		) : null

	const refreshControl = (
		<Button
			type="button"
			size="icon-sm"
			variant="ghost"
			title="Actualizar lanzamientos"
			onClick={() => void loadReleases()}
			disabled={state.loading}
			className="h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
		>
			{state.loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
		</Button>
	)

	const releaseCountLabel = state.loading ? 'Buscando...' : `${filteredReleases.length} destacados`
	const releaseInfo = (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-primary/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
					title="Cómo se eligen los lanzamientos"
					aria-label="Cómo se eligen los lanzamientos"
				>
					<Info className="h-3.5 w-3.5" aria-hidden="true" />
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" sideOffset={8} className="w-80 p-3 text-xs leading-relaxed">
				<div className="space-y-2">
					<p className="text-sm font-black text-foreground">Cómo se eligen</p>
					<p className="text-muted-foreground">
						Muestra lanzamientos de los próximos {RELEASE_WINDOW_DAYS} días. Incluye juegos base, remakes,
						remasters y estrenos por plataforma.
					</p>
					<p className="text-muted-foreground">
						Se descartan DLCs, expansiones, versiones hijas y fechas no finales como betas, alpha, early
						access o cancelados.
					</p>
					<p className="text-muted-foreground">
						Los destacados se priorizan con señales de IGDB: hypes, follows, valoraciones, rating, plataformas
						y si la ficha tiene carátula.
					</p>
					<p className="text-[11px] font-semibold text-primary">
						Para evitar ruido, se muestran hasta {MAX_FEATURED_RELEASES_PER_DAY} destacados por día.
					</p>
				</div>
			</PopoverContent>
		</Popover>
	)

	if (layout === 'bottom') {
		return (
			<div
				ref={bottomBarRef}
				className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 px-3 py-2.5 text-card-foreground shadow-[0_-12px_34px_color-mix(in_srgb,var(--background)78%,transparent)] backdrop-blur"
				style={{ zIndex: Z_INDEXES.STICKY }}
			>
				<style>
					{'@keyframes release-calendar-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}'}
				</style>
				<div className="flex w-full flex-col gap-2">
					<div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
						<div className="flex min-w-0 items-center gap-2">
							<Clock3 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
							<div className="flex min-w-0 items-baseline gap-2">
								<p className="truncate text-[12px] font-black uppercase leading-none text-foreground">
									Próximos lanzamientos
								</p>
								{releaseInfo}
								<p className="shrink-0 text-[11px] font-black leading-none text-primary">
									{releaseCountLabel}
								</p>
							</div>
						</div>

						<div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
							<div className="max-w-full">{platformControls}</div>
							{layoutControls}
							{navigationControls}
							{refreshControl}
						</div>
					</div>

					<div ref={railRef} className="w-full overflow-x-auto">
						{state.loading ? (
							<div className="relative overflow-hidden rounded-md border border-border/70 bg-background/35 px-2.5 py-2">
								<div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background/65 to-transparent" />
								<div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background/65 to-transparent" />
								<div className="mb-2 flex items-center gap-2 px-0.5 text-[11px] font-bold text-muted-foreground">
									<Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
									<span>Cargando próximos lanzamientos...</span>
								</div>
								<div className="overflow-hidden">
									{renderPosterRailSkeleton(true)}
								</div>
							</div>
						) : filteredReleases.length > 0 ? (
							renderPosterRail(true)
						) : state.hasCredentials ? (
							<p className="py-5 text-sm text-muted-foreground">
								No hay lanzamientos próximos para este filtro.
							</p>
						) : null}
					</div>
				</div>

				{state.hasCredentials === false ? (
					<p className="mt-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
						Configura VITE_IGDB_CLIENT_ID y VITE_IGDB_CLIENT_SECRET para activar el calendario.
					</p>
				) : null}

				{state.error ? (
					<p className="mt-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
						{state.error}
					</p>
				) : null}
			</div>
		)
	}

	return (
		<section className="mb-3 overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-[0_14px_40px_color-mix(in_srgb,var(--background)75%,transparent)]">
				<style>
					{'@keyframes release-calendar-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}'}
				</style>
				<div className="space-y-2 border-b border-border px-3 py-3">
					<div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
						<div className="flex min-w-[260px] flex-1 flex-wrap items-center gap-2.5 gap-y-1">
							<Clock3 className="h-5 w-5 shrink-0 text-primary" />
							<h2 className="whitespace-nowrap text-[16px] font-black uppercase leading-none text-foreground">
								Próximos lanzamientos
							</h2>
							{releaseInfo}
						<span className="hidden whitespace-nowrap rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-bold text-muted-foreground sm:inline-flex">
							Próximos {RELEASE_WINDOW_DAYS} días
						</span>
						{filteredReleases.length > 0 ? (
							<span className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-black text-primary">
								{filteredReleases.length} destacados
							</span>
						) : null}
					</div>

						<div className="ml-auto flex shrink-0 items-center gap-2">
							{layoutControls}
							{navigationControls}
							{refreshControl}
						</div>
				</div>

				<div className="flex min-w-0 items-center justify-between gap-2">
					{platformControls}
					<span className="shrink-0 text-[11px] font-semibold text-muted-foreground sm:hidden">
						{RELEASE_WINDOW_DAYS} días
					</span>
				</div>
			</div>

			{state.hasCredentials === false ? (
				<p className="m-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
					Configura VITE_IGDB_CLIENT_ID y VITE_IGDB_CLIENT_SECRET para activar el calendario.
				</p>
			) : null}

			{state.error ? (
				<p className="m-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
					{state.error}
				</p>
			) : null}

			{state.loading ? (
				layout === 'showcase' ? (
					<div className="overflow-x-auto px-3 py-3">
						<div className="mb-3 flex items-center gap-2 text-xs font-bold text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
							<span>Cargando próximos lanzamientos...</span>
						</div>
						{renderShowcaseSkeleton()}
					</div>
				) : (
					<div className="overflow-hidden bg-background/40 px-2.5 py-2">
						<div className="mb-2 flex items-center gap-2 px-0.5 text-xs font-bold text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
							<span>Cargando próximos lanzamientos...</span>
						</div>
						{renderPosterRailSkeleton()}
					</div>
				)
			) : filteredReleases.length > 0 ? (
					layout === 'showcase' ? (
						<div ref={railRef} className="overflow-x-auto px-3 py-3">
							<div className="flex items-start gap-3">
							{filteredReleases.map(release => {
								const isCreating = creatingId === release.id
								const dateLabel = getReleaseTimingLabel(release.releaseDate)
								const visiblePlatforms = getVisiblePlatforms(getDisplayPlatforms(release), platformFilter)

								return (
										<article
											key={`${release.id}-${release.releaseDate}`}
											className="group flex h-[442px] w-[168px] shrink-0 flex-col overflow-hidden rounded-md border border-border bg-[color-mix(in_srgb,var(--card)94%,var(--background))] shadow-[0_8px_22px_color-mix(in_srgb,var(--background)48%,transparent)] transition-colors hover:border-primary/60"
										>
											<div className="relative flex h-[220px] shrink-0 items-center justify-center overflow-hidden bg-background">
											{release.coverUrl ? (
												<img
													src={release.coverUrl}
													alt={release.name}
													loading="lazy"
													referrerPolicy="no-referrer"
													className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
												/>
											) : (
												<div className="flex h-full items-center justify-center">
													<Gamepad2 className="h-10 w-10 text-muted-foreground" />
												</div>
											)}
											<div className={cn('absolute right-2.5 top-2.5 z-30 rounded px-1.5 py-0.5 text-[10px] font-black uppercase shadow-sm', getDateBadgeClass(release.releaseDate))}>
												{dateLabel}
											</div>
											<div className="absolute bottom-3 right-3 z-30 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
												<Button asChild size="icon-sm" variant="ghost" title="Ver en IGDB" className="h-8 w-8 rounded-full bg-background/85 text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary">
													<a href={release.igdbUrl} target="_blank" rel="noreferrer">
														<ExternalLink className="h-3.5 w-3.5" />
													</a>
												</Button>
												<Button
													type="button"
													size="icon-sm"
													className="h-8 w-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary"
													onClick={() => void handleCreateThread(release)}
													disabled={creatingId !== null}
													title="Crear hilo con plantilla"
												>
													{isCreating ? (
														<Loader2 className="h-3.5 w-3.5 animate-spin" />
													) : (
														<MessageSquarePlus className="h-3.5 w-3.5" />
													)}
												</Button>
											</div>
										</div>
										<div className="flex min-h-0 flex-1 flex-col p-2.5">
											<h3 className="line-clamp-2 min-h-[36px] text-[14px] font-black leading-[18px] text-foreground">
												{release.name}
											</h3>
											<div className="mt-2 min-h-[86px]">
												<p className="mb-1 text-[10px] font-black uppercase text-muted-foreground">
													Plataformas
												</p>
												<div className="flex content-start flex-wrap gap-1.5">
													{visiblePlatforms.map(platform => (
														<span
															key={`${release.id}-${platform.kind}-${platform.label}`}
															title={platform.label}
															aria-label={platform.label}
															className={cn(
																'inline-flex max-w-full items-center truncate rounded border px-2 py-1 text-[10px] font-bold leading-none',
																getPlatformBadgeClass(platform)
															)}
														>
															<span className="truncate">{platform.label}</span>
														</span>
													))}
												</div>
											</div>
											<div className="mt-auto border-t border-border pt-2">
												<div className="flex items-center gap-2 rounded-md border border-border bg-background/55 px-2 py-1.5">
													<CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
													<div className="min-w-0">
														<p className="text-[9px] font-black uppercase leading-none text-muted-foreground">
															Lanzamiento
														</p>
														<p className="mt-0.5 text-[15px] font-black uppercase leading-none text-primary">
															{formatReleaseDate(release.releaseDate)}
														</p>
													</div>
												</div>
											</div>
										</div>
									</article>
								)
							})}
						</div>
					</div>
				) : layout === 'minimal' ? (
					<div className="overflow-x-auto bg-background/40 px-2.5 py-2">
						{renderPosterRail(true)}
					</div>
				) : null
			) : state.hasCredentials ? (
				<p className="px-4 py-5 text-center text-sm text-muted-foreground">
					No hay lanzamientos próximos para este filtro.
				</p>
			) : null}
		</section>
	)
}
