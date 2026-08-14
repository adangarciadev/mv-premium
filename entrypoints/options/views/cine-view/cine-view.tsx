import { useCallback, useEffect, useMemo, useState } from 'react'
import Film from 'lucide-react/dist/esm/icons/film'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MOVIE_REVIEW_BADGES, type MovieReviewBadge } from '@/features/cine/logic/movie-review'
import {
	countUniqueMovies,
	filterMovieReviews,
	getAvailableYears,
	getDistinctPosterUrls,
	getMovieReviewStats,
	getMovieViewings,
	sortMovieReviews,
	splitByPublication,
	type MovieReviewSort,
} from '@/features/cine/logic/movie-review-list'
import {
	deleteMovieReview,
	getMovieReviews,
	watchMovieReviews,
	type MovieReviewRecord,
} from '@/features/cine/logic/movie-review-store'
import {
	getMovieReviewView,
	setMovieReviewView,
	type MovieReviewView,
} from '@/features/cine/logic/movie-review-view'
import {
	getTotalRuntime,
	resolveMovieRuntimes,
	type MovieRuntimes,
} from '@/features/cine/logic/movie-runtime-cache'
import { CineHero } from './cine-hero'
import { CineSkeleton } from './cine-skeleton'
import { InfoPill } from './info-pill'
import { MovieReviewCollection } from './movie-review-collection'
import { RecapShareDialog } from './recap-share-dialog'
import { ViewModeToggle } from './view-mode-toggle'

/** Below this there is no distribution to show, only three bars and a podium of everything. */
const MIN_RECAP_REVIEWS = 3

/**
 * Radix always renders the panel element and only marks the inactive one with `hidden`, which the
 * UA stylesheet turns into `display: none`. Any author class declaring `display` beats that, so a
 * `flex` here would leave the inactive panel generating a box, and its margin plus the root's gap
 * would push the active panel down. Layout classes go on the inner wrapper instead.
 */
const TAB_PANEL = 'mt-4 flex-none'
const TAB_PANEL_INNER = 'flex flex-col gap-4'

/** The empty states share one floor, so their different copy lengths cannot diverge either. */
const EMPTY_STATE_HEIGHT = 'min-h-[26rem]'

/** Enough slices to read as a wall at full width; beyond this each one is too thin to tell apart. */
const HERO_POSTER_COUNT = 14

export function CineView() {
	const [records, setRecords] = useState<MovieReviewRecord[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [sortBy, setSortBy] = useState<MovieReviewSort>('recent')
	const [year, setYear] = useState('all')
	const [badge, setBadge] = useState<MovieReviewBadge | 'all'>('all')
	/** Everything the pending confirmation would remove: one review, or every review of a film. */
	const [pendingDelete, setPendingDelete] = useState<MovieReviewRecord[] | null>(null)
	const [isSharingRecap, setIsSharingRecap] = useState(false)
	const [view, setView] = useState<MovieReviewView>('gallery')
	const [runtimes, setRuntimes] = useState<MovieRuntimes | null>(null)

	const changeView = useCallback((next: MovieReviewView) => {
		setView(next)
		void setMovieReviewView(next)
	}, [])

	useEffect(() => {
		let mounted = true

		void getMovieReviewView().then(stored => {
			if (mounted) setView(stored)
		})

		void getMovieReviews().then(data => {
			if (!mounted) return
			setRecords(data)
			setIsLoading(false)
		})

		const unwatch = watchMovieReviews(next => {
			setRecords(next)
			setIsLoading(false)
		})

		return () => {
			mounted = false
			unwatch()
		}
	}, [])

	const { published, pending } = useMemo(() => splitByPublication(records), [records])

	/**
	 * The runtimes arrive after the rest of the page, and only the first time: they are cached by
	 * film id, so a second visit resolves from storage without a single request.
	 */
	const publishedIds = useMemo(() => published.map(record => record.tmdbId), [published])

	useEffect(() => {
		if (publishedIds.length === 0) return
		let cancelled = false

		void resolveMovieRuntimes(publishedIds).then(next => {
			if (!cancelled) setRuntimes(next)
		})

		return () => {
			cancelled = true
		}
	}, [publishedIds])

	const runtimeMinutes = useMemo(
		() => (runtimes === null ? null : getTotalRuntime(published, runtimes)),
		[published, runtimes]
	)
	const stats = useMemo(() => getMovieReviewStats(published), [published])
	const years = useMemo(() => getAvailableYears(published), [published])
	// Best rated first, so the films you rate highest are the ones colouring the backdrop.
	const heroPosterUrls = useMemo(() => getDistinctPosterUrls(published, HERO_POSTER_COUNT), [published])
	const uniqueMovieCount = useMemo(() => countUniqueMovies(published), [published])
	// Over every record, published or not, and never over the filtered view: "2ª vez" is a fact
	// about how many times you sat through the film, so a year filter must not renumber it and an
	// unpublished card still counts as a viewing.
	const viewings = useMemo(() => getMovieViewings(records), [records])
	const visible = useMemo(
		() => sortMovieReviews(filterMovieReviews(published, { year, badge }), sortBy),
		[published, year, badge, sortBy]
	)

	const isFiltered = year !== 'all' || badge !== 'all'

	/**
	 * Each mode counts its own unit, because each shows a different number of things: Galería puts
	 * one card per film, Diario one row per review. A single figure would be wrong in one of them.
	 */
	const tally = useMemo(() => {
		const noun = view === 'gallery' ? 'películas' : 'críticas'
		const shown = view === 'gallery' ? countUniqueMovies(visible) : visible.length
		const total = view === 'gallery' ? uniqueMovieCount : published.length

		return isFiltered ? `${shown} de ${total}` : `${total} ${noun}`
	}, [isFiltered, published.length, uniqueMovieCount, view, visible])

	const clearFilters = useCallback(() => {
		setYear('all')
		setBadge('all')
	}, [])

	const handleDelete = useCallback(async () => {
		if (!pendingDelete) return

		for (const record of pendingDelete) {
			await deleteMovieReview(record.imageId)
		}

		setRecords(await getMovieReviews())
		toast.success(pendingDelete.length === 1 ? 'Crítica eliminada del registro' : 'Críticas eliminadas del registro')
		setPendingDelete(null)
	}, [pendingDelete])

	if (isLoading) {
		return <CineSkeleton />
	}

	return (
		<div className="flex flex-col gap-6">
			<CineHero
				stats={stats}
				movieCount={uniqueMovieCount}
				runtimeMinutes={runtimeMinutes}
				posterUrls={heroPosterUrls}
				onShare={() => setIsSharingRecap(true)}
				minRecapReviews={MIN_RECAP_REVIEWS}
			/>

			<Tabs defaultValue="published" className="reveal reveal-d2">
				<div className="flex items-center gap-2">
					<TabsList>
						<TabsTrigger value="published">Publicadas ({published.length})</TabsTrigger>
						<TabsTrigger value="pending">Sin publicar ({pending.length})</TabsTrigger>
					</TabsList>
					<InfoPill title="Cómo se publica una crítica">
						<p>
							Una crítica pasa sola a <strong className="font-semibold text-foreground">Publicadas</strong> cuando la
							extensión encuentra su imagen dentro de un mensaje tuyo. No hay nada que marcar a mano, y las que se
							quedan sin publicar no cuentan para ninguna de tus cifras.
						</p>
						<p className="mt-2">
							El enlace de la imagen se guarda desde que la generas, así que{' '}
							<strong className="font-semibold text-foreground">nunca se pierde</strong>: en Sin publicar, pasa por
							encima de una crítica y usa el botón de copiar para llevarte su BBCode. Al pegarlo en un mensaje, pasará
							sola a Publicadas.
						</p>
						<p className="mt-2">
							Si alguna se quedó por el camino, bórrala sin miedo: no cuenta para tus cifras y borrarla no deja rastro.
						</p>
						<p className="mt-2">
							Y si ya tenías cards publicadas antes de instalar la extensión, el botón con forma de estrella que aparece
							sobre ellas en el foro las añade a tu registro.
						</p>
					</InfoPill>
				</div>

				<TabsContent value="published" className={TAB_PANEL}>
					<div className={TAB_PANEL_INNER}>
						{published.length > 0 && (
							<div className="flex flex-wrap items-center gap-2">
								<Select value={sortBy} onValueChange={value => setSortBy(value as MovieReviewSort)}>
									<SelectTrigger className="w-44">
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="max-h-72">
										<SelectItem value="recent">Más recientes</SelectItem>
										<SelectItem value="oldest">Más antiguas</SelectItem>
										<SelectItem value="rating">Mejor valoradas</SelectItem>
										<SelectItem value="title">Por título</SelectItem>
									</SelectContent>
								</Select>

								<Select value={year} onValueChange={setYear}>
									<SelectTrigger className="w-36">
										<SelectValue placeholder="Año" />
									</SelectTrigger>
									<SelectContent className="max-h-72">
										<SelectItem value="all">Todos los años</SelectItem>
										{years.map(option => (
											<SelectItem key={option} value={option}>
												{option}
											</SelectItem>
										))}
									</SelectContent>
								</Select>

								<Select value={badge} onValueChange={value => setBadge(value as MovieReviewBadge | 'all')}>
									<SelectTrigger className="w-52">
										<SelectValue placeholder="Veredicto" />
									</SelectTrigger>
									<SelectContent className="max-h-72">
										<SelectItem value="all">Todos los veredictos</SelectItem>
										{MOVIE_REVIEW_BADGES.map(option => (
											<SelectItem key={option.id} value={option.id}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>

								{isFiltered && (
									<Button variant="ghost" size="sm" onClick={clearFilters}>
										Quitar filtros
									</Button>
								)}

								<InfoPill title="Ordenar y filtrar">
									El año es el de <strong className="font-semibold text-foreground">estreno de la película</strong>, no el
									de tu crítica. El veredicto es la etiqueta que confirmaste al crear la card, y la extensión te sugiere
									una a partir de la nota.
								</InfoPill>

								<div className="ml-auto flex items-center gap-2">
									<p aria-live="polite" className="font-data text-xs text-muted-foreground">
										{tally}
									</p>
									<ViewModeToggle value={view} onChange={changeView} />
									<InfoPill title="Galería y Diario" side="left">
										<strong className="font-semibold text-foreground">Galería</strong> enseña los carteles grandes, para
										recorrer tu colección. <strong className="font-semibold text-foreground">Diario</strong> los pone en
										filas con las notas alineadas, para encontrar y comparar. Los filtros funcionan igual en los dos.
									</InfoPill>
								</div>
							</div>
						)}

						{visible.length === 0 ? (
							<EmptyState
								className={EMPTY_STATE_HEIGHT}
								icon={Film}
								title={published.length === 0 ? 'Todavía no hay críticas publicadas' : 'Ningún resultado'}
								description={
									published.length === 0
										? 'Crea una crítica con la card desde el editor de Mediavida y publícala. Aparecerá aquí sola.'
										: 'Prueba a quitar algún filtro.'
								}
								action={
									published.length > 0 ? (
										<Button variant="outline" onClick={clearFilters}>
											Quitar filtros
										</Button>
									) : undefined
								}
							/>
						) : (
							<MovieReviewCollection
								records={visible}
								view={view}
								viewings={viewings}
								onDelete={setPendingDelete}
							/>
						)}
					</div>
				</TabsContent>

				<TabsContent value="pending" className={TAB_PANEL}>
					<div className={TAB_PANEL_INNER}>
						{pending.length === 0 ? (
							<EmptyState
								className={EMPTY_STATE_HEIGHT}
								icon={Film}
								title="No hay nada pendiente"
								description="Aquí aparecen las críticas que generaste pero nunca llegaste a publicar."
							/>
						) : (
							<>
								<MovieReviewCollection
									records={pending}
									view={view}
									viewings={viewings}
									onDelete={setPendingDelete}
								/>
							</>
						)}
					</div>
				</TabsContent>
			</Tabs>

			<RecapShareDialog isOpen={isSharingRecap} onClose={() => setIsSharingRecap(false)} records={published} />

			{/* Galería deletes the whole film, so the dialog says how many reviews it takes with it. */}
			<ConfirmDialog
				open={pendingDelete !== null}
				onOpenChange={open => !open && setPendingDelete(null)}
				title={pendingDelete && pendingDelete.length > 1 ? '¿Eliminar esta película del registro?' : '¿Eliminar esta crítica del registro?'}
				description={
					pendingDelete && pendingDelete.length > 1
						? `Se quitarán las ${pendingDelete.length} críticas de "${pendingDelete[0].title}" de tu registro. Los mensajes en Mediavida no se tocan.`
						: `Se quitará "${pendingDelete?.[0]?.title ?? ''}" de tu registro. El mensaje en Mediavida no se toca.`
				}
				confirmText="Eliminar"
				variant="destructive"
				onConfirm={() => void handleDelete()}
			/>
		</div>
	)
}
