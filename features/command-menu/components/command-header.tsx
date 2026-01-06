/**
 * CommandHeader Component
 * Premium header with glassmorphism effect for the command menu
 */

import { browser } from 'wxt/browser'

interface CommandHeaderProps {
	contextLabel: string
}

/**
 * Custom Premium Header - theme-aware with glassmorphism
 */
export function CommandHeader({ contextLabel }: CommandHeaderProps) {
	const iconUrl = browser.runtime.getURL('/icon/48.png')

	return (
		<div className="relative flex items-center border-b border-border/40 bg-background/50 px-5 py-3.5 backdrop-blur-xl shrink-0">
			<div className="flex items-center gap-2">
				<img
					src={iconUrl}
					className="h-5 w-5 object-contain brightness-110 drop-shadow-[0_0_4px_rgba(252,143,34,0.5)]"
					alt="MVPremium"
				/>
				<span className="text-sm font-bold tracking-tight select-none">
					<span className="font-bold italic tracking-tighter text-foreground">MV</span>
					<span className="font-black tracking-tight text-primary">PREMIUM</span>
				</span>
				<span className="text-xs text-muted-foreground/50 select-none">/</span>
				<span className="text-xs font-medium text-muted-foreground select-none">{contextLabel}</span>
			</div>
		</div>
	)
}
