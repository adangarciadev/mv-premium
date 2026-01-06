import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { LucideIcon } from 'lucide-react'

interface DropdownOption {
	id: string
	label: string
	icon?: LucideIcon
	description?: string
}

interface ToolbarDropdownProps {
	icon: LucideIcon
	tooltip: string
	label?: string
	options: DropdownOption[]
	onSelect: (option: DropdownOption) => void
	menuLabel?: string
	className?: string
	contentClassName?: string
}

export function ToolbarDropdown({
	icon: Icon,
	tooltip,
	label,
	options,
	onSelect,
	menuLabel,
	className = 'w-48',
	contentClassName,
}: ToolbarDropdownProps) {
	return (
		<DropdownMenu modal={false}>
			<Tooltip>
				<TooltipTrigger asChild>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size={label ? 'sm' : 'icon-sm'}
							className={`text-muted-foreground hover:text-foreground ${label ? 'h-7 px-2 gap-1' : ''}`}
						>
							<Icon className="h-4 w-4" />
							{label && <span className="text-xs">{label}</span>}
						</Button>
					</DropdownMenuTrigger>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="text-xs">
					{tooltip}
				</TooltipContent>
			</Tooltip>
			<DropdownMenuContent align="start" className={`${className} ${contentClassName || ''}`}>
				{menuLabel && (
					<>
						<DropdownMenuLabel>{menuLabel}</DropdownMenuLabel>
						<DropdownMenuSeparator />
					</>
				)}
				{options.map(option => (
					<DropdownMenuItem key={option.id} onClick={() => onSelect(option)} className={option.icon ? 'gap-2' : ''}>
						{option.icon && <option.icon className="h-4 w-4" />}
						{option.description ? (
							<div className="flex flex-col">
								<span>{option.label}</span>
								<span className="text-xs text-muted-foreground">{option.description}</span>
							</div>
						) : (
							<span>{option.label}</span>
						)}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
