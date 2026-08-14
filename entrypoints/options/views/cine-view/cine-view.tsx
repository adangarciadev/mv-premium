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
	filterMovieReviews,
	getAvailableYears,
	getMovieReviewStats,
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
import { CineHero } from './cine-hero'
import { CineSkeleton } from './cine-skeleton'
import { MovieReviewTile } from './movie-review-tile'
import { RecapShareDialog } from './recap-share-dialog'

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
	const [pendingDelete, setPendingDelete] = useState<MovieReviewRecord | null>(null)
	const [isSharingRecap, setIsSharingRecap] = useState(false)

	useEffect(() => {
		let mounted = true

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
	const stats = useMemo(() => getMovieReviewStats(published), [published])
	const years = useMemo(() => getAvailableYears(published), [published])
	// Best rated first, so the films you rate highest are the ones colouring the backdrop.
	const heroPosterUrls = useMemo(
		() =>
			sortMovieReviews(published, 'rating')
				.map(record => record.posterUrl)
				.filter((url): url is string => url !== null)
				.slice(0, HERO_POSTER_COUNT),
		[published]
	)
	const visible = useMemo(
		() => sortMovieReviews(filterMovieReviews(published, { year, badge }), sortBy),
		[published, year, badge, sortBy]
	)

	const isFiltered = year !== 'all' || badge !== 'all'

	const clearFilters = useCallback(() => {
		setYear('all')
		setBadge('all')
	}, [])

	const handleDelete = useCallback(async () => {
		if (!pendingDelete) return

		await deleteMovieReview(pendingDelete.imageId)
		setRecords(await getMovieReviews())
		toast.success('Crítica eliminada del registro')
		setPendingDelete(null)
	}, [pendingDelete])

	if (isLoading) {
		return <CineSkeleton />
	}

	return (
		<div className="flex flex-col gap-6">
			<CineHero
				stats={stats}
				posterUrls={heroPosterUrls}
				onShare={() => setIsSharingRecap(true)}
				minRecapReviews={MIN_RECAP_REVIEWS}
			/>

			<Tabs defaultValue="published" className="reveal reveal-d2">
				<TabsList>
					<TabsTrigger value="published">Publicadas ({published.length})</TabsTrigger>
					<TabsTrigger value="pending">Sin publicar ({pending.length})</TabsTrigger>
				</TabsList>

				<TabsContent value="published" className={TAB_PANEL}>
					<div className={TAB_PANEL_INNER}>
						{published.length > 0 && (
							<div className="flex flex-wrap items-center gap-2">
								<Select value={sortBy} onValueChange={value => setSortBy(value as MovieReviewSort)}>
									<SelectTrigger className="w-44">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
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
									<SelectContent>
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
									<SelectContent>
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

								<p aria-live="polite" className="font-data ml-auto text-xs text-muted-foreground">
									{isFiltered ? `${visible.length} de ${published.length}` : `${published.length} películas`}
								</p>
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
							<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
								{visible.map(record => (
									<MovieReviewTile key={record.imageId} record={record} onDelete={setPendingDelete} />
								))}
							</div>
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
								<p className="max-w-[65ch] text-sm text-muted-foreground">
									Generaste estas críticas pero no se han encontrado publicadas en ningún mensaje. Si las publicas, se
									moverán solas a la otra pestaña.
								</p>
								<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
									{pending.map(record => (
										<MovieReviewTile key={record.imageId} record={record} onDelete={setPendingDelete} />
									))}
								</div>
							</>
						)}
					</div>
				</TabsContent>
			</Tabs>

			<RecapShareDialog isOpen={isSharingRecap} onClose={() => setIsSharingRecap(false)} records={published} />

			<ConfirmDialog
				open={pendingDelete !== null}
				onOpenChange={open => !open && setPendingDelete(null)}
				title="¿Eliminar esta crítica del registro?"
				description={`Se quitará "${pendingDelete?.title ?? ''}" de tu registro. El mensaje en Mediavida no se toca.`}
				confirmText="Eliminar"
				variant="destructive"
				onConfirm={() => void handleDelete()}
			/>
		</div>
	)
}
