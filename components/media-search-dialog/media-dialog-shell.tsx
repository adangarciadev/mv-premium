/**
 * MediaDialogShell - Shared dialog frame for media search dialogs.
 * Provides: Dialog + DialogContent + DialogHeader (icon + title + close) + scrollable content area + footer slot.
 */

import X from 'lucide-react/dist/esm/icons/x'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const DIALOG_WIDTH = 540

interface MediaDialogShellProps {
	isOpen: boolean
	onClose: () => void
	icon: React.ReactNode
	title: string
	height?: number | 'auto'
	footer?: React.ReactNode
	children: React.ReactNode
}

export function MediaDialogShell({ isOpen, onClose, icon, title, height = 580, footer, children }: MediaDialogShellProps) {
	return (
		<Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
			<DialogContent
				showCloseButton={false}
				className="p-0 gap-0 overflow-hidden flex flex-col rounded-xl border-border bg-background shadow-2xl"
				style={{
					width: `${DIALOG_WIDTH}px`,
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
						<span className="truncate">{title}</span>
					</DialogTitle>
					<button
						onClick={onClose}
						className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
						title="Cerrar"
					>
						<X size={18} />
					</button>
				</DialogHeader>

				<div
					className="flex-1 overflow-y-auto overflow-x-hidden p-5 min-h-0 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
					onWheel={e => e.stopPropagation()}
				>
					{children}
				</div>

				{footer}
			</DialogContent>
		</Dialog>
	)
}
