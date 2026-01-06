/**
 * ShortcutKeys Component
 * Renders formatted keyboard shortcut keys
 */

import React from 'react'
import { Kbd } from '@/components/ui/kbd'

interface ShortcutKeysProps {
	shortcut?: string
}

/**
 * Helper to render formatted shortcut keys (theme-aware with primary accent)
 */
export function ShortcutKeys({ shortcut }: ShortcutKeysProps) {
	if (!shortcut) return null

	const keys = shortcut.split('+')

	return (
		<div className="hidden sm:flex items-center gap-1.5 ml-auto">
			{keys.map((key, i, arr) => (
				<React.Fragment key={i}>
					<Kbd className="bg-muted border-border min-w-[28px] h-7 text-center px-2 text-[11px] font-bold text-foreground/80 shadow-sm shadow-black/10 transition-all duration-200 group-hover:bg-primary/20 group-hover:text-primary group-hover:border-primary/20 group-data-[selected=true]:bg-primary/20 group-data-[selected=true]:text-primary group-data-[selected=true]:border-primary/20">
						{formatKeyName(key)}
					</Kbd>
					{i < arr.length - 1 && <span className="text-muted-foreground/40 text-xs font-black">+</span>}
				</React.Fragment>
			))}
		</div>
	)
}

/**
 * Format key name for display
 */
function formatKeyName(key: string): string {
	switch (key) {
		case 'Meta':
		case '⌘':
			return '⌘'
		case 'Control':
		case 'Ctrl':
			return 'Ctrl'
		case 'Alt':
			return 'Alt'
		case 'Shift':
			return 'Shift'
		default:
			return key
	}
}
