/**
 * SettingRow - Reusable component for a settings row with icon, label, description, and control
 */
import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

export interface SettingRowProps {
	icon?: ReactNode
	label: string
	description: ReactNode
	children: ReactNode
}

export function SettingRow({ icon, label, description, children }: SettingRowProps) {
	return (
		<div className="flex items-center justify-between py-3">
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
