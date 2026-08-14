import type { ReactNode } from 'react'
import Info from 'lucide-react/dist/esm/icons/info'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface InfoPillProps {
	/** What is being explained, in two or three words. */
	title: string
	children: ReactNode
	side?: 'top' | 'right' | 'bottom' | 'left'
}

/**
 * A quiet "i" that opens one paragraph of plain explanation.
 *
 * Every figure on this page is derived from something the number itself cannot say: what counts as
 * published, which year the filter means, why a film shows a rewatch mark. A pill costs seventeen
 * pixels and removes a question, so they sit next to whatever raised it rather than in a help page
 * nobody opens.
 */
export function InfoPill({ title, children, side = 'bottom' }: InfoPillProps) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label={`Qué es: ${title}`}
					className="inline-flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<Info className="h-2.5 w-2.5" />
				</button>
			</PopoverTrigger>
			<PopoverContent side={side} align="start" className="w-[19rem]">
				<p className="mb-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-foreground">{title}</p>
				<div className="text-xs leading-relaxed text-muted-foreground">{children}</div>
			</PopoverContent>
		</Popover>
	)
}
