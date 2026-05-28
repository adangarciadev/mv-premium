/**
 * SettingRow - Reusable component for a settings row with icon, label, description, and control
 */
import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface SettingRowProps {
	settingId?: string
	icon?: ReactNode
	label: string
	description: ReactNode
	children: ReactNode
	className?: string
	hidden?: boolean
	highlighted?: boolean
}

export function SettingRow({
	settingId,
	icon,
	label,
	description,
	children,
	className,
	hidden,
	highlighted,
}: SettingRowProps) {
	return (
		<div
			id={settingId ? `setting-${settingId}` : undefined}
			data-setting-id={settingId}
			className={cn(
				'-mx-2 flex scroll-mt-28 items-center justify-between rounded-lg border border-transparent px-2 py-3 transition-colors',
				highlighted && 'border-primary/50 bg-primary/10 shadow-sm ring-1 ring-primary/20',
				hidden && 'hidden',
				className
			)}
		>
			<div className="flex items-start gap-3">
				{icon && <div className="mt-0.5 text-muted-foreground">{icon}</div>}
				<div className="space-y-0.5">
					<Label className="text-sm font-medium">{label}</Label>
					<div className="text-xs text-muted-foreground max-w-md">{description}</div>
				</div>
			</div>
			<div className="shrink-0">{children}</div>
		</div>
	)
}
