import Image from 'lucide-react/dist/esm/icons/image'
import { Button } from '@/components/ui/button'
import { SimpleTooltip } from '@/components/ui/simple-tooltip'
import { getMovieRatingTier } from '@/features/cine/logic/movie-review'
import type { MovieReviewStats } from '@/features/cine/logic/movie-review-list'

interface CineHeroProps {
	stats: MovieReviewStats
	/** Posters of everything published, best rated first. They are the backdrop. */
	posterUrls: string[]
	onShare: () => void
	/** Below this the recap has no distribution to draw, only a podium of everything. */
	minRecapReviews: number
}

function formatRating(rating: number): string {
	return rating.toFixed(1)
}

/**
 * The header of Mis Críticas: your own wall of posters, blurred past recognition into a band of
 * colour behind the figures. The backdrop is the collection itself, so it gets richer the more
 * you rate — and the figures read as a sentence rather than stacked into metric tiles.
 */
export function CineHero({ stats, posterUrls, onShare, minRecapReviews }: CineHeroProps) {
	const { best } = stats
	const canShare = stats.count >= minRecapReviews
	const accent = best ? getMovieRatingTier(best.rating).accent : undefined

	return (
		<header className="cine-hero reveal reveal-d1 border border-border">
			<div className="cine-hero-backdrop" aria-hidden>
				{/* Posters go in at full resolution: they are the same URLs the grid below already
				    renders, so they cost a cache hit, and a downscaled source just reads as blur. */}
				{posterUrls.length > 0 && (
					<div className="cine-hero-media">
						{posterUrls.map(url => (
							<span key={url} className="cine-hero-poster" style={{ backgroundImage: `url("${url}")` }} />
						))}
					</div>
				)}
				<div className="cine-hero-veil" />
			</div>

			<div className="cine-hero-body flex flex-col gap-7 p-6 sm:p-8">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<h1 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">Mis Críticas</h1>

					<SimpleTooltip
						content={
							canShare
								? 'Tus notas y tu podio en una imagen, para pegar en un hilo'
								: `Necesitas al menos ${minRecapReviews} críticas publicadas`
						}
					>
						<span>
							<Button variant="outline" onClick={onShare} disabled={!canShare}>
								<Image className="mr-1.5 h-4 w-4" />
								Compartir resumen
							</Button>
						</span>
					</SimpleTooltip>
				</div>

				{stats.count === 0 ? (
					<p className="max-w-[52ch] text-sm text-muted-foreground">
						Las películas que valores con la card de crítica aparecerán aquí, con enlace al mensaje donde las
						publicaste.
					</p>
				) : (
					<div className="max-w-[42rem]">
						<p className="font-display text-xl leading-snug tracking-[-0.015em] text-muted-foreground sm:text-2xl">
							{stats.count === 1 ? (
								<>
									Has publicado <strong className="font-semibold text-foreground">1 crítica</strong>
									{best && (
										<>
											:{' '}
											<strong className="font-semibold" style={{ color: accent }}>
												{best.title}
											</strong>
											, con un <strong className="font-semibold text-foreground">{formatRating(best.rating)}</strong>
										</>
									)}
									.
								</>
							) : (
								<>
									Has publicado <strong className="font-semibold text-foreground">{stats.count} críticas</strong>
									{stats.averageRating !== null && (
										<>
											{' '}
											con una media de{' '}
											<strong className="font-semibold text-foreground">{formatRating(stats.averageRating)}</strong>
										</>
									)}
									.
									{best && (
										<>
											{' '}
											Tu nota más alta es para{' '}
											<strong className="font-semibold" style={{ color: accent }}>
												{best.title}
											</strong>
											, con un <strong className="font-semibold text-foreground">{formatRating(best.rating)}</strong>.
										</>
									)}
								</>
							)}
						</p>
					</div>
				)}
			</div>
		</header>
	)
}
