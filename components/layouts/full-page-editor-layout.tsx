import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FullPageEditorLayoutProps {
	header: ReactNode
	sidebar?: ReactNode
	editorStack: ReactNode
	previewPanel: ReactNode
	showPreview: boolean
}

export function FullPageEditorLayout({
	header,
	sidebar,
	editorStack,
	previewPanel,
	showPreview,
}: FullPageEditorLayoutProps) {
	return (
		<div className="flex flex-col h-[calc(100vh-8rem)]">
			{/* Top Header Bar */}
			<div className="shrink-0 w-full max-w-[1368px] mx-auto pb-4 relative z-50">{header}</div>

			{/* Split View - 2 Columns */}
			<div className="flex flex-row justify-center flex-1 min-h-0 relative">
				{/* Optional Sidebar (Variables, etc) */}
				{sidebar}

				{/* Left Panel: Editor */}
				<div
					className={cn(
						'flex flex-col h-full min-h-0 bg-card border rounded-l-lg overflow-hidden shadow-sm transition-all duration-300 ease-in-out',
						showPreview ? 'flex-[1.5] border-border rounded-r-none' : 'flex-1 max-w-[900px] rounded-lg mx-auto',
						// If sidebar exists, add border logic for large screens
						sidebar && '2xl:border-l-0 2xl:rounded-l-none'
					)}
				>
					{editorStack}
				</div>

				{/* Right Panel: Preview */}
				{showPreview && <div className="relative flex-1 min-w-0">{previewPanel}</div>}
			</div>
		</div>
	)
}
