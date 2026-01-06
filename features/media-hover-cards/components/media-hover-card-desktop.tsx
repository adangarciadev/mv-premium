import { useRef, useEffect, useState } from 'react'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { cn } from '@/lib/utils'
import { Z_INDEXES } from '@/constants/z-indexes'
import { useMediaData } from '../hooks/use-media-data'
import {
	MediaHoverCardContent,
	MediaHoverCardSkeleton
} from './media-hover-card-content'

interface DesktopCardProps {
	url: string
	anchorRect: DOMRect
	onMouseEnter: () => void
	onMouseLeave: () => void
}

const CARD_WIDTH = 600
const CARD_HEIGHT_ESTIMATE = 320
const OFFSET = 10

function calculatePosition(anchorRect: DOMRect): {
	top: number
	left: number
	placement: 'above' | 'below'
	origin: string
} {
	const viewportHeight = window.innerHeight
	const viewportWidth = window.innerWidth

	const spaceBelow = viewportHeight - anchorRect.bottom
	const spaceAbove = anchorRect.top

	let placement: 'above' | 'below' = 'below'
	let top: number
	let origin = 'top center'

	if (spaceBelow >= CARD_HEIGHT_ESTIMATE + OFFSET) {
		placement = 'below'
		top = anchorRect.bottom + OFFSET
		origin = 'top center'
	} else if (spaceAbove >= CARD_HEIGHT_ESTIMATE + OFFSET) {
		placement = 'above'
		top = anchorRect.top - CARD_HEIGHT_ESTIMATE - OFFSET
		origin = 'bottom center'
	} else {
		if (spaceBelow > spaceAbove) {
			placement = 'below'
			top = anchorRect.bottom + OFFSET
			origin = 'top center'
		} else {
			placement = 'above'
			top = anchorRect.top - CARD_HEIGHT_ESTIMATE - OFFSET
			origin = 'bottom center'
		}
	}

	let left = anchorRect.left + (anchorRect.width / 2) - (CARD_WIDTH / 2)
	const PADDING = 16
	if (left + CARD_WIDTH > viewportWidth - PADDING) {
		left = viewportWidth - CARD_WIDTH - PADDING
		origin = placement === 'above' ? 'bottom right' : 'top right'
	}
	if (left < PADDING) {
		left = PADDING
		origin = placement === 'above' ? 'bottom left' : 'top left'
	}

	return { top, left, placement, origin }
}

export function DesktopCard({
	url,
	anchorRect,
	onMouseEnter,
	onMouseLeave
}: DesktopCardProps) {
	const cardRef = useRef<HTMLDivElement>(null)
	const [isVisible, setIsVisible] = useState(false)
	const { data, isLoading, error } = useMediaData(url)

	const { top, left, placement, origin } = calculatePosition(anchorRect)

	useEffect(() => {
		const timer = requestAnimationFrame(() => setIsVisible(true))
		return () => cancelAnimationFrame(timer)
	}, [])

	useEffect(() => {
		if (cardRef.current && placement === 'above' && data) {
			const actualHeight = cardRef.current.offsetHeight
			cardRef.current.style.top = `${anchorRect.top - actualHeight - OFFSET}px`
		}
	}, [data, anchorRect, placement])

	return (
		<div
			style={{
				position: 'fixed',
				top,
				left,
				zIndex: Z_INDEXES.MAX,
				width: CARD_WIDTH,
				pointerEvents: 'auto',
			}}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
		>
			<ShadowWrapper className="!w-auto">
				{/* Safe Triangle for mouse movement */}
				<div
					className={cn(
						'absolute h-6 w-full bg-transparent',
						placement === 'above' ? 'top-full' : '-top-6'
					)}
				/>

				{/* Card Container */}
				<div
					ref={cardRef}
					className={cn(
						'rounded-xl bg-card border border-border shadow-2xl overflow-hidden',
						'transition-all duration-200 ease-out',
						isVisible
							? 'opacity-100 scale-100'
							: cn(
									'opacity-0 scale-95',
									placement === 'above' ? 'translate-y-2' : '-translate-y-2'
								)
					)}
					style={{ 
						transformOrigin: origin,
						borderRadius: 'var(--radius, 0.75rem)'
					}}
				>
					{isLoading ? (
						<MediaHoverCardSkeleton />
					) : error ? (
						<div className="flex items-center justify-center gap-2 py-8 px-6 text-muted-foreground">
							<AlertCircle className="w-5 h-5 text-destructive/70" />
							<span className="text-sm font-medium">Información no disponible</span>
						</div>
					) : data ? (
						<MediaHoverCardContent data={data} url={url} />
					) : null}
				</div>
			</ShadowWrapper>
		</div>
	)
}
