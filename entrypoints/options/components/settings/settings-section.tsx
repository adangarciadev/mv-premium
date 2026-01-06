/**
 * SettingsSection - Wrapper component for settings category content
 * Used in the new vertical tabs layout
 */
import { Separator } from '@/components/ui/separator'

export interface SettingsSectionProps {
	title: string
	description: string
	children: React.ReactNode
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h2 className="text-xl font-semibold tracking-tight">{title}</h2>
				<p className="text-sm text-muted-foreground mt-1">{description}</p>
			</div>
			
			<Separator className="my-6" />
			
			{/* Content */}
			<div className="space-y-4">
				{children}
			</div>
		</div>
	)
}
