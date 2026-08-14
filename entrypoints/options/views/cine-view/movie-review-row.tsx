import Film from 'lucide-react/dist/esm/icons/film'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import { cn } from '@/lib/utils'
import { formatMovieRating, getMovieRatingTier, getMovieReviewBadge } from '@/features/cine/logic/movie-review'
import type { MovieViewing } from '@/features/cine/logic/movie-review-list'
import type { MovieReviewRecord } from '@/features/cine/logic/movie-review-store'

interface MovieReviewRowProps {
	record: MovieReviewRecord
	viewing?: MovieViewing
	onDelete: (record: MovieReviewRecord) => void
}

function getPostPermalink(record: MovieReviewRecord): string | null {
	if (!record.publication) return null
	return `${record.publication.threadUrl}#${record.publication.postNumber}`
}

function getRewatchTitle(viewing: MovieViewing): string {
	return viewing.ordinal > 1 ? `Revisionado · ${viewing.ordinal}ª vez` : 'Revisionado'
}

/**
 * The column geometry, shared verbatim by the header and every row.
 *
 * Two copies of these numbers would drift the first time one of them was tuned, and a header that
 * does not sit exactly over its column is worse than no header at all.
 *
 * Order of surrender as the window narrows: verdict, then release year. The date survives longest
 * after the title and the score, because it is what tells three viewings of the same film apart —
 * without it, a rewatched film is three identical rows.
 *
 * Every column is a fraction rather than a fixed width, so the slack is shared instead of being
 * swallowed whole by the title: with `1fr` for the title and `rem` for the rest, the four right
 * columns ended up huddled together at the far end of a very wide empty gap.
 */
export const DIARY_COLUMNS =
	'grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] items-center gap-6 sm:grid-cols-[minmax(0,2.6fr)_minmax(0,1.1fr)] md:grid-cols-[minmax(0,2.6fr)_minmax(0,1.1fr)_minmax(0,0.6fr)_minmax(0,1.3fr)]'

/** One instance rather than one per row: sixty of these are built on every render otherwise. */
const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

/** Widths of the fixed edges either side of those columns, so the header can reserve the same. */
export const DIARY_THUMB = 'w-12 shrink-0'
export const DIARY_SCORE = 'w-14 shrink-0 text-right'
export const DIARY_ACTION = 'w-7 shrink-0'

/**
 * One film in Diario — the opposite of Galería, and deliberately so.
 *
 * Everything is set on a fixed column so twenty films read as four aligned columns rather than
 * twenty little compositions: the scores line up in a single tabular column you can run an eye
 * down, and the poster shrinks to a thumbnail that says which film it is without competing.
 * Galería is for recorrer; this is for encontrar.
 *
 * The middle columns fold away on narrow screens, in the order you would give them up: verdict
 * first, then year. Title and score survive at any width.
 */
export function MovieReviewRow({ record, viewing, onDelete }: MovieReviewRowProps) {
	const tier = getMovieRatingTier(record.rating)
	const badge = getMovieReviewBadge(record.badge)
	const permalink = getPostPermalink(record)
	const isRewatch = viewing?.isRewatch === true

	return (
		<article className="group relative flex items-center gap-4 border-b border-border/70 px-2 py-2 transition-colors hover:bg-muted/20">
			<div className={cn('relative aspect-[2/3] overflow-hidden rounded border border-border bg-muted', DIARY_THUMB)}>
				{record.posterUrl ? (
					<img src={record.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
				) : (
					<div className="flex h-full w-full items-center justify-center text-muted-foreground">
						<Film className="h-3.5 w-3.5" />
					</div>
				)}
			</div>

			<div className={DIARY_COLUMNS}>
				<h3 className="truncate text-sm font-semibold leading-tight" title={record.title}>
					{record.title}
				</h3>

				{/* La marca de revisionado va con la fecha: es esta sesión la que fue una revisión. */}
				<p className="font-data hidden items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground sm:flex">
					<span>{DATE_FORMAT.format(record.createdAt)}</span>
					{isRewatch && viewing && (
						<span className="inline-flex" title={getRewatchTitle(viewing)} aria-label={getRewatchTitle(viewing)}>
							<RotateCcw aria-hidden className="h-3 w-3 shrink-0" />
						</span>
					)}
				</p>

				<p className="font-data hidden text-xs text-muted-foreground md:block">{record.year}</p>

				<p
					className="hidden truncate text-[9.5px] font-bold uppercase leading-none tracking-[.12em] md:block"
					style={{ color: badge?.text }}
				>
					{badge?.label}
				</p>
			</div>

			<span
				className={cn('font-data text-2xl font-bold leading-none tabular-nums', DIARY_SCORE)}
				style={{ color: tier.accent }}
			>
				{formatMovieRating(record.rating)}
			</span>

			{/* The whole row is the link; no glyph of its own, which would also break the column edges. */}
			{permalink && (
				<a
					href={permalink}
					target="_blank"
					rel="noopener noreferrer"
					className="absolute inset-0 z-10 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
					aria-label={`Ver en Mediavida el mensaje con la crítica de ${record.title}`}
				/>
			)}

			<button
				type="button"
				onClick={() => onDelete(record)}
				aria-label={`Eliminar del registro la crítica de ${record.title}`}
				className={cn(
					DIARY_ACTION,
					'z-20 grid h-7 place-items-center rounded-md border border-transparent text-muted-foreground',
					'opacity-0 transition-[opacity,background-color,color,border-color]',
					'hover:border-destructive hover:bg-destructive hover:text-destructive-foreground',
					'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
					'group-hover:opacity-100 [@media(hover:none)]:opacity-100'
				)}
			>
				<Trash2 className="h-3.5 w-3.5" />
			</button>
		</article>
	)
}
