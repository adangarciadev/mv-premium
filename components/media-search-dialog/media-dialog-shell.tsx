/**
 * MediaDialogShell - Shared dialog frame for media search dialogs.
 * Provides: Dialog + DialogContent + DialogHeader (icon + title + close) + scrollable content area + footer slot.
 */

import X from 'lucide-react/dist/esm/icons/x'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const DIALOG_WIDTH = 540

interface MediaDialogShellProps {
	isOpen: boolean
	onClose: () => void
	icon: React.ReactNode
	title: string
	/** Optional subtitle under the title, for dialogs whose step needs explaining. */
	description?: React.ReactNode
	height?: number | 'auto'
	/** Overrides the default 540px frame; wider dialogs (e.g. a form beside a live preview) pass their own. */
	width?: number
	/** Blocks the close button and backdrop dismissal, e.g. while an upload is in flight. */
	closeDisabled?: boolean
	footer?: React.ReactNode
	contentClassName?: string
	children: React.ReactNode
}

export function MediaDialogShell({
	isOpen,
	onClose,
	icon,
	title,
	description,
	height = 580,
	width = DIALOG_WIDTH,
	closeDisabled,
	footer,
	contentClassName,
	children,
}: MediaDialogShellProps) {
	return (
		<Dialog open={isOpen} onOpenChange={open => !open && !closeDisabled && onClose()}>
			<DialogContent
				showCloseButton={false}
				className="p-0 gap-0 overflow-hidden flex flex-col rounded-xl border-border bg-background shadow-2xl"
				style={{
					width: `${width}px`,
					height: typeof height === 'number' ? `${height}px` : height,
					minHeight: '200px',
					maxWidth: '95vw',
					maxHeight: '85vh',
					zIndex: 99999,
				}}
			>
				<DialogHeader className="relative flex shrink-0 flex-row items-center justify-between overflow-hidden border-b border-border bg-gradient-to-r from-background via-muted/20 to-background px-5 py-4">
					<DialogTitle className="flex min-w-0 items-center gap-3 text-[15px] font-semibold text-foreground">
						<div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/15 text-primary shadow-sm">
							{icon}
						</div>
						<span className="min-w-0">
							<span className="block truncate">{title}</span>
							{description && (
								<span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">{description}</span>
							)}
						</span>
					</DialogTitle>
					<button
						onClick={onClose}
						disabled={closeDisabled}
						className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent bg-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
						title="Cerrar"
					>
						<X size={18} />
					</button>
				</DialogHeader>

				<div
					className={cn(
						'flex-1 overflow-y-auto overflow-x-hidden p-5 min-h-0 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent',
						contentClassName
					)}
					style={{ scrollbarGutter: 'stable' }}
					onWheel={e => e.stopPropagation()}
				>
					{children}
				</div>

				{footer}
			</DialogContent>
		</Dialog>
	)
}
