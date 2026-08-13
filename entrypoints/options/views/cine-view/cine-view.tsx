import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Film from 'lucide-react/dist/esm/icons/film'
import Images from 'lucide-react/dist/esm/icons/images'
import Star from 'lucide-react/dist/esm/icons/star'
import Trophy from 'lucide-react/dist/esm/icons/trophy'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { SimpleTooltip } from '@/components/ui/simple-tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MOVIE_REVIEW_BADGES, type MovieReviewBadge } from '@/features/cine/logic/movie-review'
import {
	countSharingPost,
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
import { MovieReviewTile } from './movie-review-tile'
import { MuralShareDialog } from './mural-share-dialog'

/** Below this a wall is not a wall, it is a poster with company. */
const MIN_MURAL_REVIEWS = 3

function StatCard({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
	return (
		<Card>
			<CardContent className="flex items-center gap-3 p-4">
				<div className="shrink-0 text-muted-foreground">{icon}</div>
				<div className="min-w-0">
					<p className="text-2xl font-bold leading-none tabular-nums">{value}</p>
					<p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
				</div>
			</CardContent>
		</Card>
	)
}

export function CineView() {
	const [records, setRecords] = useState<MovieReviewRecord[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [sortBy, setSortBy] = useState<MovieReviewSort>('recent')
	const [year, setYear] = useState('all')
	const [badge, setBadge] = useState<MovieReviewBadge | 'all'>('all')
	const [pendingDelete, setPendingDelete] = useState<MovieReviewRecord | null>(null)
	const [isSharingMural, setIsSharingMural] = useState(false)

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
	const visible = useMemo(
		() => sortMovieReviews(filterMovieReviews(published, { year, badge }), sortBy),
		[published, year, badge, sortBy]
	)

	const handleDelete = useCallback(async () => {
		if (!pendingDelete) return

		await deleteMovieReview(pendingDelete.imageId)
		setRecords(await getMovieReviews())
		toast.success('Crítica eliminada del registro')
		setPendingDelete(null)
	}, [pendingDelete])

	if (isLoading) {
		return <p className="p-6 text-sm text-muted-foreground">Cargando tus críticas…</p>
	}

	return (
		<div className="flex flex-col gap-6 p-6">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h1 className="text-2xl font-bold">Mis Críticas</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Las películas que has valorado con la card de crítica, con enlace al mensaje donde las publicaste.
					</p>
				</div>

				<SimpleTooltip
					content={
						published.length < MIN_MURAL_REVIEWS
							? `Necesitas al menos ${MIN_MURAL_REVIEWS} críticas publicadas`
							: 'Genera una imagen con tus pósters para pegarla en un hilo'
					}
				>
					<span>
						<Button
							variant="outline"
							onClick={() => setIsSharingMural(true)}
							disabled={published.length < MIN_MURAL_REVIEWS}
						>
							<Images className="mr-1.5 h-4 w-4" />
							Compartir mural
						</Button>
					</span>
				</SimpleTooltip>
			</div>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<StatCard icon={<Film className="h-5 w-5" />} value={String(stats.count)} label="Críticas publicadas" />
				<StatCard
					icon={<Star className="h-5 w-5" />}
					value={stats.averageRating === null ? '—' : stats.averageRating.toFixed(1)}
					label="Nota media"
				/>
				<StatCard
					icon={<Trophy className="h-5 w-5" />}
					value={stats.best ? stats.best.rating.toFixed(1) : '—'}
					label={stats.best ? stats.best.title : 'Mejor valorada'}
				/>
			</div>

			<Tabs defaultValue="published">
				<TabsList>
					<TabsTrigger value="published">Publicadas ({published.length})</TabsTrigger>
					<TabsTrigger value="pending">Sin publicar ({pending.length})</TabsTrigger>
				</TabsList>

				<TabsContent value="published" className="mt-4 flex flex-col gap-4">
					{published.length > 0 && (
						<div className="flex flex-wrap gap-2">
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
						</div>
					)}

					{visible.length === 0 ? (
						<EmptyState
							icon={Film}
							title={published.length === 0 ? 'Todavía no hay críticas publicadas' : 'Ningún resultado'}
							description={
								published.length === 0
									? 'Crea una crítica con la card desde el editor de Mediavida y publícala. Aparecerá aquí sola.'
									: 'Prueba a quitar algún filtro.'
							}
						/>
					) : (
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
							{visible.map(record => (
								<MovieReviewTile
									key={record.imageId}
									record={record}
									sharingPost={countSharingPost(published, record)}
									onDelete={setPendingDelete}
								/>
							))}
						</div>
					)}
				</TabsContent>

				<TabsContent value="pending" className="mt-4">
					{pending.length === 0 ? (
						<EmptyState
							icon={Film}
							title="No hay nada pendiente"
							description="Aquí aparecen las críticas que generaste pero nunca llegaste a publicar."
						/>
					) : (
						<div className="flex flex-col gap-4">
							<p className="text-sm text-muted-foreground">
								Generaste estas críticas pero no se han encontrado publicadas en ningún mensaje. Si las publicas, se
								moverán solas a la otra pestaña.
							</p>
							<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
								{pending.map(record => (
									<MovieReviewTile key={record.imageId} record={record} sharingPost={0} onDelete={setPendingDelete} />
								))}
							</div>
						</div>
					)}
				</TabsContent>
			</Tabs>

			<MuralShareDialog isOpen={isSharingMural} onClose={() => setIsSharingMural(false)} records={published} />

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
