import { useEffect, useMemo, useRef, useState } from 'react'
import Check from 'lucide-react/dist/esm/icons/check'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import Film from 'lucide-react/dist/esm/icons/film'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Search from 'lucide-react/dist/esm/icons/search'
import Quote from 'lucide-react/dist/esm/icons/quote'
import Send from 'lucide-react/dist/esm/icons/send'
import Star from 'lucide-react/dist/esm/icons/star'
import { useDebounce } from 'use-debounce'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { MediaDialogActions } from '@/components/media-search-dialog/media-dialog-actions'
import { MediaDialogShell } from '@/components/media-search-dialog/media-dialog-shell'
import { MediaResultItem } from '@/components/media-search-dialog/media-result-item'
import { MediaSearchInput } from '@/components/media-search-dialog/media-search-input'
import { useMovieSearch, useMovieTemplateData } from '@/features/cine/hooks/use-tmdb'
import { getPosterUrl, type TMDBMovie } from '@/services/api/tmdb'
import { getCurrentUser, type CurrentUser } from '@/entrypoints/options/lib/current-user'
import { getApiKey, uploadImage } from '@/services/api/imgbb'
import { createMovieReviewImage, renderMovieReviewCard } from '@/features/cine/logic/movie-review-image'
import { recordGeneratedMovieReview } from '@/features/cine/logic/movie-review-store'
import { resetMovieReviewDetection } from '@/features/cine/logic/movie-review-detection'
import {
	getMovieRatingTier,
	getSuggestedMovieReviewBadge,
	MOVIE_REVIEW_BADGES,
	MOVIE_REVIEW_QUOTE_MAX_LENGTH,
	type MovieReviewBadge,
	type MovieReviewCardData,
} from '@/features/cine/logic/movie-review'
import { MovieRatingPicker } from './movie-rating-picker'

/** Attribution required by TMDB's API terms, matching the wording used by the template dialog. */
function TmdbAttribution() {
	return (
		<div className="mt-4 flex shrink-0 flex-col items-center gap-1 border-t border-border/70 pt-3 opacity-60 transition-opacity hover:opacity-100">
			<a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="mb-1 block">
				<img
					src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
					alt="TMDB"
					className="h-2.5 w-auto"
				/>
			</a>
			<p className="m-0 max-w-[280px] text-center text-[10px] leading-tight text-muted-foreground">
				Este producto utiliza la API de TMDB pero no está avalado ni certificado por TMDB.
			</p>
		</div>
	)
}

interface MovieReviewDialogProps {
	isOpen: boolean
	onClose: () => void
	onInsert: (bbcode: string) => void
}

function MovieSearchSkeletons() {
	return (
		<div className="grid gap-2 p-1 sm:grid-cols-2" role="status" aria-label="Buscando películas">
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
	// 180ms sat right on normal typing speed, so it fired on almost every keystroke instead of coalescing.
	const [debouncedQuote] = useDebounce(quote, 400)
	const [badge, setBadge] = useState<MovieReviewBadge | null>(null)
	const [user, setUser] = useState<CurrentUser | null>(null)
	const [previewError, setPreviewError] = useState<string | null>(null)
	/** Only true until the first frame lands: redraws are now fast enough that a spinner would just flicker. */
	const [isPreviewEmpty, setIsPreviewEmpty] = useState(true)
	const [isGenerating, setIsGenerating] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)
	const [uploadHost, setUploadHost] = useState('freeimage.host')
	/** Once the user picks a verdict, the rating stops overwriting it. */
	const [badgeTouched, setBadgeTouched] = useState(false)
	const [retainedResults, setRetainedResults] = useState<TMDBMovie[]>([])
	const [retainedSearchKey, setRetainedSearchKey] = useState<string | null>(null)
	/** The preview is a live canvas, so there is no PNG encode and no object URL per keystroke. */
	const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
	const isUnmountedRef = useRef(false)
	const search = useMovieSearch(debouncedQuery, isOpen && !selected)
	const details = useMovieTemplateData(selected?.id ?? 0, isOpen && !!selected)
	const selectMovie = (movie: TMDBMovie) => {
		setSelected(movie)
		setIsPreviewEmpty(true)
		setRating(null)
		setBadge(null)
		setQuote('')
		setBadgeTouched(false)
	}

	/** Rating drives the verdict until the user overrides it, then it stops. */
	const selectRating = (value: number) => {
		setRating(value)
		if (!badgeTouched) setBadge(getSuggestedMovieReviewBadge(value))
	}

	const selectBadge = (value: MovieReviewBadge | null) => {
		setBadgeTouched(true)
		setBadge(value)
	}
	const normalizedQuery = query.trim()
	const normalizedDebouncedQuery = debouncedQuery.trim()
	const isSearchReady = normalizedQuery.length >= 2 && normalizedQuery === normalizedDebouncedQuery
	const expectedSearchKey = `tmdb:search:${debouncedQuery}`
	const hasRetainedResults = retainedResults.length > 0
	const isCurrentQueryResolved = isSearchReady && retainedSearchKey === expectedSearchKey
	const currentSearchError = isSearchReady ? search.error : null
	const isUpdatingSearch =
		normalizedQuery.length >= 2 && hasRetainedResults && (!isCurrentQueryResolved || search.isLoading)
	const isFirstSearchLoading =
		normalizedQuery.length >= 2 && !hasRetainedResults && (!isCurrentQueryResolved || search.isLoading)
	const isSettledEmpty =
		normalizedQuery.length >= 2 &&
		isCurrentQueryResolved &&
		!search.isLoading &&
		!hasRetainedResults &&
		!currentSearchError

	/** "Sin veredicto" first, then every badge; drives roving tabindex and arrow navigation. */
	const badgeOptions = useMemo<(MovieReviewBadge | null)[]>(
		() => [null, ...MOVIE_REVIEW_BADGES.map(option => option.id)],
		[]
	)
	const badgeRefs = useRef<(HTMLButtonElement | null)[]>([])

	const handleBadgeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		const direction =
			event.key === 'ArrowRight' || event.key === 'ArrowDown'
				? 1
				: event.key === 'ArrowLeft' || event.key === 'ArrowUp'
					? -1
					: 0
		if (direction === 0) return
		event.preventDefault()
		const current = badgeOptions.indexOf(badge)
		const next = (current + direction + badgeOptions.length) % badgeOptions.length
		selectBadge(badgeOptions[next])
		badgeRefs.current[next]?.focus()
	}

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
		if (isOpen) {
			void getCurrentUser().then(setUser)
			void getApiKey().then(key => setUploadHost(key ? 'ImgBB' : 'freeimage.host'))
		}
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
			setUploadedUrl(null)
			setCopied(false)
			setBadgeTouched(false)
			setPreviewError(null)
			setIsPreviewEmpty(true)
		}
	}, [isOpen])
	useEffect(
		() => () => {
			isUnmountedRef.current = true
		},
		[]
	)

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
						// Only the quote is debounced; rating and verdict repaint immediately.
						quote: debouncedQuote,
						badge,
						username: user?.username || 'Usuario',
						avatarUrl: user?.avatarUrl,
					}
				: null,
		[badge, debouncedQuote, details.data, rating, user]
	)

	useEffect(() => {
		const canvas = previewCanvasRef.current
		if (!cardData || !canvas) return
		let cancelled = false
		setPreviewError(null)
		void renderMovieReviewCard(canvas, cardData)
			.then(() => {
				if (!cancelled) setIsPreviewEmpty(false)
			})
			.catch(cause => {
				if (!cancelled) setPreviewError(cause instanceof Error ? cause.message : 'No se pudo generar la vista previa')
			})
		return () => {
			cancelled = true
		}
	}, [cardData, selected, uploadedUrl])

	const handleInsert = async () => {
		if (!cardData || rating === null) return
		setIsGenerating(true)
		setError(null)
		try {
			const blob = await createMovieReviewImage(cardData)
			const result = await uploadImage(blob)
			if (isUnmountedRef.current) return
			if (!result.success || !result.url) throw new Error(result.error || 'No se pudo subir la crítica')
			onInsert(`[img]${result.url}[/img]\n\n`)
			setUploadedUrl(result.url)
			// Fire-and-forget: the review log must never delay or block inserting the card.
			// Whether this ends up published is decided later, by finding the image in a post.
			if (selected) {
				void recordGeneratedMovieReview(cardData, selected.id, result.url)
				// This page load may already have concluded there was nothing to look for.
				// There is now.
				resetMovieReviewDetection()
			}
		} catch (cause) {
			if (!isUnmountedRef.current) {
				setError(cause instanceof Error ? cause.message : 'No se pudo generar la crítica visual')
			}
		} finally {
			if (!isUnmountedRef.current) setIsGenerating(false)
		}
	}

	const handleCopyUrl = async () => {
		if (!uploadedUrl) return
		await navigator.clipboard.writeText(uploadedUrl)
		setCopied(true)
		window.setTimeout(() => setCopied(false), 2000)
	}

	/** The dialog wears the colour its card will use, so control and output stop disagreeing. */
	const tierAccent = rating === null ? null : getMovieRatingTier(rating).accent

	const handleDownload = async () => {
		if (!cardData) return
		const blob = await createMovieReviewImage(cardData)
		const objectUrl = URL.createObjectURL(blob)
		const link = document.createElement('a')
		link.href = objectUrl
		link.download = `critica-${(details.data?.title || 'pelicula')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')}.png`
		link.click()
		// The download has already been handed to the browser, so the URL can go on the next tick.
		window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
	}

	const stepDescription = uploadedUrl
		? 'Ya está en tu mensaje. Guarda una copia si la quieres reutilizar.'
		: selected
			? 'Tu valoración personal convertida en una card cinematográfica.'
			: 'Elige la película que acabas de ver.'

	return (
		<MediaDialogShell
			isOpen={isOpen}
			onClose={onClose}
			icon={<Star className="h-4 w-4" />}
			title="Crear crítica visual"
			description={stepDescription}
			width={selected ? 1150 : 820}
			height={selected ? 'auto' : 620}
			closeDisabled={isGenerating}
			contentClassName={selected ? undefined : 'flex flex-col'}
			footer={
				selected ? (
					uploadedUrl ? (
						<MediaDialogActions
							onBack={() => {
								setUploadedUrl(null)
								setSelected(null)
							}}
							backLabel="Crear otra"
							onCopy={() => void handleCopyUrl()}
							copied={copied}
							secondaryInsertLabel="Descargar PNG"
							onSecondaryInsert={() => void handleDownload()}
							secondaryInsertDisabled={!cardData}
							onInsert={onClose}
							insertLabel="Cerrar"
						/>
					) : (
						<MediaDialogActions
							onBack={() => setSelected(null)}
							backLabel="← Cambiar película"
							backDisabled={isGenerating}
							secondaryInsertLabel="Descargar PNG"
							onSecondaryInsert={() => void handleDownload()}
							secondaryInsertDisabled={!cardData || isGenerating}
							onInsert={() => void handleInsert()}
							insertLabel={isGenerating ? 'Subiendo crítica…' : 'Generar e insertar'}
							insertIcon={
								isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />
							}
							insertDisabled={!cardData || rating === null || isGenerating}
							insertStyle={tierAccent ? { backgroundColor: tierAccent, color: '#17130a' } : undefined}
						/>
					)
				) : undefined
			}
		>
			{!selected ? (
				<>
					<label
						className="mb-2 block text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground"
						htmlFor="movie-review-search"
					>
						Buscar película por título
					</label>
					<MediaSearchInput
						id="movie-review-search"
						value={query}
						onChange={handleSearchQueryChange}
						placeholder="Buscar película por título..."
						isSearching={search.isLoading}
						autoFocus
					/>

					<div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border/60 bg-muted/[0.08]">
						{isUpdatingSearch && !currentSearchError && (
							<div
								role="status"
								className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm"
							>
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
					<TmdbAttribution />
				</>
			) : (
				<div className="grid items-start gap-6 lg:grid-cols-[minmax(320px,2fr)_minmax(0,3fr)]">
					{uploadedUrl ? (
						<div className="rounded-xl border border-border/70 bg-muted/10 p-5" role="status">
							<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
								<CheckCircle2 className="h-5 w-5 text-primary" />
							</div>
							<h3 className="m-0 text-lg font-extrabold tracking-tight">Crítica insertada</h3>
							<p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
								La imagen se ha subido a {uploadHost} y ya está en tu mensaje como{' '}
								<code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">[img]</code>. Guárdala si quieres
								reutilizarla: no podrás recuperarla desde aquí.
							</p>
							<p className="mt-3 break-all rounded-md border border-border/60 bg-black/25 px-3 py-2 text-xs text-muted-foreground">
								{uploadedUrl}
							</p>
						</div>
					) : (
						<div className="divide-y divide-border/70 rounded-xl border border-border/70 bg-muted/10 px-4">
							<section className="py-4">
								<p className="mb-3 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">
									Película seleccionada
								</p>
								<div className="flex items-center gap-3">
									{details.data?.posterUrl ? (
										<img
											src={details.data.posterUrl}
											alt=""
											className="h-16 w-11 shrink-0 rounded object-cover ring-1 ring-white/10"
										/>
									) : (
										<div className="flex h-16 w-11 shrink-0 items-center justify-center rounded bg-muted">
											<Film className="h-4 w-4 text-muted-foreground" />
										</div>
									)}
									<div className="min-w-0 flex-1">
										<h3 className="truncate text-lg font-extrabold tracking-tight">
											{details.data?.title || selected.title}
										</h3>
										<p className="mt-1 truncate text-xs text-muted-foreground">
											{[details.data?.director !== 'Desconocido' ? details.data?.director : '', details.data?.year]
												.filter(Boolean)
												.join(' · ')}
										</p>
									</div>
								</div>
							</section>
							<section className="py-5">
								<MovieRatingPicker value={rating} onChange={selectRating} accent={tierAccent} />
							</section>
							<section className="py-5">
								<div className="mb-3 flex items-baseline justify-between">
									<p className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">Veredicto</p>
									<span className="text-[10px] text-muted-foreground">
										{badge !== null && !badgeTouched ? 'Sugerido por tu nota' : 'Opcional'}
									</span>
								</div>
								<div
									className="flex flex-wrap gap-1.5"
									role="radiogroup"
									aria-label="Veredicto de la crítica"
									onKeyDown={handleBadgeKeyDown}
								>
									<button
										type="button"
										role="radio"
										aria-checked={badge === null}
										tabIndex={badge === null ? 0 : -1}
										ref={element => {
											badgeRefs.current[0] = element
										}}
										onClick={() => selectBadge(null)}
										className={cn(
											'rounded-md border px-2.5 py-1.5 text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary',
											badge === null
												? 'border-primary/60 bg-primary/10 text-primary'
												: 'border-border/70 text-muted-foreground hover:text-foreground'
										)}
									>
										Sin veredicto
									</button>
									{MOVIE_REVIEW_BADGES.map((option, index) => {
										const isSelected = badge === option.id
										return (
											<button
												key={option.id}
												type="button"
												role="radio"
												aria-checked={isSelected}
												tabIndex={isSelected ? 0 : -1}
												ref={element => {
													badgeRefs.current[index + 1] = element
												}}
												onClick={() => selectBadge(option.id)}
												// The chip wears the badge's own palette, so it previews the colour the card will print.
												// The border uses the solid text colour, not the translucent one, so "selected" reads at a glance.
												style={
													isSelected
														? {
																backgroundColor: option.background,
																borderColor: option.text,
																color: option.text,
																boxShadow: `inset 0 0 0 1px ${option.border}`,
															}
														: undefined
												}
												className={cn(
													'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary',
													isSelected
														? 'font-bold'
														: 'border-border/70 bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
												)}
											>
												{isSelected ? (
													<Check aria-hidden="true" className="h-3 w-3 shrink-0" />
												) : (
													<span
														aria-hidden="true"
														className="h-1.5 w-1.5 shrink-0 rounded-full"
														style={{ backgroundColor: option.text }}
													/>
												)}
												{option.label.charAt(0) + option.label.slice(1).toLowerCase()}
											</button>
										)
									})}
								</div>
							</section>
							<section className="py-5">
								<div className="mb-2 flex justify-between">
									<label
										htmlFor="movie-review-quote"
										className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground"
									>
										Tu frase <span className="normal-case tracking-normal">(opcional)</span>
									</label>
									<span id="movie-review-quote-counter" className="text-[10px] tabular-nums text-muted-foreground">
										{quote.length} / {MOVIE_REVIEW_QUOTE_MAX_LENGTH}
									</span>
								</div>
								<div className="relative">
									<Quote className="absolute left-3 top-3 h-4 w-4 text-primary/60" />
									<Textarea
										id="movie-review-quote"
										aria-describedby="movie-review-quote-counter"
										value={quote}
										maxLength={MOVIE_REVIEW_QUOTE_MAX_LENGTH}
										onChange={e => setQuote(e.target.value)}
										placeholder="Resume lo que te ha parecido en una frase…"
										rows={4}
										className="resize-none border-border/70 bg-black/20 py-2.5 pl-9 font-medium italic leading-relaxed"
									/>
								</div>
							</section>
							{error && (
								<div role="alert" className="flex flex-wrap items-center gap-3 py-3">
									<p className="m-0 min-w-0 flex-1 text-sm text-destructive">{error}</p>
									<Button variant="outline" size="sm" disabled={isGenerating} onClick={() => void handleInsert()}>
										Reintentar
									</Button>
								</div>
							)}
							<p className="m-0 py-4 text-[11px] leading-snug text-muted-foreground">
								Se subirá a {uploadHost} y se insertará en tu mensaje. La card incluye tu nombre y tu avatar.
							</p>
						</div>
					)}
					<div className="min-w-0 self-start rounded-xl border border-border/70 bg-black/45 p-4 shadow-inner">
						<p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Vista previa</p>
						{details.error ? (
							<div
								role="alert"
								className="flex aspect-[1200/453] flex-col items-center justify-center gap-1 rounded-lg bg-black px-8 text-center"
							>
								<p className="m-0 text-sm font-semibold text-foreground">
									No se pudieron cargar los datos de la película
								</p>
								<p className="m-0 text-xs text-muted-foreground">{details.error.message}</p>
								<button
									type="button"
									className="mt-2 text-xs font-semibold text-primary hover:underline"
									onClick={() => setSelected(null)}
								>
									Elegir otra película
								</button>
							</div>
						) : previewError ? (
							<div
								role="alert"
								className="flex aspect-[1200/453] items-center justify-center rounded-lg bg-black px-8 text-center text-sm text-muted-foreground"
							>
								No se pudo generar la vista previa: {previewError}
							</div>
						) : (
							<div role="status" className="relative">
								<canvas
									ref={previewCanvasRef}
									width={1200}
									height={453}
									aria-label="Vista previa de la crítica visual"
									className="block h-auto w-full rounded-lg bg-black"
								/>
								{isPreviewEmpty && (
									<span className="absolute inset-0 flex items-center justify-center">
										<Loader2 className="h-6 w-6 animate-spin text-primary" />
										<span className="sr-only">Generando la vista previa de la crítica</span>
									</span>
								)}
							</div>
						)}
						<TmdbAttribution />
					</div>
				</div>
			)}
		</MediaDialogShell>
	)
}
