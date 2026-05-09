/**
 * MediaEmptyState - Empty or initial state with centered icon and text.
 */

import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'

interface MediaEmptyStateProps {
	icon: React.ReactNode
	text: string
}

export function MediaEmptyState({ icon, text }: MediaEmptyStateProps) {
	return (
		<div className="rounded-lg border border-dashed border-border bg-muted/15 px-5 py-10 text-center">
			<div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-background shadow-sm">
				{icon}
			</div>
			<p className="m-0 text-[13px] text-muted-foreground">{text}</p>
		</div>
	)
}

/** Inline error banner for search errors */
export function MediaSearchError({ error }: { error: string }) {
	return (
		<div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-[13px] text-destructive">
			<AlertCircle className="h-4 w-4 shrink-0" />
			{error}
		</div>
	)
}
