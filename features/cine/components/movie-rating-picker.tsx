import { useId, useState } from 'react'
import { cn } from '@/lib/utils'

interface MovieRatingPickerProps {
	value: number | null
	onChange: (value: number) => void
	/** Tier colour of the current rating, so the control matches the card it produces. */
	accent?: string | null
}

const STAR_PATH =
	'M12 2.75l2.84 5.75 6.35.92-4.6 4.48 1.09 6.33L12 18.24l-5.68 2.99 1.09-6.33-4.6-4.48 6.35-.92L12 2.75z'
const MIN_RATING = 0.5
const MAX_RATING = 10

function formatRating(rating: number) {
	return String(rating).replace('.', ',')
}

function StarGlyph({ fill, gradientId }: { fill: 0 | 0.5 | 1; gradientId: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			aria-hidden="true"
			className="h-auto w-full max-w-8 overflow-visible drop-shadow-[0_2px_5px_rgba(0,0,0,.45)]"
		>
			<defs>
				<linearGradient id={gradientId} x1="0" x2="1">
					<stop offset={fill === 0 ? '0%' : fill === 0.5 ? '50%' : '100%'} stopColor="currentColor" />
					<stop offset={fill === 0 ? '0%' : fill === 0.5 ? '50%' : '100%'} stopColor="transparent" />
				</linearGradient>
			</defs>
			<path d={STAR_PATH} fill="none" stroke="currentColor" strokeWidth="1.35" opacity=".45" />
			<path d={STAR_PATH} fill={`url(#${gradientId})`} />
		</svg>
	)
}

/**
 * Half-step rating control.
 *
 * A native range input drives it: one tab stop, real arrow/Home/End semantics, screen reader
 * announcements, and half steps reachable by keyboard and touch — none of which a grid of
 * custom radios provided. The stars are presentation only; the input sits transparently on top
 * with a zero-width thumb so pointer position maps linearly onto the ten stars.
 */
export function MovieRatingPicker({ value, onChange, accent }: MovieRatingPickerProps) {
	const [hoverValue, setHoverValue] = useState<number | null>(null)
	const gradientBase = useId().replace(/:/g, '')
	const visualValue = hoverValue ?? value ?? 0
	const displayedRating = hoverValue ?? value

	const ratingFromPointer = (event: React.PointerEvent<HTMLInputElement>) => {
		const rect = event.currentTarget.getBoundingClientRect()
		if (rect.width === 0) return MIN_RATING
		const raw = ((event.clientX - rect.left) / rect.width) * MAX_RATING
		return Math.min(MAX_RATING, Math.max(MIN_RATING, Math.round(raw * 2) / 2))
	}

	return (
		<div className="space-y-3">
			<div className="flex items-end justify-between gap-3">
				<p className="text-[11px] font-bold uppercase tracking-[.16em] text-muted-foreground">
					Tu valoración <span className="text-primary">*</span>
				</p>
				<strong
					className={cn(
						'text-4xl font-black tracking-[-.05em] transition-colors',
						displayedRating === null ? 'text-muted-foreground' : 'text-primary'
					)}
					style={displayedRating === null || !accent ? undefined : { color: accent }}
				>
					{displayedRating === null ? '—' : formatRating(displayedRating)}
					<small className="ml-1.5 text-sm font-semibold tracking-normal text-muted-foreground">/ 10</small>
				</strong>
			</div>
			<div className="relative border-y border-border/45 py-2" onPointerLeave={() => setHoverValue(null)}>
				<input
					type="range"
					min={0}
					max={MAX_RATING}
					step={0.5}
					value={value ?? 0}
					aria-label="Valoración de la película, de 0,5 a 10"
					aria-valuetext={value === null ? 'Sin valorar' : `${formatRating(value)} sobre 10`}
					onChange={event => onChange(Math.max(MIN_RATING, Number(event.target.value)))}
					onPointerMove={event => setHoverValue(ratingFromPointer(event))}
					className={cn(
						'peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0',
						// A zero-width thumb keeps the pointer-to-value mapping linear across the ten stars.
						'[&::-webkit-slider-thumb]:h-0 [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:appearance-none',
						'[&::-moz-range-thumb]:h-0 [&::-moz-range-thumb]:w-0 [&::-moz-range-thumb]:border-0'
					)}
				/>
				<div
					className="pointer-events-none flex items-center gap-0.5 rounded text-primary transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary"
					style={visualValue === 0 || !accent ? undefined : { color: accent }}
				>
					{Array.from({ length: 10 }, (_, index) => {
						const star = index + 1
						const fill: 0 | 0.5 | 1 = visualValue >= star ? 1 : visualValue >= star - 0.5 ? 0.5 : 0
						return (
							<span key={star} className="flex min-w-0 flex-1 justify-center">
								<StarGlyph fill={fill} gradientId={`${gradientBase}-${star}`} />
							</span>
						)
					})}
				</div>
			</div>
			<p className="text-center text-[11px] text-muted-foreground">
				Arrastra, pulsa o usa las flechas. Cada paso es medio punto.
			</p>
		</div>
	)
}
