import type { ReactNode } from 'react'
import CirclePause from 'lucide-react/dist/esm/icons/circle-pause'
import { cn } from '@/lib/utils'

interface PausedRulesOverlayProps {
	children: ReactNode
	disabled: boolean
	onActivate: () => void
	title: string
	actionLabel?: string
}

export function PausedRulesOverlay({
	children,
	disabled,
	onActivate,
	title,
	actionLabel = 'Activar reglas ->',
}: PausedRulesOverlayProps) {
	return (
		<div className="relative">
			<div className={cn(disabled && 'pointer-events-none select-none opacity-40 blur-[1.5px]')}>{children}</div>
			{disabled && (
				<div className="absolute inset-0 z-10 flex items-center justify-center p-4">
					<button
						type="button"
						onClick={onActivate}
						className="flex items-center gap-4 rounded-xl border bg-card/95 px-5 py-4 text-left shadow-lg backdrop-blur-sm transition-colors hover:bg-card"
					>
						<span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-background/70 text-primary">
							<CirclePause className="h-7 w-7" />
						</span>
						<span className="flex flex-col items-start">
							<span className="text-sm font-semibold text-foreground">{title}</span>
							<span className="text-xs font-medium text-primary">{actionLabel}</span>
						</span>
					</button>
				</div>
			)}
		</div>
	)
}
