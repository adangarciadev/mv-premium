import { useId, useState } from 'react'
import { cn } from '@/lib/utils'

interface MovieRatingPickerProps {
	value: number | null
	onChange: (value: number) => void
}

const STAR_PATH = 'M12 2.75l2.84 5.75 6.35.92-4.6 4.48 1.09 6.33L12 18.24l-5.68 2.99 1.09-6.33-4.6-4.48 6.35-.92L12 2.75z'

function StarGlyph({ fill }: { fill: 0 | 0.5 | 1 }) {
	const gradientId = useId().replace(/:/g, '')
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="h-8 w-8 overflow-visible drop-shadow-[0_2px_5px_rgba(0,0,0,.45)]">
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

export function MovieRatingPicker({ value, onChange }: MovieRatingPickerProps) {
	const [hoverValue, setHoverValue] = useState<number | null>(null)
	const visualValue = hoverValue ?? value ?? 0
	const displayedRating = hoverValue ?? value

	const stepRating = (direction: -1 | 1) => {
		const current = value ?? (direction > 0 ? 0 : 0.5)
		onChange(Math.min(10, Math.max(0.5, current + direction * 0.5)))
	}

	return (
		<div className="space-y-3">
			<div className="flex items-end justify-between gap-3">
				<p className="text-[11px] font-bold uppercase tracking-[.16em] text-muted-foreground">Tu valoración</p>
				<strong className={cn('text-4xl font-black tracking-[-.05em]', displayedRating === null ? 'text-muted-foreground/55' : 'text-primary')}>
					{displayedRating === null ? '—' : String(displayedRating).replace('.', ',')}
					<small className="ml-1.5 text-sm font-semibold tracking-normal text-muted-foreground">/ 10</small>
				</strong>
			</div>
			<div
				className="flex items-center justify-between gap-0.5 border-y border-border/45 py-2"
				role="radiogroup"
				aria-label="Valoración de la película"
				onPointerLeave={() => setHoverValue(null)}
			>
				{Array.from({ length: 10 }, (_, index) => {
					const star = index + 1
					const fill: 0 | 0.5 | 1 = visualValue >= star ? 1 : visualValue >= star - 0.5 ? 0.5 : 0
					return (
						<button
							key={star}
							type="button"
							role="radio"
							aria-checked={value === star || value === star - 0.5}
							aria-label={`${star - 0.5} o ${star} sobre 10`}
							className="relative flex min-h-10 min-w-8 flex-1 items-center justify-center text-primary outline-none transition-transform duration-100 hover:scale-105 focus-visible:rounded focus-visible:ring-2 focus-visible:ring-primary"
							onPointerMove={event => {
								const rect = event.currentTarget.getBoundingClientRect()
								setHoverValue(event.clientX - rect.left < rect.width / 2 ? star - 0.5 : star)
							}}
							onClick={event => {
								if (event.detail === 0) { onChange(star); return }
								const rect = event.currentTarget.getBoundingClientRect()
								onChange(event.clientX - rect.left < rect.width / 2 ? star - 0.5 : star)
							}}
							onKeyDown={event => {
								if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); stepRating(1) }
								if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); stepRating(-1) }
							}}
						>
							<StarGlyph fill={fill} />
							<span className="absolute inset-y-0 left-0 w-1/2" aria-hidden="true" />
							<span className="absolute inset-y-0 right-0 w-1/2" aria-hidden="true" />
						</button>
					)
				})}
			</div>
			<p className="text-center text-[11px] text-muted-foreground">Pulsa la mitad izquierda o derecha de cada estrella.</p>
		</div>
	)
}
