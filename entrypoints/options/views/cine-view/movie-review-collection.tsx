import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { groupMovieReviews, type MovieCollectionEntry, type MovieViewing } from '@/features/cine/logic/movie-review-list'
import type { MovieReviewRecord } from '@/features/cine/logic/movie-review-store'
import type { MovieReviewView } from '@/features/cine/logic/movie-review-view'
import { DIARY_ACTION, DIARY_COLUMNS, DIARY_SCORE, DIARY_THUMB, MovieReviewRow } from './movie-review-row'
import { MovieReviewTile } from './movie-review-tile'

const HEADING = 'text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground'

const GALLERY_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-[18px] gap-y-7'

/**
 * How many go in the first batch, and how many arrive in each one after it.
 *
 * Small on purpose. The records are already in memory — nothing is being fetched — so a batch is a
 * rendering budget, not a wait, and thirty of them append in a frame or two. Fifty made the page
 * grow in one lurch you could feel in the scrollbar.
 */
const BATCH_SIZE = 30

/**
 * How far ahead of the bottom the next batch is appended.
 *
 * A screen and a half. The point is that the list is always already longer than where you are, so
 * you never actually arrive at the end of it and there is no boundary to see.
 */
const PRELOAD_MARGIN = '1200px'

/**
 * Names the columns using the very same geometry the rows do, edges included: the thumbnail belongs
 * to «Película» and gets no heading of its own, only its reserved width.
 */
function DiaryHeader() {
	return (
		<div className="flex items-center gap-4 border-b border-border px-2 pb-2">
			<span className={DIARY_THUMB} aria-hidden />
			<div className={DIARY_COLUMNS}>
				<span className={HEADING}>Película</span>
				<span className={cn(HEADING, 'hidden sm:block')}>Vista</span>
				<span className={cn(HEADING, 'hidden md:block')}>Estreno</span>
				<span className={cn(HEADING, 'hidden md:block')}>Veredicto</span>
			</div>
			<span className={cn(HEADING, DIARY_SCORE)}>Nota</span>
			<span className={DIARY_ACTION} aria-hidden />
		</div>
	)
}

/**
 * The sign that the list continues: three dots breathing at the foot of it.
 *
 * It replaced a strip of skeleton posters, and that is why the scroll used to lurch. Six
 * placeholders standing in for thirty arrivals meant the page height jumped every time a batch
 * landed, and the scrollbar jumped with it. This keeps a **fixed** height whether it is waiting or
 * not, so appending never resizes anything above it — the list simply gets longer below the fold,
 * which is the whole trick to making it feel like there was never a boundary.
 */
function MoreAhead() {
	return (
		<div className="flex h-16 items-center justify-center gap-1.5" aria-hidden>
			{[0, 1, 2].map(index => (
				<span
					key={index}
					className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/45"
					style={{ animationDelay: `${index * 220}ms`, animationDuration: '1.4s' }}
				/>
			))}
		</div>
	)
}

/**
 * Grows the list a batch at a time as the bottom comes into view.
 *
 * Numbered pages were the other option and they are wrong for both modes: a visual library is for
 * walking through and a diary is read down the page, and neither wants to be asked which page it
 * would like. Rendering everything at once was fine at sixty and would not be at a thousand.
 *
 * The observer is rebuilt whenever the count moves, because an observer already watching a sentinel
 * that stays on screen never fires again — and the list would stall one batch in.
 */
function useBatches(total: number, resetKey: unknown) {
	const [count, setCount] = useState(BATCH_SIZE)
	const sentinelRef = useRef<HTMLDivElement>(null)
	const hasMore = count < total

	// A new filter, sort or mode starts the list over: otherwise a filter that leaves twenty results
	// would keep claiming there is more below.
	useEffect(() => {
		setCount(BATCH_SIZE)
	}, [resetKey])

	useEffect(() => {
		const node = sentinelRef.current
		if (!node || !hasMore) return

		const observer = new IntersectionObserver(
			entries => {
				if (entries.some(entry => entry.isIntersecting)) setCount(current => current + BATCH_SIZE)
			},
			{ rootMargin: PRELOAD_MARGIN }
		)

		observer.observe(node)
		return () => observer.disconnect()
	}, [hasMore, count])

	return { count, hasMore, sentinelRef }
}

interface MovieReviewCollectionProps {
	records: MovieReviewRecord[]
	view: MovieReviewView
	/** Keyed by imageId. Computed over the whole collection, never over the filtered view. */
	viewings: Map<string, MovieViewing>
	/** Receives every review the action should remove: one in Diario, all of a film in Galería. */
	onDelete: (records: MovieReviewRecord[]) => void
}

/**
 * The same reviews in whichever of the two shapes is on — and they are not the same list.
 *
 * Diario is a diary: one row per review, so a film watched three times is three entries with three
 * dates, which is the whole point of a diary. Galería is a collection: one card per film, because
 * a shelf never holds the same poster twice. The batching therefore counts films in one and reviews
 * in the other, which is also what each mode's counter reports.
 *
 * The grid is `auto-fill` rather than a fixed column count so the posters keep a comfortable size
 * at every width instead of stretching: six across the dashboard, and fewer, never smaller, as the
 * window narrows.
 */
export function MovieReviewCollection({ records, view, viewings, onDelete }: MovieReviewCollectionProps) {
	const entries = useMemo<MovieReviewRecord[] | MovieCollectionEntry[]>(
		() => (view === 'diary' ? records : groupMovieReviews(records)),
		[records, view]
	)

	const { count, hasMore, sentinelRef } = useBatches(entries.length, entries)

	return (
		<div>
			{view === 'diary' ? (
				<div>
					<DiaryHeader />
					{(entries as MovieReviewRecord[]).slice(0, count).map(record => (
						<MovieReviewRow
							key={record.imageId}
							record={record}
							viewing={viewings.get(record.imageId)}
							onDelete={() => onDelete([record])}
						/>
					))}
				</div>
			) : (
				<div className={GALLERY_GRID}>
					{(entries as MovieCollectionEntry[]).slice(0, count).map(({ record, reviews }) => (
						<MovieReviewTile
							key={record.tmdbId}
							record={record}
							viewing={viewings.get(record.imageId)}
							reviewCount={reviews.length}
							onDelete={() => onDelete(reviews)}
						/>
					))}
				</div>
			)}

			{hasMore && (
				<>
					{/* El centinela va por encima del indicador, no debajo: así se cruza con el margen de
					    precarga bastante antes de que el pie llegue a estar a la vista. */}
					<div ref={sentinelRef} aria-hidden className="h-px w-full" />
					<MoreAhead />
				</>
			)}
		</div>
	)
}
