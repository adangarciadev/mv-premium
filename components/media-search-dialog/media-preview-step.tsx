/**
 * MediaPreviewStep - Preview section with cover image, info slot, Customize/Edit buttons, and template display.
 */

import Edit3 from 'lucide-react/dist/esm/icons/edit-3'
import Brush from 'lucide-react/dist/esm/icons/brush'
import { Textarea } from '@/components/ui/textarea'

interface MediaPreviewStepProps {
	/** Cover/poster image URL */
	coverUrl?: string | null
	/** Cover image height in pixels (default: 100) */
	coverHeight?: number
	/** Free-form info content: title, subtitle, genres, etc. */
	previewInfo: React.ReactNode
	/** Called when the "Customize" button is clicked */
	onCustomize: () => void
	/** Current template BBCode text */
	template: string
	/** Called when template text changes (edit mode) */
	onTemplateChange: (template: string) => void
	/** Whether the template is in edit mode */
	isEditing: boolean
	/** Toggle edit mode */
	onToggleEditing: () => void
	/** Optional referrer policy for the cover image */
	referrerPolicy?: React.HTMLAttributeReferrerPolicy
}

export function MediaPreviewStep({
	coverUrl,
	coverHeight = 100,
	previewInfo,
	onCustomize,
	template,
	onTemplateChange,
	isEditing,
	onToggleEditing,
	referrerPolicy,
}: MediaPreviewStepProps) {
	return (
		<div className="overflow-hidden">
			{/* Media info header */}
			<div className="mb-4 flex items-start gap-3 overflow-hidden rounded-lg border border-border bg-muted/15 p-3">
				{coverUrl && (
					<img
						src={coverUrl}
						alt=""
						referrerPolicy={referrerPolicy}
						className="w-[72px] shrink-0 rounded-md border border-border bg-muted object-cover shadow-sm"
						style={{ height: `${coverHeight}px` }}
					/>
				)}
				<div className="flex-1 min-w-0 overflow-hidden">{previewInfo}</div>
				<div className="flex gap-1.5 shrink-0">
					<button
						onClick={onCustomize}
						className="flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						title="Personalizar el formato de la plantilla"
					>
						<Brush className="w-3 h-3" />
						<span className="hidden sm:inline">Personalizar</span>
					</button>
					<button
						onClick={onToggleEditing}
						className="flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<Edit3 className="w-3 h-3" />
						{isEditing ? 'Ver' : 'Editar'}
					</button>
				</div>
			</div>

			{/* Template content */}
			{isEditing ? (
				<Textarea
					value={template}
					onChange={e => onTemplateChange(e.target.value)}
					onKeyDown={e => e.stopPropagation()}
					className="min-h-[190px] resize-y rounded-lg text-xs font-mono leading-relaxed !bg-card"
				/>
			) : (
				<div className="max-h-[190px] overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-card p-3 text-xs font-mono leading-relaxed text-foreground shadow-inner whitespace-pre-wrap break-words">
					{template}
				</div>
			)}
		</div>
	)
}
