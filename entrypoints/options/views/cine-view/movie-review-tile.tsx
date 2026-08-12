import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Film from 'lucide-react/dist/esm/icons/film'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import { Button } from '@/components/ui/button'
import { SimpleTooltip } from '@/components/ui/simple-tooltip'
import { cn } from '@/lib/utils'
import { getMovieRatingTier, getMovieReviewBadge } from '@/features/cine/logic/movie-review'
import type { MovieReviewRecord } from '@/features/cine/logic/movie-review-store'

interface MovieReviewTileProps {
	record: MovieReviewRecord
	/** How many other reviews live in the same message; 0 hides the hint. */
	sharingPost: number
	onDelete: (record: MovieReviewRecord) => void
}

/** Permalink to the exact message that carries this review. */
function getPostPermalink(record: MovieReviewRecord): string | null {
	if (!record.publication) return null
	return `${record.publication.threadUrl}#${record.publication.postNumber}`
}

export function MovieReviewTile({ record, sharingPost, onDelete }: MovieReviewTileProps) {
	const tier = getMovieRatingTier(record.rating)
	const badge = getMovieReviewBadge(record.badge)
	const permalink = getPostPermalink(record)

	return (
		<div className="group flex flex-col rounded-lg border border-border bg-card transition-shadow hover:shadow-md">
			{/* Clipping lives on the poster, not on the card: SimpleTooltip positions itself against
			    its trigger without a portal, so an overflow-hidden card would cut its tooltips off. */}
			<div className="relative aspect-[2/3] w-full overflow-hidden rounded-t-lg bg-muted">
				{record.posterUrl ? (
					<img src={record.posterUrl} alt={record.title} loading="lazy" className="h-full w-full object-cover" />
				) : (
					<div className="flex h-full w-full items-center justify-center text-muted-foreground">
						<Film className="h-8 w-8" />
					</div>
				)}

				{/* Solid chip, never text straight over the artwork: posters are bright and busy. */}
				<span
					className="absolute bottom-2 left-2 rounded-md px-2 py-1 text-sm font-bold tabular-nums shadow-sm"
					style={{ backgroundColor: tier.accent, color: '#17130a' }}
				>
					{record.rating.toFixed(1)}
				</span>
			</div>

			<div className="flex flex-1 flex-col gap-1 p-3">
				<h3 className="line-clamp-2 text-sm font-semibold leading-tight" title={record.title}>
					{record.title}
				</h3>
				{record.year && <p className="text-xs text-muted-foreground">{record.year}</p>}

				{badge && (
					<span
						className="mt-1 w-fit rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
						style={{ backgroundColor: badge.background, borderColor: badge.border, color: badge.text }}
					>
						{badge.label}
					</span>
				)}

				{sharingPost > 0 && (
					<p className="mt-1 text-[11px] text-muted-foreground">
						{sharingPost === 1 ? 'Junto a 1 más en el mismo mensaje' : `Junto a ${sharingPost} más en el mismo mensaje`}
					</p>
				)}

				<div className="mt-auto flex items-center gap-1 pt-2">
					{permalink && (
						<SimpleTooltip content="Ver el mensaje en Mediavida">
							<Button variant="outline" size="sm" className="flex-1" asChild>
								<a href={permalink} target="_blank" rel="noopener noreferrer">
									<ExternalLink className="mr-1 h-3 w-3" />
									Ver
								</a>
							</Button>
						</SimpleTooltip>
					)}
					<SimpleTooltip content="Eliminar del registro">
						<Button
							variant="ghost"
							size="sm"
							className={cn('text-muted-foreground hover:text-destructive', !permalink && 'flex-1')}
							onClick={() => onDelete(record)}
							aria-label={`Eliminar la crítica de ${record.title}`}
						>
							<Trash2 className="h-3 w-3" />
						</Button>
					</SimpleTooltip>
				</div>
			</div>
		</div>
	)
}
