import type { ToolbarButtonConfig } from '@/types/editor'
import { ToolbarButton } from './toolbar-button'

interface ToolbarGroupProps {
	buttons: ToolbarButtonConfig[]
	groupKey: string
	onButtonClick: (button: ToolbarButtonConfig) => void
	disabledButtons?: Record<string, boolean>
	highlightedButton?: string
	highlightTooltip?: string
	activeButtonIds?: string[]
}

export function ToolbarGroup({
	buttons,
	groupKey,
	onButtonClick,
	disabledButtons = {},
	highlightedButton,
	highlightTooltip,
	activeButtonIds = [],
}: ToolbarGroupProps) {
	if (buttons.length === 0) return null

	return (
		<div key={groupKey} className="flex items-center gap-0.5">
			{buttons.map(btn => {
				const isActive = btn.id === highlightedButton || activeButtonIds.includes(btn.id)

				return (
					<ToolbarButton
						key={btn.id}
						button={btn}
						onClick={onButtonClick}
						disabled={disabledButtons[btn.id]}
						highlighted={isActive}
						highlightTooltip={isActive ? highlightTooltip || 'Quitar formato' : undefined}
					/>
				)
			})}
		</div>
	)
}
