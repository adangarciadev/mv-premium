/**
 * GIF Picker - Toolbar button to search and insert GIFs from GIPHY
 *
 * OPTIMIZATION: Uses native fetch + useState instead of useInfiniteQuery
 * to eliminate TanStack Query from the content script bundle.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Sticker from 'lucide-react/dist/esm/icons/sticker'
import {
	getTrendingGifs,
	searchGifs,
	GIFS_PER_PAGE,
	type GiphyGif,
	type GiphyPaginatedResponse,
} from '@/services/api/giphy'
import { useDebounce } from 'use-debounce'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface GifPickerProps {
	onInsert: (bbcode: string) => void
	className?: string
	variant?: 'shadcn' | 'native'
}

/**
 * GifPicker component - Search and insert GIFs from GIPHY.
 * Optimized performance: Uses native fetch and state to minimize TanStack Query overhead in content scripts.
 */
export function GifPicker({ onInsert, className, variant = 'shadcn' }: GifPickerProps) {
	const [isOpen, setIsOpen] = useState(false)
	const [query, setQuery] = useState('')

	// Debounce search query by 500ms
	const [debouncedQuery] = useDebounce(query.trim(), 500)

	// State for GIFs
	const [gifs, setGifs] = useState<GiphyGif[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [isFetchingMore, setIsFetchingMore] = useState(false)
	const [isError, setIsError] = useState(false)
	const [hasNextPage, setHasNextPage] = useState(true)
	const [offset, setOffset] = useState(0)

	const inputRef = useRef<HTMLInputElement>(null)
	const loadMoreRef = useRef<HTMLDivElement>(null)
	const isMountedRef = useRef(true)
	const lastQueryRef = useRef('')

	// =========================================================================
	// Lifecycle
	// =========================================================================

	useEffect(() => {
		isMountedRef.current = true
		return () => {
			isMountedRef.current = false
		}
	}, [])

	// =========================================================================
	// Fetch GIFs
	// =========================================================================

	/**
	 * Orchestrates the GIPHY API request for trending or search results.
	 * Handles pagination through the 'append' parameter.
	 */
	const fetchGifs = useCallback(async (searchQuery: string, pageOffset: number, append = false) => {
		if (!append) {
			setIsLoading(true)
		} else {
			setIsFetchingMore(true)
		}
		setIsError(false)

		try {
			const response: GiphyPaginatedResponse = searchQuery
				? await searchGifs(searchQuery, pageOffset)
				: await getTrendingGifs(pageOffset)

			if (isMountedRef.current) {
				if (append) {
					setGifs(prev => [...prev, ...response.gifs])
				} else {
					setGifs(response.gifs)
				}
				setOffset(pageOffset + GIFS_PER_PAGE)
				setHasNextPage(pageOffset + GIFS_PER_PAGE < response.pagination.totalCount)
			}
		} catch (err) {
			if (isMountedRef.current) {
				setIsError(true)
			}
		} finally {
			if (isMountedRef.current) {
				setIsLoading(false)
				setIsFetchingMore(false)
			}
		}
	}, [])

	// =========================================================================
	// Effects: Fetch on open or query change
	// =========================================================================

	useEffect(() => {
		if (!isOpen) return

		// Reset and fetch when query changes
		if (lastQueryRef.current !== debouncedQuery) {
			lastQueryRef.current = debouncedQuery
			setGifs([])
			setOffset(0)
			setHasNextPage(true)
			fetchGifs(debouncedQuery, 0, false)
		}
	}, [isOpen, debouncedQuery, fetchGifs])

	// Initial fetch when popover opens
	// NOTE: Intentionally only depends on isOpen - this is a "mount once" effect
	// that should only trigger when the popover opens, not when gifs/isLoading/query change
	useEffect(() => {
		if (isOpen && gifs.length === 0 && !isLoading) {
			lastQueryRef.current = debouncedQuery
			fetchGifs(debouncedQuery, 0, false)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: only run on popover open
	}, [isOpen])

	// =========================================================================
	// IntersectionObserver: Load more when sentinel is visible
	// =========================================================================

	useEffect(() => {
		const sentinel = loadMoreRef.current
		if (!sentinel || !isOpen) return

		const observer = new IntersectionObserver(
			entries => {
				const [entry] = entries
				if (entry.isIntersecting && hasNextPage && !isFetchingMore && !isLoading) {
					fetchGifs(debouncedQuery, offset, true)
				}
			},
			{
				root: null,
				rootMargin: '100px',
				threshold: 0,
			}
		)

		observer.observe(sentinel)
		return () => observer.disconnect()
	}, [isOpen, hasNextPage, isFetchingMore, isLoading, debouncedQuery, offset, fetchGifs])

	// =========================================================================
	// Focus input when popover opens
	// =========================================================================

	useEffect(() => {
		if (isOpen && inputRef.current) {
			setTimeout(() => inputRef.current?.focus(), 100)
		}
	}, [isOpen])

	// =========================================================================
	// Reset state when popover closes
	// =========================================================================

	useEffect(() => {
		if (!isOpen) {
			// Reset state when closed
			setQuery('')
			setGifs([])
			setOffset(0)
			setHasNextPage(true)
			lastQueryRef.current = ''
		}
	}, [isOpen])

	// =========================================================================
	// Handlers
	// =========================================================================

	const handleGifClick = useCallback(
		(gif: GiphyGif) => {
			onInsert(`[img]${gif.url}[/img]`)
			setIsOpen(false)
		},
		[onInsert]
	)

	const TriggerButton = (
		<button
			type="button"
			className={cn(
				variant === 'native'
					? 'mvp-toolbar-btn'
					: 'flex items-center justify-center h-8 w-8 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer',
				className
			)}
			title={variant === 'native' ? 'Insertar GIF' : undefined}
		>
			<Sticker className={variant === 'native' ? 'w-4 h-4' : 'h-4 w-4'} />
		</button>
	)

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen} modal={false}>
			{variant === 'shadcn' ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<PopoverTrigger asChild>{TriggerButton}</PopoverTrigger>
					</TooltipTrigger>
					<TooltipContent side="bottom" className="text-xs">
						Insertar GIF
					</TooltipContent>
				</Tooltip>
			) : (
				<PopoverTrigger asChild>{TriggerButton}</PopoverTrigger>
			)}
			<PopoverContent className="w-80 p-0" align="start" sideOffset={5}>
				<div className="flex flex-col h-96">
					{/* Header - Search Input */}
					<div className="p-3 border-b border-border">
						<Input
							ref={inputRef}
							type="text"
							placeholder="Buscar GIFs..."
							value={query}
							onChange={e => setQuery(e.target.value)}
							className="h-8"
						/>
					</div>

					{/* Body - GIF Grid */}
					<div className="flex-1 overflow-y-auto">
						<div className="p-2">
							{isLoading ? (
								// Initial Loading Skeletons
								<div className="grid grid-cols-3 gap-2">
									{Array.from({ length: 9 }).map((_, i) => (
										<Skeleton key={i} className="aspect-square rounded" />
									))}
								</div>
							) : isError ? (
								// Error State
								<div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
									Error al cargar GIFs
								</div>
							) : gifs.length === 0 ? (
								// Empty State
								<div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
									No se encontraron GIFs
								</div>
							) : (
								<>
									{/* GIF Grid */}
									<div className="grid grid-cols-3 gap-2">
										{gifs.map(gif => (
											<button
												key={gif.id}
												type="button"
												onClick={() => handleGifClick(gif)}
												className="relative aspect-square rounded overflow-hidden bg-muted hover:ring-2 hover:ring-primary transition-all cursor-pointer group"
												title={gif.title}
											>
												<img
													src={gif.previewUrl}
													alt={gif.title}
													className="w-full h-full object-cover"
													loading="lazy"
												/>
												<div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
											</button>
										))}
									</div>

									{/* Sentinel for IntersectionObserver */}
									<div ref={loadMoreRef} className="h-4" />

									{/* Loading More Indicator */}
									{isFetchingMore && (
										<div className="flex items-center justify-center py-4">
											<Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
										</div>
									)}

									{/* End of results */}
									{!hasNextPage && gifs.length > 0 && (
										<div className="text-center py-3 text-xs text-muted-foreground">No hay más GIFs</div>
									)}
								</>
							)}
						</div>
					</div>

					{/* Footer - GIPHY Attribution */}
					<div className="px-3 py-2 border-t border-border flex items-center justify-center gap-1.5 bg-muted/30">
						<span className="text-[10px] text-muted-foreground">Powered by</span>
						<img src="https://giphy.com/static/img/giphy_logo_square_social.png" alt="GIPHY" className="h-4" />
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
