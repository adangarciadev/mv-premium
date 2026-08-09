import { useEffect, useMemo, useState } from 'react'
import Film from 'lucide-react/dist/esm/icons/film'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Search from 'lucide-react/dist/esm/icons/search'
import Quote from 'lucide-react/dist/esm/icons/quote'
import Send from 'lucide-react/dist/esm/icons/send'
import { useDebounce } from 'use-debounce'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { MediaResultItem } from '@/components/media-search-dialog/media-result-item'
import { useMovieSearch, useMovieTemplateData } from '@/features/cine/hooks/use-tmdb'
import { getPosterUrl, type TMDBMovie } from '@/services/api/tmdb'
import { getCurrentUser, type CurrentUser } from '@/entrypoints/options/lib/current-user'
import { uploadImage } from '@/services/api/imgbb'
import { createMovieReviewImage } from '@/features/cine/logic/movie-review-image'
import {
	MOVIE_REVIEW_BADGES,
	MOVIE_REVIEW_QUOTE_MAX_LENGTH,
	type MovieReviewBadge,
	type MovieReviewCardData,
} from '@/features/cine/logic/movie-review'
import { MovieRatingPicker } from './movie-rating-picker'

interface MovieReviewDialogProps {
	isOpen: boolean
	onClose: () => void
	onInsert: (bbcode: string) => void
}

function MovieSearchSkeletons() {
	return (
		<div className="grid gap-2 p-1 sm:grid-cols-2" aria-label="Buscando películas">
			{Array.from({ length: 6 }, (_, index) => (
				<div key={index} className="flex h-[82px] items-center gap-3 rounded-lg px-3 py-2">
					<div className="h-16 w-11 shrink-0 animate-pulse rounded bg-muted/70" />
					<div className="min-w-0 flex-1 space-y-2">
						<div className="h-3.5 w-3/4 animate-pulse rounded bg-muted/70" />
						<div className="h-3 w-1/3 animate-pulse rounded bg-muted/45" />
					</div>
				</div>
			))}
		</div>
	)
}

export function MovieReviewDialog({ isOpen, onClose, onInsert }: MovieReviewDialogProps) {
	const [query, setQuery] = useState('')
	const [debouncedQuery] = useDebounce(query, 300)
	const [selected, setSelected] = useState<TMDBMovie | null>(null)
	const [rating, setRating] = useState<number | null>(null)
	const [quote, setQuote] = useState('')
	const [badge, setBadge] = useState<MovieReviewBadge | null>(null)
	const [user, setUser] = useState<CurrentUser | null>(null)
	const [previewUrl, setPreviewUrl] = useState<string | null>(null)
	const [previewError, setPreviewError] = useState<string | null>(null)
	const [isPreviewGenerating, setIsPreviewGenerating] = useState(false)
	const [isGenerating, setIsGenerating] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [retainedResults, setRetainedResults] = useState<TMDBMovie[]>([])
	const [retainedSearchKey, setRetainedSearchKey] = useState<string | null>(null)
	const search = useMovieSearch(debouncedQuery, isOpen && !selected)
	const details = useMovieTemplateData(selected?.id ?? 0, isOpen && !!selected)
	const selectMovie = (movie: TMDBMovie) => {
		setSelected(movie)
		setRating(null)
		setBadge(null)
		setQuote('')
	}
	const normalizedQuery = query.trim()
	const normalizedDebouncedQuery = debouncedQuery.trim()
	const isSearchReady = normalizedQuery.length >= 2 && normalizedQuery === normalizedDebouncedQuery
	const expectedSearchKey = `tmdb:search:${debouncedQuery}`
	const hasRetainedResults = retainedResults.length > 0
	const isCurrentQueryResolved = isSearchReady && retainedSearchKey === expectedSearchKey
	const currentSearchError = isSearchReady ? search.error : null
	const isUpdatingSearch = normalizedQuery.length >= 2 && hasRetainedResults && (!isCurrentQueryResolved || search.isLoading)
	const isFirstSearchLoading = normalizedQuery.length >= 2 && !hasRetainedResults && (!isCurrentQueryResolved || search.isLoading)
	const isSettledEmpty = normalizedQuery.length >= 2 && isCurrentQueryResolved && !search.isLoading && !hasRetainedResults && !currentSearchError

	const handleSearchQueryChange = (value: string) => {
		setQuery(value)
		if (value.trim().length === 0) {
			setRetainedResults([])
			setRetainedSearchKey(null)
		}
	}

	useEffect(() => {
		if (search.resolvedKey === expectedSearchKey && search.data) {
			setRetainedResults(search.data.results.slice(0, 10))
			setRetainedSearchKey(search.resolvedKey)
		}
	}, [expectedSearchKey, search.data, search.resolvedKey])

	useEffect(() => {
		if (isOpen) void getCurrentUser().then(setUser)
	}, [isOpen])
	useEffect(() => {
		if (!isOpen) {
			setSelected(null)
			setQuery('')
			setQuote('')
			setRating(null)
			setBadge(null)
			setError(null)
			setRetainedResults([])
			setRetainedSearchKey(null)
		}
	}, [isOpen])

	const cardData = useMemo<MovieReviewCardData | null>(
		() =>
			details.data
				? {
						title: details.data.title,
						director: details.data.director,
						year: details.data.year,
						genres: details.data.genres,
						posterUrl: details.data.posterUrl,
						backdropUrl: details.data.backdropUrl,
						rating,
						quote,
						badge,
						username: user?.username || 'Usuario',
						avatarUrl: user?.avatarUrl,
					}
				: null,
		[badge, details.data, quote, rating, user]
	)

	useEffect(() => {
		if (!cardData) return
		let cancelled = false
		let objectUrl: string | null = null
		setIsPreviewGenerating(true)
		setPreviewError(null)
		const timer = window.setTimeout(() => {
			void createMovieReviewImage(cardData)
				.then(blob => {
					if (cancelled) return
					objectUrl = URL.createObjectURL(blob)
					setPreviewUrl(previous => {
						if (previous) URL.revokeObjectURL(previous)
						return objectUrl
					})
				})
				.catch(cause => {
					if (!cancelled) setPreviewError(cause instanceof Error ? cause.message : 'No se pudo generar la vista previa')
				})
				.finally(() => {
					if (!cancelled) setIsPreviewGenerating(false)
				})
		}, 180)
		return () => {
			cancelled = true
			window.clearTimeout(timer)
			if (objectUrl && cancelled) URL.revokeObjectURL(objectUrl)
		}
	}, [cardData])

	const handleInsert = async () => {
		if (!cardData || rating === null) return
		setIsGenerating(true)
		setError(null)
		try {
			const blob = await createMovieReviewImage(cardData)
			const result = await uploadImage(blob)
			if (!result.success || !result.url) throw new Error(result.error || 'No se pudo subir la card')
			onInsert(`[img]${result.url}[/img]\n\n`)
			onClose()
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'No se pudo generar la crítica visual')
		} finally {
			setIsGenerating(false)
		}
	}

	return (
		<Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
			<DialogContent
				className={cn(
					'w-[calc(100vw-1rem)] p-0 transition-[max-width,height] duration-200',
					selected
						? 'max-h-[92vh] max-w-6xl overflow-y-auto'
						: 'flex h-[620px] max-h-[90vh] max-w-[820px] flex-col overflow-hidden'
				)}
			>
				<DialogHeader className="border-b px-5 py-4 text-left">
					<DialogTitle>Crear crítica visual</DialogTitle>
					<DialogDescription>
						{selected
							? 'Tu valoración personal convertida en una card cinematográfica.'
							: 'Elige la película que acabas de ver.'}
					</DialogDescription>
				</DialogHeader>
				{!selected ? (
					<div className="flex min-h-0 flex-1 flex-col p-5">
						<label className="mb-2 text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground" htmlFor="movie-review-search">
							Buscar película por título
						</label>
						<div className="relative mb-4 shrink-0">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								id="movie-review-search"
								value={query}
								onChange={event => handleSearchQueryChange(event.target.value)}
								placeholder="Buscar película por título..."
								className="h-11 pl-9 pr-10"
								autoFocus
							/>
							{search.isLoading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />}
						</div>

						<div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border/60 bg-muted/[0.08]">
							{isUpdatingSearch && !currentSearchError && (
								<div className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
									<Loader2 className="h-3 w-3 animate-spin text-primary" /> Actualizando...
								</div>
							)}

							{currentSearchError ? (
								<div className="flex h-full flex-col items-center justify-center px-8 text-center">
									<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
										<Search className="h-5 w-5 text-destructive" />
									</div>
									<p className="m-0 text-sm font-semibold text-foreground">No se pudo completar la búsqueda</p>
									<p className="mt-1 max-w-md text-xs text-muted-foreground">{currentSearchError.message}</p>
								</div>
							) : isFirstSearchLoading ? (
								<MovieSearchSkeletons />
							) : normalizedQuery.length < 2 ? (
								<div className="flex h-full flex-col items-center justify-center px-8 text-center">
									<div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted/50">
										<Search className="h-5 w-5 text-muted-foreground" />
									</div>
									<p className="m-0 text-sm font-semibold text-foreground">Busca una película</p>
									<p className="mt-1 text-xs text-muted-foreground">Escribe un título para empezar.</p>
								</div>
							) : isSettledEmpty ? (
								<div className="flex h-full flex-col items-center justify-center px-8 text-center">
									<div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted/50">
										<Film className="h-5 w-5 text-muted-foreground" />
									</div>
									<p className="m-0 text-sm font-semibold text-foreground">Sin resultados</p>
									<p className="mt-1 text-xs text-muted-foreground">Prueba con otro título.</p>
								</div>
							) : hasRetainedResults ? (
								<div className="h-full overflow-y-auto p-1.5 [scrollbar-gutter:stable]">
									<div className="grid gap-2 sm:grid-cols-2">
										{retainedResults.map(movie => (
											<div key={movie.id} className={cn(isUpdatingSearch && 'opacity-65')}>
												<MediaResultItem
													imageUrl={getPosterUrl(movie.poster_path, 'w154')}
													fallbackIcon={<Film className="h-5 w-5" />}
													title={movie.title}
													subtitle={movie.release_date?.slice(0, 4) || 'Año desconocido'}
													disabled={isUpdatingSearch}
													onClick={() => selectMovie(movie)}
												/>
											</div>
										))}
									</div>
								</div>
							) : null}
						</div>
					</div>
				) : (
					<div className="grid items-start gap-6 p-5 lg:grid-cols-[minmax(320px,2fr)_minmax(0,3fr)]">
						<div className="divide-y divide-border/70 rounded-xl border border-border/70 bg-muted/10 px-4">
							<section className="py-4">
								<p className="mb-3 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Película seleccionada</p>
								<div className="flex items-center gap-3">
									{details.data?.posterUrl ? <img src={details.data.posterUrl} alt="" className="h-16 w-11 shrink-0 rounded object-cover ring-1 ring-white/10" /> : <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded bg-muted"><Film className="h-4 w-4 text-muted-foreground" /></div>}
									<div className="min-w-0 flex-1">
										<h3 className="truncate text-lg font-extrabold tracking-tight">{details.data?.title || selected.title}</h3>
										<p className="mt-1 truncate text-xs text-muted-foreground">{[details.data?.director !== 'Desconocido' ? details.data?.director : '', details.data?.year].filter(Boolean).join(' · ')}</p>
										<button type="button" className="mt-2 text-xs font-semibold text-primary hover:underline" onClick={() => setSelected(null)}>Cambiar película</button>
									</div>
								</div>
							</section>
							<section className="py-5"><MovieRatingPicker value={rating} onChange={setRating} /></section>
							<section className="py-5">
								<div className="mb-3 flex items-baseline justify-between"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Sello</p><span className="text-[10px] text-muted-foreground">Opcional</span></div>
								<div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Sello de la crítica">
									<button type="button" role="radio" aria-checked={badge === null} onClick={() => setBadge(null)} className={cn('rounded-md border px-2.5 py-1.5 text-[11px] transition-colors', badge === null ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border/70 text-muted-foreground hover:text-foreground')}>Sin sello</button>
									{MOVIE_REVIEW_BADGES.map(option => <button key={option.id} type="button" role="radio" aria-checked={badge === option.id} onClick={() => setBadge(option.id)} className={cn('rounded-md border px-2.5 py-1.5 text-[11px] transition-colors', badge === option.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border/70 bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground')}>{option.label.charAt(0) + option.label.slice(1).toLowerCase()}</button>)}
								</div>
							</section>
							<section className="py-5">
								<div className="mb-2 flex justify-between"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Tu frase <span className="normal-case tracking-normal">(opcional)</span></p><span className="text-[10px] tabular-nums text-muted-foreground">{quote.length} / {MOVIE_REVIEW_QUOTE_MAX_LENGTH}</span></div>
								<div className="relative"><Quote className="absolute left-3 top-3 h-4 w-4 text-primary/60" /><Textarea value={quote} maxLength={MOVIE_REVIEW_QUOTE_MAX_LENGTH} onChange={e => setQuote(e.target.value)} placeholder="Resume lo que te ha parecido en una frase…" rows={3} className="resize-none border-border/70 bg-black/20 pl-9 font-medium italic" /></div>
							</section>
							{error && <p className="py-3 text-sm text-destructive">{error}</p>}
							<div className="flex justify-end py-4"><Button className="min-w-48" disabled={!cardData || rating === null || isGenerating} onClick={() => void handleInsert()}>{isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Generar e insertar</Button></div>
						</div>
						<div className="min-w-0 self-start rounded-xl border border-border/70 bg-black/45 p-4 shadow-inner">
							<p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Vista previa</p>
							{previewUrl ? (
								<img
									src={previewUrl}
									alt="Vista previa de la crítica visual"
									className="block h-auto w-full rounded-lg transition-opacity duration-200"
								/>
							) : previewError ? (
								<div className="flex aspect-[1200/453] items-center justify-center rounded-lg bg-black px-8 text-center text-sm text-muted-foreground">
									No se pudo generar la vista previa: {previewError}
								</div>
							) : (
								<div className="flex aspect-[1200/453] items-center justify-center rounded-lg bg-black">
									{isPreviewGenerating && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
								</div>
							)}
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	)
}
