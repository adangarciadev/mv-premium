import { useMemo, useState } from 'react'
import Check from 'lucide-react/dist/esm/icons/check'
import Film from 'lucide-react/dist/esm/icons/film'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Save from 'lucide-react/dist/esm/icons/save'
import X from 'lucide-react/dist/esm/icons/x'
import { useDebounce } from 'use-debounce'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MediaDialogShell } from '@/components/media-search-dialog/media-dialog-shell'
import { MediaResultItem } from '@/components/media-search-dialog/media-result-item'
import { MediaSearchInput } from '@/components/media-search-dialog/media-search-input'
import { useMovieSearch } from '@/features/cine/hooks/use-tmdb'
import { getPosterUrl } from '@/services/api/tmdb'
import type { TMDBMovie } from '@/types'
import {
	getMovieRatingTier,
	getMovieReviewBadge,
	getSuggestedMovieReviewBadge,
	MOVIE_REVIEW_BADGES,
	type MovieReviewBadge,
} from '@/features/cine/logic/movie-review'
import { buildImportedReviewRecord, upsertMovieReview } from '@/features/cine/logic/movie-review-store'
import type { CandidateCard } from '@/features/cine/logic/movie-review-import'
import { MovieRatingPicker } from './movie-rating-picker'

interface RowValue {
	movie: TMDBMovie | null
	rating: number | null
	badge: MovieReviewBadge | null
	/** Once the user picks a verdict by hand, the score stops overwriting it. */
	badgeTouched: boolean
}

const EMPTY_ROW: RowValue = { movie: null, rating: null, badge: null, badgeTouched: false }

function isComplete(value: RowValue | undefined): value is RowValue & { movie: TMDBMovie; rating: number } {
	return Boolean(value?.movie) && value?.rating !== null && value?.rating !== undefined
}

function getReleaseYear(movie: TMDBMovie): string {
	return movie.release_date?.slice(0, 4) || ''
}

interface ImportRowProps {
	candidate: CandidateCard
	value: RowValue
	onChange: (value: RowValue) => void
}

function ImportRow({ candidate, value, onChange }: ImportRowProps) {
	const [query, setQuery] = useState('')
	const [debouncedQuery] = useDebounce(query, 400)
	const [isPickingBadge, setIsPickingBadge] = useState(false)

	const search = useMovieSearch(debouncedQuery, !value.movie)
	const results = useMemo<TMDBMovie[]>(() => (search.data?.results ?? []).slice(0, 6), [search.data])

	const tier = value.rating === null ? null : getMovieRatingTier(value.rating)
	const badge = getMovieReviewBadge(value.badge)

	const selectMovie = (movie: TMDBMovie) => {
		onChange({ ...value, movie })
		setQuery('')
	}

	const selectRating = (rating: number) => {
		onChange({
			...value,
			rating,
			// The verdict follows the score until the user overrides it, matching the review dialog.
			badge: value.badgeTouched ? value.badge : getSuggestedMovieReviewBadge(rating),
		})
	}

	const selectBadge = (next: MovieReviewBadge) => {
		onChange({ ...value, badge: next, badgeTouched: true })
		setIsPickingBadge(false)
	}

	return (
		<li className="rounded-xl border border-border/70 bg-muted/[0.06] p-3">
			{/* The score is printed inside this image; showing it is what makes retyping possible. */}
			<img
				src={candidate.imageUrl}
				alt="Crítica publicada"
				loading="lazy"
				className="mb-3 w-full rounded-lg border border-border/60"
			/>

			<p className="mb-3 text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground">
				Mensaje #{candidate.postNumber}
			</p>

			{value.movie ? (
				<div className="mb-3 flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 p-2">
					<img
						src={getPosterUrl(value.movie.poster_path, 'w92') ?? undefined}
						alt=""
						className="h-14 w-10 shrink-0 rounded object-cover"
					/>
					<div className="min-w-0 flex-1">
						<p className="m-0 truncate text-sm font-semibold">{value.movie.title}</p>
						<p className="m-0 text-xs text-muted-foreground">{getReleaseYear(value.movie) || 'Sin año'}</p>
					</div>
					<Button variant="ghost" size="sm" onClick={() => onChange({ ...value, movie: null })}>
						<X className="mr-1 h-3 w-3" />
						Cambiar
					</Button>
				</div>
			) : (
				<div className="mb-3">
					<MediaSearchInput
						value={query}
						onChange={setQuery}
						placeholder="¿Qué película es?"
						isSearching={search.isLoading}
					/>

					{results.length > 0 && (
						<ul className="mt-2 max-h-56 list-none overflow-y-auto rounded-lg border border-border/60 p-1">
							{results.map(movie => (
								<li key={movie.id}>
									<MediaResultItem
										imageUrl={getPosterUrl(movie.poster_path, 'w92')}
										fallbackIcon={<Film className="h-4 w-4 text-muted-foreground" />}
										title={movie.title}
										subtitle={getReleaseYear(movie) || 'Sin año'}
										onClick={() => selectMovie(movie)}
									/>
								</li>
							))}
						</ul>
					)}
				</div>
			)}

			<MovieRatingPicker value={value.rating} onChange={selectRating} accent={tier?.accent ?? null} />

			{value.rating !== null && (
				<div className="mt-3">
					{isPickingBadge ? (
						<div className="flex flex-wrap gap-1.5">
							{MOVIE_REVIEW_BADGES.map(option => (
								<button
									key={option.id}
									type="button"
									onClick={() => selectBadge(option.id)}
									className={cn(
										'rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-opacity hover:opacity-80',
										option.id === value.badge && 'ring-1 ring-offset-1'
									)}
									style={{ backgroundColor: option.background, borderColor: option.border, color: option.text }}
								>
									{option.id === value.badge && <Check className="mr-1 inline h-3 w-3" />}
									{option.label}
								</button>
							))}
						</div>
					) : (
						<div className="flex items-center gap-2">
							{badge && (
								<span
									className="rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
									style={{ backgroundColor: badge.background, borderColor: badge.border, color: badge.text }}
								>
									{badge.label}
								</span>
							)}
							<Button variant="ghost" size="sm" onClick={() => setIsPickingBadge(true)}>
								Cambiar veredicto
							</Button>
						</div>
					)}
				</div>
			)}
		</li>
	)
}

interface MovieReviewImportDialogProps {
	isOpen: boolean
	onClose: () => void
	candidates: CandidateCard[]
	/** Called after a successful save with how many records were written. */
	onSaved?: (count: number) => void
}

export function MovieReviewImportDialog({ isOpen, onClose, candidates, onSaved }: MovieReviewImportDialogProps) {
	const [values, setValues] = useState<Record<string, RowValue>>({})
	const [isSaving, setIsSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const completeCount = candidates.filter(candidate => isComplete(values[candidate.imageId])).length

	const handleSave = async () => {
		setIsSaving(true)
		setError(null)

		try {
			let saved = 0

			for (const candidate of candidates) {
				const value = values[candidate.imageId]
				if (!isComplete(value)) continue

				const record = buildImportedReviewRecord({
					imageUrl: candidate.imageUrl,
					tmdbId: value.movie.id,
					title: value.movie.title,
					year: getReleaseYear(value.movie),
					posterUrl: getPosterUrl(value.movie.poster_path, 'w500'),
					rating: value.rating,
					badge: value.badge,
					publication: {
						threadUrl: candidate.threadUrl,
						threadTitle: candidate.threadTitle,
						postNumber: candidate.postNumber,
						confirmedAt: Date.now(),
					},
				})

				if (!record) continue
				await upsertMovieReview(record)
				saved += 1
			}

			onSaved?.(saved)
			onClose()
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'No se pudieron guardar las críticas')
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<MediaDialogShell
			isOpen={isOpen}
			onClose={onClose}
			icon={<Film className="h-4 w-4" />}
			title="Guardar en mis críticas"
			description="La nota y el título están dibujados dentro de la imagen, así que no se pueden leer solos. Dinos qué película es y qué nota le pusiste; la tienes escrita en la propia card."
			width={720}
			height="auto"
			closeDisabled={isSaving}
			footer={
				<div className="flex items-center justify-between gap-3">
					<p className="m-0 text-xs text-muted-foreground">
						{completeCount === 0
							? 'Rellena al menos una para poder guardar.'
							: `${completeCount} de ${candidates.length} lista${completeCount === 1 ? '' : 's'}.`}
					</p>
					<Button onClick={() => void handleSave()} disabled={completeCount === 0 || isSaving}>
						{isSaving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
						{isSaving ? 'Guardando…' : `Guardar ${completeCount === 1 ? '1 crítica' : `${completeCount} críticas`}`}
					</Button>
				</div>
			}
		>
			{error && (
				<div role="alert" className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
					<p className="m-0 font-semibold text-destructive">{error}</p>
					<Button variant="outline" size="sm" className="mt-2" onClick={() => void handleSave()}>
						Reintentar
					</Button>
				</div>
			)}

			<ul className="m-0 flex list-none flex-col gap-3 p-0">
				{candidates.map(candidate => (
					<ImportRow
						key={candidate.imageId}
						candidate={candidate}
						value={values[candidate.imageId] ?? EMPTY_ROW}
						onChange={next => setValues(previous => ({ ...previous, [candidate.imageId]: next }))}
					/>
				))}
			</ul>

			{/* Rows left empty are simply not saved. A 2.66:1 film still can slip past the shape
			    filter, and ignoring it must be easier than dismissing it. */}
			<p className="mt-3 text-xs text-muted-foreground">
				Si alguna imagen no es una crítica, déjala en blanco y no se guardará.
			</p>
		</MediaDialogShell>
	)
}
