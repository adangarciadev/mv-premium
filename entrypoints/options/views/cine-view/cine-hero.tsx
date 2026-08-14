import Image from 'lucide-react/dist/esm/icons/image'
import { Button } from '@/components/ui/button'
import { SimpleTooltip } from '@/components/ui/simple-tooltip'
import { cn } from '@/lib/utils'
import { formatMovieRating, getMovieRatingTier } from '@/features/cine/logic/movie-review'
import type { MovieReviewStats } from '@/features/cine/logic/movie-review-list'
import { formatRuntimeExact, splitRuntimeForDisplay } from '@/features/cine/logic/movie-runtime-cache'
import { InfoPill } from './info-pill'

interface CineHeroProps {
	stats: MovieReviewStats
	/** Distinct films behind those reviews. Equal to the count unless something was rewatched. */
	movieCount: number
	/** Total minutes of cinema, repeats included. Null while TMDB answers, or if it never does. */
	runtimeMinutes: number | null
	/** Posters of everything published, best rated first. They are the backdrop. */
	posterUrls: string[]
	onShare: () => void
	/** Below this the recap has no distribution to draw, only a podium of everything. */
	minRecapReviews: number
}

/**
 * The header of Mediaffinity: your own wall of posters, blurred past recognition into a band of
 * colour behind the figures. The backdrop is the collection itself, so it gets richer the more
 * you rate — and the figures read as a sentence rather than stacked into metric tiles.
 */
/**
 * The hours, set as the one big number on the page.
 *
 * It sits over the poster wall on purpose: that half of the header was pure texture, and a figure
 * this size is the only thing that can share it without either of them losing. Everything else in
 * the header is a sentence you read; this is a number you see from across the room — which is also
 * why it carries no caption: a number that needs explaining is not reading as one.
 */
function RuntimeFigure({ minutes }: { minutes: number }) {
	const { value, unit } = splitRuntimeForDisplay(minutes)

	return (
		<p
			className={cn(
				'flex items-baseline gap-2 border-l border-border/50 pl-5 sm:pl-7',
				// Dos capas: una sombra corta que despega el trazo del cartel y una ancha que apaga
				// lo que haya detrás. Sobre un póster en llamas, una sola no basta.
				'[text-shadow:0_1px_2px_rgba(0,0,0,0.92),0_2px_26px_rgba(0,0,0,0.8)]'
			)}
			// Los minutos exactos viven aquí, al alcance de quien los quiera, sin partir el titular en
			// tres piezas de tamaño decreciente.
			title={formatRuntimeExact(minutes)}
		>
			<span className="font-display text-5xl font-bold leading-none tracking-[-0.04em] text-primary sm:text-6xl">
				{value}
			</span>
			{/* La unidad en blanco: el acento se queda entero para la cifra, y sobre un cartel claro el
			    blanco aguanta mejor que un naranja a menor tamaño. */}
			<span className="font-display text-xl font-semibold leading-none text-foreground sm:text-2xl">{unit}</span>
		</p>
	)
}

export function CineHero({ stats, movieCount, runtimeMinutes, posterUrls, onShare, minRecapReviews }: CineHeroProps) {
	const { best } = stats
	const canShare = stats.count >= minRecapReviews
	const accent = best ? getMovieRatingTier(best.rating).accent : undefined
	// Only worth saying when the two numbers disagree; otherwise it is the same fact twice.
	const hasRewatches = movieCount > 0 && movieCount < stats.count

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
					<h1 className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl">Mediaffinity</h1>

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
					<div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
						<div className="flex max-w-[42rem] items-start gap-2.5">
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
											, con un <strong className="font-semibold text-foreground">{formatMovieRating(best.rating)}</strong>
										</>
									)}
									.
								</>
							) : (
								<>
									Has publicado <strong className="font-semibold text-foreground">{stats.count} críticas</strong>
									{hasRewatches && (
										<>
											{' '}
											sobre <strong className="font-semibold text-foreground">{movieCount} películas</strong>
										</>
									)}
									{stats.averageRating !== null && (
										<>
											{' '}
											con una media de{' '}
											<strong className="font-semibold text-foreground">{formatMovieRating(stats.averageRating)}</strong>
										</>
									)}
									.
									{best && stats.bestTies === 1 && (
										<>
											{' '}
											Tu nota más alta es para{' '}
											<strong className="font-semibold" style={{ color: accent }}>
												{best.title}
											</strong>
											, con un <strong className="font-semibold text-foreground">{formatMovieRating(best.rating)}</strong>.
										</>
									)}
									{best && stats.bestTies > 1 && (
										<>
											{' '}
											Tu nota más alta es un{' '}
											<strong className="font-semibold" style={{ color: accent }}>
												{formatMovieRating(best.rating)}
											</strong>
											, y la comparten{' '}
											<strong className="font-semibold text-foreground">{stats.bestTies} películas</strong>.
										</>
									)}
								</>
							)}
						</p>

							<span className="mt-1.5 shrink-0">
								<InfoPill title="De dónde salen estas cifras">
									Solo cuentan las <strong className="font-semibold text-foreground">críticas publicadas</strong>: las que
									generaste y nunca llegaste a publicar no suman aquí. Si ves dos números distintos, es porque alguna
									película la has criticado más de una vez — cada crítica cuenta, la película se cuenta una sola vez. Las
									horas sí cuentan cada visionado, y las pone TMDB.
								</InfoPill>
							</span>
						</div>

						{runtimeMinutes === null ? (
							// Reserva el hueco mientras TMDB responde: sin esto el titular da un salto al llegar.
							<div className="border-l border-border/50 pl-5 sm:pl-7" aria-hidden>
								<div className="h-12 w-36 animate-pulse rounded-md bg-muted/60 sm:h-14" />
							</div>
						) : (
							<RuntimeFigure minutes={runtimeMinutes} />
						)}
					</div>
				)}
			</div>
		</header>
	)
}
