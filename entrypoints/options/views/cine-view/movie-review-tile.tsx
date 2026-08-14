import Film from 'lucide-react/dist/esm/icons/film'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import { cn } from '@/lib/utils'
import { formatMovieRating, getMovieRatingTier, getMovieReviewBadge } from '@/features/cine/logic/movie-review'
import type { MovieViewing } from '@/features/cine/logic/movie-review-list'
import type { MovieReviewRecord } from '@/features/cine/logic/movie-review-store'

interface MovieReviewTileProps {
	record: MovieReviewRecord
	/** Where this review sits among the ones for the same film. Absent means it was not computed. */
	viewing?: MovieViewing
	/** How many reviews this one film has. One tile stands for all of them. */
	reviewCount: number
	onDelete: (record: MovieReviewRecord) => void
}

/** Permalink to the exact message that carries this review. */
function getPostPermalink(record: MovieReviewRecord): string | null {
	if (!record.publication) return null
	return `${record.publication.threadUrl}#${record.publication.postNumber}`
}

/**
 * The mark itself never carries a number — a rewatch is a rewatch, the way Letterboxd has it — but
 * the count is known, so it goes in the tooltip instead of being thrown away.
 */
function getRewatchTitle(reviewCount: number): string {
	return reviewCount > 1 ? `Revisionado · ${reviewCount} críticas` : 'Revisionado'
}

/**
 * One film in Galería — one film, not one review.
 *
 * The poster carries nothing but the poster and its own score: it is artwork somebody else
 * composed, and the score sits in the bottom-right corner, where posters keep their credit block
 * and where it costs the image least. Everything else lives underneath in exactly two lines whose
 * height never depends on how long the title is — otherwise one long name ripples through the
 * whole row and the grid stops reading as a grid.
 *
 * Hover only ever adds actions, never information: on a touch screen there is no hover, and the
 * title, score, year, rewatch and verdict all have to be legible without one.
 */
export function MovieReviewTile({ record, viewing, reviewCount, onDelete }: MovieReviewTileProps) {
	const tier = getMovieRatingTier(record.rating)
	const badge = getMovieReviewBadge(record.badge)
	const permalink = getPostPermalink(record)
	// Two ways to be a rewatch: more than one review of the film, or one the user declared.
	const isRewatch = reviewCount > 1 || viewing?.isRewatch === true

	return (
		<article className="group flex flex-col gap-2.5">
			{/*
			 * The poster never moves or grows on hover — at six across, a card that lifts shoves the
			 * eye around the whole row. All it gets is the theme's accent around its edge, `--primary`
			 * itself, the same token the sidebar uses to mark the page you are on.
			 *
			 * Solid, never thinned. A translucent halo of this colour dims to a muddy ochre against a
			 * near-black ground and against dark artwork, and beside a crisp one-pixel border the eye
			 * fuses the two into one dirty band — which is precisely what looked wrong. The ring sits
			 * outside the box, so widening the edge cannot nudge the image inside it.
			 */}
			<div
				className={cn(
					'relative aspect-[2/3] w-full overflow-hidden rounded-md border border-border bg-muted',
					'transition-[box-shadow,border-color] duration-200',
					'group-hover:border-primary group-hover:ring-2 group-hover:ring-primary group-hover:ring-offset-0',
					'group-focus-within:border-primary group-focus-within:ring-2 group-focus-within:ring-primary group-focus-within:ring-offset-0'
				)}
			>
				{record.posterUrl ? (
					<img src={record.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
				) : (
					<div className="flex h-full w-full items-center justify-center text-muted-foreground">
						<Film className="h-8 w-8" />
					</div>
				)}

				{/*
				 * Its own opaque surface, identical on every poster.
				 *
				 * The blur was the weak part: over a white or yellow poster it mixed the artwork back
				 * into the chip instead of hiding it. A flat black at 85% plus a hairline edge is
				 * deterministic — the same contrast over black, white, orange or a blown-out sky — and
				 * it costs nothing to composite.
				 */}
				<span
					className="font-data absolute bottom-1.5 right-1.5 z-[2] rounded-[5px] border border-white/15 bg-black/85 px-1.5 pb-[3px] pt-0.5 text-[15px] font-bold leading-[1.1] tabular-nums shadow-[0_1px_6px_rgba(0,0,0,0.5)]"
					style={{ color: tier.accent }}
				>
					{formatMovieRating(record.rating)}
				</span>

				{/* Stretched link: the poster itself opens the message, so there is no button for it —
				    one would be a second control saying what the whole card already says. The delete
				    button sits above it as a sibling rather than nested inside the anchor. */}
				{permalink && (
					<a
						href={permalink}
						target="_blank"
						rel="noopener noreferrer"
						className="absolute inset-0 z-10 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
						aria-label={`Ver en Mediavida el mensaje con la crítica de ${record.title}`}
					/>
				)}

				<button
					type="button"
					onClick={() => onDelete(record)}
					aria-label={`Eliminar del registro la crítica de ${record.title}`}
					className={cn(
						'absolute right-1.5 top-1.5 z-20 grid h-7 w-7 place-items-center rounded-md border border-border bg-background shadow-sm',
						'text-foreground opacity-0 transition-[opacity,background-color,color,border-color] duration-200',
						'hover:border-destructive hover:bg-destructive hover:text-destructive-foreground',
						'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
						'group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100'
					)}
				>
					<Trash2 className="h-3.5 w-3.5" />
				</button>
			</div>

			{/*
			 * Two lines, always two. The title spans both columns so it gets the poster's full width;
			 * the right column is sized by its content, so the verdict can never be pushed by a year.
			 */}
			<div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2.5 gap-y-[3px]">
				<h3
					className="col-span-2 truncate text-[13.5px] font-semibold leading-[1.35] tracking-[-0.005em]"
					title={record.title}
				>
					{record.title}
				</h3>

				<p className="font-data flex min-w-0 items-center gap-1.5 text-[10.5px] text-muted-foreground">
					{record.year && <span>{record.year}</span>}
					{isRewatch && (
						<span
							className="inline-flex"
							title={getRewatchTitle(reviewCount)}
							aria-label={getRewatchTitle(reviewCount)}
						>
							<RotateCcw aria-hidden className="h-3 w-3 shrink-0" />
						</span>
					)}
				</p>

				{badge && (
					<p
						className="justify-self-end truncate text-[8.5px] font-bold uppercase leading-none tracking-[.14em] opacity-[.78]"
						style={{ color: badge.text }}
					>
						{badge.label}
					</p>
				)}
			</div>
		</article>
	)
}
