import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ToolbarButtonConfig } from '@/types/editor'
import { getToolbarIcon } from './icons'

interface ToolbarButtonProps {
	button: ToolbarButtonConfig
	onClick: (button: ToolbarButtonConfig) => void
	disabled?: boolean
	highlighted?: boolean
	highlightTooltip?: string
}

export function ToolbarButton({
	button,
	onClick,
	disabled = false,
	highlighted = false,
	highlightTooltip,
}: ToolbarButtonProps) {
	const IconComponent = getToolbarIcon(button.icon)

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					onClick={() => onClick(button)}
					className={cn(
						'text-muted-foreground hover:text-foreground hover:bg-muted',
						highlighted && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
					)}
					disabled={disabled}
				>
					{IconComponent ? <IconComponent className="h-4 w-4" /> : <span>{button.label[0]}</span>}
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom" className="text-xs">
				{highlighted && highlightTooltip ? highlightTooltip : button.tooltip}
				{button.shortcut && <span className="ml-2 text-muted-foreground">{button.shortcut}</span>}
			</TooltipContent>
		</Tooltip>
	)
}
