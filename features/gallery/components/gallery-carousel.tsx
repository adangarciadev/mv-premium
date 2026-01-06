/**
 * GalleryCarousel - Fullscreen image/video gallery using Shadcn Carousel
 *
 * Displays images and videos in a fullscreen carousel with keyboard navigation.
 * Users can download individual images or right-click to save.
 */
import { useState, useCallback, useEffect } from 'react'
import { logger } from '@/lib/logger'
import X from 'lucide-react/dist/esm/icons/x'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Play from 'lucide-react/dist/esm/icons/play'
import Images from 'lucide-react/dist/esm/icons/images'
import Save from 'lucide-react/dist/esm/icons/save'
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { Button } from '@/components/ui/button'
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselPrevious,
	CarouselNext,
	type CarouselApi,
} from '@/components/ui/carousel'
import type { ThreadMedia } from '../lib/thread-scraper'

// =============================================================================
// TYPES
// =============================================================================

interface GalleryCarouselProps {
	media: ThreadMedia[]
	initialIndex?: number
	isOpen: boolean
	onClose: () => void
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * GalleryCarousel component - Fullscreen overlay for thread media navigation.
 * Uses Embla via Shadcn Carousel for smooth slide transitions and supports keyboard shortcuts.
 */
export function GalleryCarousel({ media, initialIndex = 0, isOpen, onClose }: GalleryCarouselProps) {
	const [api, setApi] = useState<CarouselApi>()
	const [currentIndex, setCurrentIndex] = useState(initialIndex)
	const [imageError, setImageError] = useState<Set<string>>(new Set())

	// Track current slide
	useEffect(() => {
		if (!api) return
		api.on('select', () => {
			setCurrentIndex(api.selectedScrollSnap())
		})
	}, [api])

	// Jump to initial index when opening
	useEffect(() => {
		if (api && isOpen) {
			api.scrollTo(initialIndex, true)
		}
	}, [api, initialIndex, isOpen])

	// Keyboard navigation
	useEffect(() => {
		if (!isOpen) return

		const handleKeyDown = (e: KeyboardEvent) => {
			switch (e.key) {
				case 'Escape':
					onClose()
					break
				case 'ArrowLeft':
					api?.scrollPrev()
					break
				case 'ArrowRight':
					api?.scrollNext()
					break
			}
		}

		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [isOpen, api, onClose])

	// Navigate to post
	const handleGoToPost = useCallback(
		(postLink: string) => {
			onClose()
			setTimeout(() => {
				window.location.hash = postLink
			}, 100)
		},
		[onClose]
	)

	// Handle image load error
	const handleImageError = useCallback((id: string) => {
		setImageError(prev => new Set(prev).add(id))
	}, [])

	// Open video in new tab
	const handleOpenVideo = useCallback((url: string) => {
		window.open(url, '_blank', 'noopener,noreferrer')
	}, [])

	// ===========================================================================
	// DOWNLOAD LOGIC (SINGLE IMAGE)
	// ===========================================================================
	const handleDownloadCurrent = async () => {
		const item = media[currentIndex]
		if (!item) return

		// For YouTube/Embed videos, open source in a new tab
		if (item.type === 'video' && (item.src.includes('youtube') || item.src.includes('youtu.be'))) {
			window.open(item.src, '_blank')
			return
		}

		try {
			const response = await fetch(item.src)
			if (!response.ok) throw new Error('Network response was not ok')
			const blob = await response.blob()

			let ext = item.src.split('.').pop()?.split('?')[0] || 'jpg'
			if (ext.length > 4) ext = 'jpg'

			const cleanAuthor = item.author.replace(/[^a-z0-9]/gi, '_')
			const filename = `${String(currentIndex + 1).padStart(3, '0')}_${cleanAuthor}.${ext}`

			const url = window.URL.createObjectURL(blob)
			const link = document.createElement('a')
			link.href = url
			link.download = filename
			document.body.appendChild(link)
			link.click()
			document.body.removeChild(link)
			window.URL.revokeObjectURL(url)
		} catch (e) {
			logger.error('Download failed, falling back to open', e)
			// Fallback: open in new tab if download fails (e.g. strict CORS)
			window.open(item.src, '_blank')
		}
	}

	if (!isOpen || media.length === 0) return null

	const currentMedia = media[currentIndex]

	return (
		<ShadowWrapper className="fixed inset-0 z-[99999]">
			{/* Backdrop */}
			<div className="fixed inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />

			{/* Gallery Container */}
			<div className="fixed inset-0 flex flex-col items-center justify-center p-4 pointer-events-none">
				{/* Header */}
				<div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-auto">
					<div className="flex items-center gap-2 text-white/80 text-sm">
						<Images className="w-4 h-4" />
						<span>
							{currentIndex + 1} de {media.length}
						</span>
					</div>

					<div className="flex items-center gap-2">
						<Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full" onClick={onClose}>
							<X className="w-5 h-5" />
						</Button>
					</div>
				</div>

				<div className="w-full max-w-5xl pointer-events-auto">
					<Carousel
						setApi={setApi}
						opts={{
							startIndex: initialIndex,
							loop: media.length > 1,
						}}
						className="w-full"
					>
						<CarouselContent>
							{media.map(item => (
								<CarouselItem key={item.id} className="flex items-center justify-center">
									<div className="relative w-full max-h-[70vh] flex items-center justify-center">
										{item.type === 'image' ? (
											// Image
											imageError.has(item.id) ? (
												<div className="flex flex-col items-center justify-center gap-2 text-white/50 bg-white/5 rounded-lg p-8">
													<Images className="w-12 h-12" />
													<span>Error al cargar imagen</span>
												</div>
											) : (
												<img
													src={item.src}
													alt={`Imagen de ${item.author}`}
													className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
													onError={() => handleImageError(item.id)}
													loading="lazy"
												/>
											)
										) : (
											// Video thumbnail
											<div className="relative cursor-pointer group" onClick={() => handleOpenVideo(item.src)}>
												<img
													src={item.thumbnail}
													alt={`Video de ${item.author}`}
													className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
													onError={() => handleImageError(item.id)}
												/>
												<div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors rounded-lg">
													<div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
														<Play className="w-8 h-8 text-white fill-white ml-1" />
													</div>
												</div>
											</div>
										)}
									</div>
								</CarouselItem>
							))}
						</CarouselContent>

						{/* Navigation Arrows */}
						{media.length > 1 && (
							<>
								<CarouselPrevious className="left-2 bg-white/10 hover:bg-white/20 border-0 text-white" />
								<CarouselNext className="right-2 bg-white/10 hover:bg-white/20 border-0 text-white" />
							</>
						)}
					</Carousel>
				</div>

				{/* Footer Info */}
				<div className="absolute bottom-4 left-4 right-4 pointer-events-auto">
					<div className="flex items-center justify-center gap-4 bg-black/90 border border-white/10 backdrop-blur-md rounded-lg px-5 py-3.5 max-w-md mx-auto shadow-xl">
						<span className="text-gray-300 text-sm">
							Publicado por <span className="text-white font-semibold">{currentMedia?.author}</span>
						</span>
						<Button
							variant="ghost"
							size="sm"
							className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 gap-1.5 font-medium"
							onClick={() => currentMedia && handleGoToPost(currentMedia.postLink)}
						>
							<ExternalLink className="w-3.5 h-3.5" />
							Ir al post
						</Button>
					</div>

					{/* Thumbnail Strip */}
					{media.length > 1 && media.length <= 20 && (
						<div className="flex items-center justify-center gap-1.5 mt-3 overflow-x-auto max-w-full pb-1">
							{media.map((item, index) => (
								<button
									key={item.id}
									onClick={() => api?.scrollTo(index)}
									className={`
                    relative flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-all
                    ${
											index === currentIndex
												? 'border-primary ring-2 ring-primary/50'
												: 'border-white/20 hover:border-white/40'
										}
                  `}
								>
									<img src={item.thumbnail || item.src} alt="" className="w-full h-full object-cover" />
									{item.type === 'video' && (
										<div className="absolute inset-0 flex items-center justify-center bg-black/40">
											<Play className="w-4 h-4 text-white fill-white" />
										</div>
									)}
								</button>
							))}
						</div>
					)}
				</div>
			</div>
		</ShadowWrapper>
	)
}
