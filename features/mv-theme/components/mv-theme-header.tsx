/**
 * MV Theme Header - Feature title and enable/disable toggle.
 */
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import Palette from 'lucide-react/dist/esm/icons/palette'
import Info from 'lucide-react/dist/esm/icons/info'

interface MvThemeHeaderProps {
	enabled: boolean
	onToggle: (enabled: boolean) => void
}

export function MvThemeHeader({ enabled, onToggle }: MvThemeHeaderProps) {
	return (
		<>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
						<Palette className="w-5 h-5 text-primary" />
					</div>
					<div>
						<h1 className="text-2xl font-bold tracking-tight">Tema de Mediavida</h1>
						<p className="text-sm text-muted-foreground">
							Personaliza los colores sobre tu tema actual de Mediavida
						</p>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<Label htmlFor="mv-theme-toggle" className="text-sm text-muted-foreground">
						{enabled ? 'Activado' : 'Desactivado'}
					</Label>
					<Switch
						id="mv-theme-toggle"
						checked={enabled}
						onCheckedChange={onToggle}
					/>
				</div>
			</div>

			{!enabled && (
				<Card className="border-dashed bg-muted/30">
					<CardContent className="flex items-center gap-3 py-4">
						<Info className="w-5 h-5 text-muted-foreground shrink-0" />
						<p className="text-sm text-muted-foreground">
							Activa esta funcionalidad para aplicar colores personalizados sobre tu tema actual de
							Mediavida.
							Los cambios se aplican en tiempo real sin necesidad de recargar la página.
						</p>
					</CardContent>
				</Card>
			)}
		</>
	)
}
