/**
 * PreviewPanel Component
 * Right panel showing live BBCode preview with Mediavida styling
 */

import { Badge } from '@/components/ui/badge'
import { MVPreview } from '@/components/preview-system'
import { cn } from '@/lib/utils'
import type { PreviewPanelProps } from './types'

export function PreviewPanel({ content, boldColor, theme, showPreview, previewRef, badgeText }: PreviewPanelProps) {
	return (
		<div
			className={cn(
				'hidden lg:flex h-full flex-col rounded-r-lg border border-l-0 dark:bg-card overflow-hidden shrink-0 shadow-sm transition-all duration-500 ease-in-out',
				showPreview ? 'w-[700px] opacity-100 border-l border-border' : 'w-0 opacity-0 border-0'
			)}
		>
			{/* Header */}
			<div
				className={cn(
					'h-9 shrink-0 border-b flex items-center justify-between bg-muted/60 px-4 dark:bg-muted/30 transition-opacity duration-300',
					showPreview ? 'opacity-100' : 'opacity-0'
				)}
			>
				<span className="text-xs font-bold text-foreground/80 tracking-widest uppercase font-mediavida">
					Vista Previa
				</span>
				{badgeText ? (
					<Badge variant="outline" className="font-mono text-xs">
						{badgeText}
					</Badge>
				) : (
					<span className="text-xs text-muted-foreground font-mediavida">Estilo Mediavida</span>
				)}
			</div>

			{/* Preview Content */}
			<div className="flex-1 min-h-0 relative overflow-hidden">
				<div ref={previewRef} className="absolute inset-0 overflow-y-auto overflow-x-hidden p-4">
					<div className="mx-auto">
						<MVPreview
							content={content}
							boldColor={boldColor}
							theme={theme}
							fontSize={13}
							className="w-full max-w-[650px] shrink-0 p-4 font-mediavida leading-[1.6] [&_p]:mb-[1lh] [&_p:last-child]:mb-0"
						/>
					</div>
				</div>
			</div>
		</div>
	)
}
