/**
 * Page Indicator Component
 * Discourse-style vertical progress indicator for infinite scroll
 * Uses Tailwind CSS for styling (requires ShadowWrapper)
 */
interface PageIndicatorProps {
	currentPage: number
	totalPages: number
	maxLoadedPage: number
	isLoading: boolean
}

/**
 * PageIndicator component - A vertical progress bar that tracks the visible page position.
 */
export function PageIndicator({ currentPage, totalPages, maxLoadedPage, isLoading }: PageIndicatorProps) {
	// Progress based on current visible position
	const progress = Math.min((currentPage / totalPages) * 100, 100)

	// How much is loaded
	const loadedProgress = Math.min((maxLoadedPage / totalPages) * 100, 100)

	return (
		<div className="flex flex-col items-center gap-2 font-sans">
			{/* Current / Total */}
			<div className="flex items-baseline justify-center gap-0.5 text-xs">
				<span className="text-sm font-bold text-primary">{currentPage}</span>
				<span className="text-muted-foreground/50">/</span>
				<span className="font-medium text-muted-foreground">{totalPages}</span>
			</div>

			{/* Vertical Progress Bar */}
			<div className="relative w-1.5 h-20 bg-muted rounded-sm overflow-hidden border border-border">
				{/* Loaded background */}
				<div
					className="absolute top-0 left-0 w-full bg-foreground/10 rounded-sm transition-all duration-300"
					style={{ height: `${loadedProgress}%` }}
				/>

				{/* Current progress */}
				<div
					className="absolute top-0 left-0 w-full bg-primary rounded-sm transition-all duration-200 shadow-[0_0_6px_var(--primary)]"
					style={{ height: `${progress}%` }}
				/>
			</div>

			{/* Loading indicator */}
			{isLoading && <div className="text-[10px] text-primary animate-pulse">⋯</div>}
		</div>
	)
}
