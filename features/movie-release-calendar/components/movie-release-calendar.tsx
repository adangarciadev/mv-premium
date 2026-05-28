import { useEffect, useMemo, useRef, useState } from 'react'
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days'
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import Film from 'lucide-react/dist/esm/icons/film'
import Info from 'lucide-react/dist/esm/icons/info'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import MessageSquarePlus from 'lucide-react/dist/esm/icons/message-square-plus'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Z_INDEXES } from '@/constants'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { useSettingsStore } from '@/store/settings-store'
import type { GameReleaseCalendarLayout } from '@/store/settings-types'
import {
	getMovieThreadPrefillData,
	getUpcomingSpanishMovieReleases,
	hasTmdbApiKey,
	type UpcomingSpanishMovieRelease,
} from '@/services/api/tmdb'
import { CalendarLayoutControls } from '@/features/release-calendar/components/calendar-layout-controls'
import { saveReleaseThreadPrefill } from '@/features/release-calendar/logic/thread-prefill'

interface MovieReleaseCalendarState {
	releases: UpcomingSpanishMovieRelease[]
	loading: boolean
	error: string | null
	hasApiKey: boolean | null
}

type ReleaseFilter = 'all' | 'week' | 'fortnight'

const RELEASE_WINDOW_DAYS = 30
const MAX_RELEASES = 72
const LOADING_SKELETON_COUNT = 10
const RELEASE_FILTER_OPTIONS: Array<{ id: ReleaseFilter; label: string }> = [
	{ id: 'all', label: 'Todos' },
	{ id: 'week', label: '7 días' },
	{ id: 'fortnight', label: '14 días' },
]

function addDays(date: Date, days: number): Date {
	const next = new Date(date)
	next.setDate(next.getDate() + days)
	return next
}

function getDaysUntilRelease(dateString: string): number {
	const today = new Date()
	today.setHours(0, 0, 0, 0)
	const releaseDate = new Date(`${dateString}T00:00:00`)
	return Math.round((releaseDate.getTime() - today.getTime()) / 86_400_000)
}

function formatReleaseDate(dateString: string): string {
	const date = new Date(`${dateString}T00:00:00`)
	return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(date).replace('.', '')
}

function matchesReleaseFilter(release: UpcomingSpanishMovieRelease, filter: ReleaseFilter): boolean {
	if (filter === 'all') return true
	if (filter === 'week') return getDaysUntilRelease(release.releaseDate) <= 7
	if (filter === 'fortnight') return getDaysUntilRelease(release.releaseDate) <= 14
	return true
}

function formatRuntime(runtime: number | null | undefined): string | null {
	if (!runtime) return null
	return `${runtime} min.`
}

function getGenreSummary(release: UpcomingSpanishMovieRelease, maxGenres = 2): string | null {
	if (release.genres.length === 0) return null
	return release.genres.slice(0, maxGenres).join(', ')
}

function getDirectorLabel(release: UpcomingSpanishMovieRelease): string | null {
	if (!release.director) return null
	return `Dir. ${release.director}`
}

function getRereleaseLabel(release: UpcomingSpanishMovieRelease): string | null {
	if (!release.isRerelease) return null
	if (release.releaseNote && /anniversary|aniversario/i.test(release.releaseNote)) return 'Reestreno aniversario'
	return 'Reestreno'
}

function getMovieHoverTitle(release: UpcomingSpanishMovieRelease): string {
	const parts = [
		release.title,
		`Estreno: ${formatReleaseDate(release.releaseDate)}`,
		getRereleaseLabel(release),
		getGenreSummary(release, 3),
		getDirectorLabel(release),
		formatRuntime(release.runtime),
	].filter((part): part is string => Boolean(part))

	return parts.join('\n')
}

function MovieMetadataBlock({ release }: { release: UpcomingSpanishMovieRelease }) {
	const maxGenres = 2
	const genres = release.genres
	let visibleCount = Math.min(genres.length, maxGenres)
	let visibleGenres = genres.slice(0, visibleCount)
	let visibleText = visibleGenres.join(' · ')
	if (visibleCount === 2 && visibleText.length > 20) {
		visibleCount = 1
		visibleGenres = genres.slice(0, visibleCount)
		visibleText = visibleGenres.join(' · ')
	}
	const extraGenres = Math.max(genres.length - visibleCount, 0)
	const genreSummary = visibleGenres.length ? `${visibleText}${extraGenres > 0 ? ` · +${extraGenres}` : ''}` : null
	const director = release.director
	const runtime = formatRuntime(release.runtime)
	const rereleaseLabel = getRereleaseLabel(release)
	const genreValue = genreSummary
		? `${genreSummary}${rereleaseLabel ? ` · ${rereleaseLabel}` : ''}`
		: rereleaseLabel ?? '—'
	if (genres.length === 0 && !director && !runtime && !rereleaseLabel) return null

	const cleanRuntime = runtime ? runtime.replace(/min\.?|m/gi, '').trim() : null
	const metadataItems = [
		{ label: 'Dirección', value: director ?? '—', title: director ?? undefined },
		{ label: 'Duración', value: cleanRuntime ? `${cleanRuntime} minutos` : '—' },
		{ label: 'Género', value: genreValue, title: genreValue !== '—' ? genreValue : undefined },
	]

	return (
		<div className="mt-auto grid min-h-0 flex-1 content-end gap-2 pt-2 text-[11px] text-muted-foreground">
			{metadataItems.map(item => (
				<div key={item.label} className="flex min-w-0 flex-col leading-snug">
					<span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{item.label}</span>
					<span className="truncate font-semibold text-foreground" title={item.title}>
						{item.value}
					</span>
				</div>
			))}
		</div>
	)
}

export function MovieReleaseCalendar() {
	const railRef = useRef<HTMLDivElement | null>(null)
	const bottomBarRef = useRef<HTMLDivElement | null>(null)
	const previousBodyPaddingRef = useRef<string | null>(null)
	const [state, setState] = useState<MovieReleaseCalendarState>({
		releases: [],
		loading: true,
		error: null,
		hasApiKey: null,
	})
	const [creatingId, setCreatingId] = useState<number | null>(null)
	const [releaseFilter, setReleaseFilter] = useState<ReleaseFilter>('all')
	const [scrollState, setScrollState] = useState({ canScrollPrevious: false, canScrollNext: false })
	const savedLayout = useSettingsStore(state => state.movieReleaseCalendarLayout)
	const [layout, setLayout] = useState<GameReleaseCalendarLayout>(savedLayout)
	const setSetting = useSettingsStore(state => state.setSetting)

	const dateRange = useMemo(() => {
		const from = new Date()
		from.setHours(0, 0, 0, 0)
		return { from, to: addDays(from, RELEASE_WINDOW_DAYS) }
	}, [])

	async function loadReleases() {
		setState(prev => ({ ...prev, loading: true, error: null }))

		try {
			const hasKey = await hasTmdbApiKey()
			if (!hasKey) {
				setState({ releases: [], loading: false, error: null, hasApiKey: false })
				return
			}

			const releases = await getUpcomingSpanishMovieReleases({ ...dateRange, limit: MAX_RELEASES })
			setState({ releases, loading: false, error: null, hasApiKey: true })
		} catch (error) {
			logger.error('Movie release calendar: failed to load Spanish theatrical releases', error)
			setState(prev => ({
				...prev,
				loading: false,
				error: 'No se han podido cargar los próximos estrenos.',
				hasApiKey: prev.hasApiKey ?? true,
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

	const filteredReleases = useMemo(
		() =>
			state.releases
				.filter(release => matchesReleaseFilter(release, releaseFilter))
				.sort((a, b) => a.releaseTimestamp - b.releaseTimestamp || a.title.localeCompare(b.title, 'es')),
		[state.releases, releaseFilter]
	)

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

		railRef.current.scrollBy({
			left: direction === 'next' ? railRef.current.clientWidth : -railRef.current.clientWidth,
			behavior: 'smooth',
		})
		window.setTimeout(updateScrollState, 250)
	}

	function selectLayout(nextLayout: GameReleaseCalendarLayout) {
		setLayout(nextLayout)
		setSetting('movieReleaseCalendarLayout', nextLayout)
	}

	async function handleCreateThread(release: UpcomingSpanishMovieRelease) {
		if (creatingId !== null) return

		setCreatingId(release.id)
		try {
			const prefill = await getMovieThreadPrefillData(release.id)
			if (!prefill.body) throw new Error('Empty movie template')

			saveReleaseThreadPrefill({
				subforum: 'cine',
				title: prefill.title,
				body: prefill.body,
			})
			window.location.assign('/foro/cine/nuevo-hilo')
		} catch (error) {
			logger.error('Movie release calendar: failed to prepare thread prefill', error)
			setState(prev => ({
				...prev,
				error: 'No se ha podido preparar la plantilla del hilo.',
			}))
			setCreatingId(null)
		}
	}

	function renderPoster(release: UpcomingSpanishMovieRelease, iconClassName = 'h-8 w-8', imageClassName = '') {
		if (release.posterUrl) {
			return (
				<img
					src={release.posterUrl}
					alt={release.title}
					loading="lazy"
					referrerPolicy="no-referrer"
					className={cn('h-full w-full object-cover object-center', imageClassName)}
				/>
			)
		}

		return (
			<div className="flex h-full items-center justify-center text-muted-foreground">
				<CalendarDays className={iconClassName} aria-hidden="true" />
			</div>
		)
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
			<div className={cn('flex min-w-max', showActions ? 'gap-2.5' : 'gap-2')}>
				{filteredReleases.map(release => {
					const isCreating = creatingId === release.id
					const title = getMovieHoverTitle(release)

					return (
						<article
							key={`${release.id}-${release.releaseDate}`}
							title={title}
							className={cn(cardClass, 'focus-within:border-primary/70')}
						>
							<div className={posterClass}>
								{renderPoster(release, 'h-4 w-4')}
								{showActions ? (
									<div className="absolute inset-x-1 bottom-1 flex justify-end gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
										<button
											type="button"
											title="Crear hilo con plantilla"
											aria-label={`Crear hilo de ${release.title}`}
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
							<span className={dateClass}>{formatReleaseDate(release.releaseDate)}</span>
						</article>
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

		return (
			<div className={cn('flex min-w-max', showActions ? 'gap-2.5' : 'gap-2')} aria-hidden="true">
				{Array.from({ length: LOADING_SKELETON_COUNT }, (_, index) => (
					<div key={index} className={cardClass}>
						<div className={posterClass} />
						<div className="border-t border-border pt-1.5">
							<div className="mx-auto h-3 w-12 rounded-full bg-primary/20" />
						</div>
					</div>
				))}
			</div>
		)
	}

	function renderShowcaseSkeleton() {
		return (
			<div className="flex items-start gap-3">
				{Array.from({ length: 6 }).map((_, i) => (
					<div
						key={i}
						className="flex h-[468px] w-[168px] shrink-0 flex-col overflow-hidden rounded-md border border-border/50 bg-card shadow-sm"
					>
						<div className="relative h-[220px] w-full shrink-0 bg-[linear-gradient(110deg,color-mix(in_srgb,var(--muted)78%,transparent)_8%,color-mix(in_srgb,var(--foreground)14%,transparent)_18%,color-mix(in_srgb,var(--muted)78%,transparent)_33%)] bg-[length:200%_100%] animate-[release-calendar-shimmer_1.15s_linear_infinite]" />
						<div className="flex flex-1 flex-col p-2.5">
							<div className="h-4 w-3/4 animate-pulse rounded bg-muted/60" />
							<div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-muted/40" />
							<div className="mt-5 h-2.5 w-20 animate-pulse rounded bg-muted/40" />
							<div className="mt-auto border-t border-border pt-2">
								<div className="h-11 rounded-md border border-border bg-background/55" />
							</div>
						</div>
					</div>
				))}
			</div>
		)
	}

	const layoutControls = <CalendarLayoutControls layout={layout} onChange={selectLayout} />

	const filterControls = (
		<div className="flex max-w-full gap-1 overflow-x-auto rounded-md bg-muted p-1">
			{RELEASE_FILTER_OPTIONS.map(filter => (
				<button
					key={filter.id}
					type="button"
					onClick={() => setReleaseFilter(filter.id)}
					aria-pressed={releaseFilter === filter.id}
					className={cn(
						'h-8 shrink-0 rounded px-2.5 text-[12px] font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
						releaseFilter === filter.id && 'bg-primary text-primary-foreground shadow-sm hover:text-primary-foreground'
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
			title="Actualizar estrenos"
			onClick={() => void loadReleases()}
			disabled={state.loading}
			className="h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
		>
			{state.loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
		</Button>
	)

	const releaseInfo = (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-primary/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
					title="Origen de los estrenos"
					aria-label="Origen de los estrenos"
				>
					<Info className="h-3.5 w-3.5" aria-hidden="true" />
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" sideOffset={8} className="w-80 p-3 text-xs leading-relaxed">
				<div className="space-y-2">
					<p className="text-sm font-black text-foreground">Origen de los estrenos</p>
					<p className="text-muted-foreground">
						Los datos salen de TMDB, filtrando estrenos de cine en España durante los próximos {RELEASE_WINDOW_DAYS}{' '}
						días.
					</p>
					<p className="text-muted-foreground">
						La extensión confirma la fecha local con los datos de estreno de TMDB. Los reestrenos solo aparecerán si
						TMDB los incluye en el rango y conserva una fecha española dentro del periodo.
					</p>
					<p className="text-muted-foreground">
						Las fechas pueden estar incompletas o ser inexactas. Para contrastar la cartelera española, revisa{' '}
						<a
							href="https://www.filmaffinity.com/es/rdcat.php?id=upc_th_es"
							target="_blank"
							rel="noreferrer"
							className="font-bold text-primary underline-offset-2 hover:underline"
						>
							los próximos estrenos en FilmAffinity
						</a>
						.
					</p>
				</div>
			</PopoverContent>
		</Popover>
	)

	const releaseCountLabel = state.loading ? 'Buscando...' : `${filteredReleases.length} estrenos`

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
							<Film className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
							<div className="flex min-w-0 items-baseline gap-2">
								<p className="truncate text-[12px] font-black uppercase leading-none text-foreground">
									Próximos estrenos
								</p>
								{releaseInfo}
								<p className="shrink-0 text-[11px] font-black leading-none text-primary">{releaseCountLabel}</p>
							</div>
						</div>

						<div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
							<div className="max-w-full">{filterControls}</div>
							{layoutControls}
							{navigationControls}
							{refreshControl}
						</div>
					</div>

					<div ref={railRef} className="w-full overflow-x-auto">
						{state.loading ? (
							<div className="relative overflow-hidden rounded-md border border-border/70 bg-background/35 px-2.5 py-2">
								<div className="mb-2 flex items-center gap-2 px-0.5 text-[11px] font-bold text-muted-foreground">
									<Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
									<span>Cargando próximos estrenos...</span>
								</div>
								<div className="overflow-hidden">{renderPosterRailSkeleton(true)}</div>
							</div>
						) : filteredReleases.length > 0 ? (
							renderPosterRail(true)
						) : state.hasApiKey ? (
							<p className="py-5 text-sm text-muted-foreground">No hay estrenos próximos para este filtro.</p>
						) : null}
					</div>
				</div>

				{state.hasApiKey === false ? (
					<p className="mt-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
						TMDB no está configurado en la extensión.
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
		<section className="mb-3 overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-sm">
			<style>
				{'@keyframes release-calendar-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}'}
			</style>
			<div className="space-y-2 border-b border-border px-3 py-3">
				<div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
					<div className="flex min-w-[240px] flex-1 flex-wrap items-center gap-2.5 gap-y-1">
						<Film className="h-5 w-5 shrink-0 text-primary" />
						<h2 className="whitespace-nowrap text-[16px] font-black uppercase leading-none text-foreground">
							Próximos estrenos
						</h2>
						{releaseInfo}
						<span className="hidden whitespace-nowrap rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-bold text-muted-foreground sm:inline-flex">
							Cine en España · {RELEASE_WINDOW_DAYS} días
						</span>
						{filteredReleases.length > 0 ? (
							<span className="inline-flex shrink-0 whitespace-nowrap rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-black text-primary">
								{filteredReleases.length} estrenos
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
					{filterControls}
					<span className="shrink-0 text-[11px] font-semibold text-muted-foreground sm:hidden">
						{RELEASE_WINDOW_DAYS} días
					</span>
				</div>
			</div>

			{state.hasApiKey === false ? (
				<p className="m-3 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
					TMDB no está configurado en la extensión.
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
							<span>Cargando próximos estrenos...</span>
						</div>
						{renderShowcaseSkeleton()}
					</div>
				) : (
					<div className="overflow-hidden bg-background/40 px-2.5 py-2">
						<div className="mb-2 flex items-center gap-2 px-0.5 text-xs font-bold text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
							<span>Cargando próximos estrenos...</span>
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

								return (
									<article
										key={`${release.id}-${release.releaseDate}`}
										title={getMovieHoverTitle(release)}
										className="group flex h-[468px] w-[168px] shrink-0 flex-col overflow-hidden rounded-md border border-border/60 bg-[color-mix(in_srgb,var(--card)96%,var(--background))] shadow-[0_8px_22px_color-mix(in_srgb,var(--background)48%,transparent)] transition-colors hover:border-primary/60 focus-within:border-primary/60"
									>
										<div className="relative flex h-[220px] w-full shrink-0 items-center justify-center overflow-hidden bg-[color-mix(in_srgb,var(--background)80%,var(--muted))]">
											{renderPoster(release, 'h-8 w-8', 'transition-transform duration-500 group-hover:scale-[1.03]')}

											<div className="absolute bottom-3 right-3 z-30 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
												<Button
													type="button"
													size="icon-sm"
													className="h-8 w-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary"
													onClick={() => void handleCreateThread(release)}
													disabled={creatingId !== null}
													title="Crear hilo con plantilla"
													aria-label={`Crear hilo de ${release.title}`}
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
											<div className="mb-3.5 flex min-h-[54px] items-start border-b border-border/70 pb-3">
												<h3 className="line-clamp-2 break-words text-[15px] font-bold leading-[18px] [color:color-mix(in_srgb,var(--foreground)76%,var(--primary))] [font-family:Georgia,'Times_New_Roman',serif] ">
													{release.title}
												</h3>
											</div>
											<MovieMetadataBlock release={release} />
											<div className="mt-3 border-t border-border pt-2">
												<div className="flex items-center gap-2 rounded-md border border-border bg-background/55 px-2 py-1.5">
													<CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
													<div className="min-w-0">
														<p className="text-[9px] font-black uppercase leading-none text-muted-foreground">
															Estreno
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
				) : (
					<div className="overflow-x-auto bg-background/40 px-2.5 py-2">{renderPosterRail(true)}</div>
				)
			) : state.hasApiKey ? (
				<p className="px-4 py-5 text-center text-sm text-muted-foreground">
					No hay estrenos próximos para este filtro.
				</p>
			) : null}
		</section>
	)
}
