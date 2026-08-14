import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Film from 'lucide-react/dist/esm/icons/film'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import { cn } from '@/lib/utils'
import { getMovieRatingTier, getMovieReviewBadge } from '@/features/cine/logic/movie-review'
import type { MovieReviewRecord } from '@/features/cine/logic/movie-review-store'

interface MovieReviewTileProps {
	record: MovieReviewRecord
	onDelete: (record: MovieReviewRecord) => void
}

/** Permalink to the exact message that carries this review. */
function getPostPermalink(record: MovieReviewRecord): string | null {
	if (!record.publication) return null
	return `${record.publication.threadUrl}#${record.publication.postNumber}`
}

/**
 * One film on the wall. The poster is the whole target — it links to the message it was
 * published in — and the controls only surface on hover or keyboard focus, so eighteen of
 * these read as a shelf of posters instead of thirty-six competing buttons.
 */
export function MovieReviewTile({ record, onDelete }: MovieReviewTileProps) {
	const tier = getMovieRatingTier(record.rating)
	const badge = getMovieReviewBadge(record.badge)
	const permalink = getPostPermalink(record)

	return (
		<div className="group flex flex-col gap-2">
			<div
				className={cn(
					'relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-border bg-muted',
					'transition-[box-shadow,border-color] duration-200',
					'group-hover:shadow-lift group-focus-within:shadow-lift'
				)}
			>
				{record.posterUrl ? (
					<img src={record.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
				) : (
					<div className="flex h-full w-full items-center justify-center text-muted-foreground">
						<Film className="h-8 w-8" />
					</div>
				)}

				{/* Chips ride a scrim, never bare text over artwork: posters are bright and busy. */}
				<div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end gap-1.5 bg-gradient-to-t from-black/80 via-black/45 to-transparent p-2 pt-10">
					<span
						className="rounded-md px-2 py-1 text-sm font-bold tabular-nums shadow-sm"
						style={{ backgroundColor: tier.accent, color: '#17130a' }}
					>
						{record.rating.toFixed(1)}
					</span>

					{badge && (
						<span
							className="rounded border px-1.5 py-1 text-[10px] font-bold uppercase leading-none tracking-wide"
							style={{ backgroundColor: badge.background, borderColor: badge.border, color: badge.text }}
						>
							{badge.label}
						</span>
					)}
				</div>

				{permalink && (
					<>
						{/* Stretched link: the poster is the primary action, and the delete button
						    sits above it as a sibling rather than nested inside an anchor. */}
						<a
							href={permalink}
							target="_blank"
							rel="noopener noreferrer"
							className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
							aria-label={`Ver en Mediavida el mensaje con la crítica de ${record.title}`}
						/>
						<span
							aria-hidden
							className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-1.5 bg-gradient-to-b from-black/70 to-transparent p-2 pb-8 pr-11 text-xs font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
						>
							<ExternalLink className="h-3.5 w-3.5 shrink-0" />
							Ver el mensaje
						</span>
					</>
				)}

				<button
					type="button"
					onClick={() => onDelete(record)}
					aria-label={`Eliminar del registro la crítica de ${record.title}`}
					className={cn(
						'absolute right-2 top-2 z-20 rounded-md border border-border bg-background p-2 shadow-sm',
						'text-foreground opacity-0 transition-[opacity,background-color,color,border-color] duration-200',
						'hover:border-destructive hover:bg-destructive hover:text-destructive-foreground',
						'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
						'group-hover:opacity-100 group-focus-within:opacity-100'
					)}
				>
					<Trash2 className="h-4 w-4" />
				</button>
			</div>

			<div className="min-w-0">
				<h3 className="line-clamp-2 text-sm font-semibold leading-tight" title={record.title}>
					{record.title}
				</h3>
				{record.year && <p className="font-data mt-0.5 text-xs text-muted-foreground">{record.year}</p>}
			</div>
		</div>
	)
}
