/**
 * Page Divider Component
 * Visual separator between pages in infinite scroll
 * Uses Tailwind CSS for styling (requires ShadowWrapper)
 */

interface PageDividerProps {
	pageNumber: number
}

/**
 * PageDivider component - A visual marker inserted between dynamically loaded thread pages.
 * Displays the page number in a centered pill with gradient lines.
 */
export function PageDivider({ pageNumber }: PageDividerProps) {
	return (
		<div className="flex items-center justify-center py-4 my-5 relative clear-both z-10 font-sans">
			{/* Left line */}
			<div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent max-w-32 mx-4 opacity-60" />

			{/* Page label */}
			<span className="px-3 py-1 bg-card text-muted-foreground text-[11px] font-semibold uppercase tracking-wider rounded-full border border-border shadow-sm">
				Página {pageNumber}
			</span>

			{/* Right line */}
			<div className="flex-1 h-px bg-gradient-to-l from-transparent via-border to-transparent max-w-32 mx-4 opacity-60" />
		</div>
	)
}
