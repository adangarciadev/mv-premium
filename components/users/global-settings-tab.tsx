/**
 * Global Settings Tab
 *
 * Role color configuration for the UserFinder.
 */
import { useState, useEffect } from 'react'
import Shield from 'lucide-react/dist/esm/icons/shield'
import Crown from 'lucide-react/dist/esm/icons/crown'
import Gavel from 'lucide-react/dist/esm/icons/gavel'
import User from 'lucide-react/dist/esm/icons/user'
import Settings2 from 'lucide-react/dist/esm/icons/settings-2'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import Save from 'lucide-react/dist/esm/icons/save'
import type { GlobalRoleSettings } from '@/features/user-customizations/storage'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { toast } from '@/lib/lazy-toast'
import { MV_ROLE_COLORS } from '@/constants'

// =============================================================================
// CONSTANTS
// =============================================================================

const defaultSettings: GlobalRoleSettings = {
	adminColor: MV_ROLE_COLORS.ADMIN,
	subadminColor: MV_ROLE_COLORS.SUBADMIN,
	modColor: MV_ROLE_COLORS.MOD,
	userColor: MV_ROLE_COLORS.USER,
}

const roleConfig = [
	{
		key: 'adminColor' as const,
		label: 'Administradores',
		icon: Crown,
		description: 'Gestores de Mediavida',
		defaultColor: MV_ROLE_COLORS.ADMIN,
	},
	{
		key: 'subadminColor' as const,
		label: 'Subadministradores',
		icon: Shield,
		description: 'Ayudantes de administración',
		defaultColor: MV_ROLE_COLORS.SUBADMIN,
	},
	{
		key: 'modColor' as const,
		label: 'Moderadores',
		icon: Gavel,
		description: 'Moderación de foros',
		defaultColor: MV_ROLE_COLORS.MOD,
	},
	{
		key: 'userColor' as const,
		label: 'Usuarios',
		icon: User,
		description: 'Usuarios registrados',
		defaultColor: MV_ROLE_COLORS.USER,
	},
]

// =============================================================================
// COMPONENT
// =============================================================================

interface GlobalSettingsTabProps {
	settings: GlobalRoleSettings
	onSave: (settings: GlobalRoleSettings) => void
}

export function GlobalSettingsTab({ settings, onSave }: GlobalSettingsTabProps) {
	const [localSettings, setLocalSettings] = useState(settings)
	const [isDirty, setIsDirty] = useState(false)

	useEffect(() => {
		setLocalSettings(settings)
		setIsDirty(false)
	}, [settings])

	const handleColorChange = (key: keyof GlobalRoleSettings, value: string) => {
		setLocalSettings(prev => ({ ...prev, [key]: value }))
		setIsDirty(true)
	}

	const handleSave = () => {
		onSave(localSettings)
		setIsDirty(false)
		toast.success('Configuración global guardada', {
			description: 'Los colores de roles se aplicarán a todos los usuarios.',
		})
	}

	const handleResetAll = () => {
		setLocalSettings(defaultSettings)
		setIsDirty(true)
		toast.success('Configuración restaurada', {
			description: 'Pulsa guardar para aplicar los cambios.',
		})
	}

	return (
		<div className="space-y-8">
			<div className="space-y-1">
				<h3 className="text-lg font-semibold flex items-center gap-2">
					<Settings2 className="h-5 w-5 text-primary" />
					Configuración de Roles
				</h3>
				<p className="text-sm text-muted-foreground">
					Personaliza los colores globales para cada grupo de usuarios. Estos colores se usarán si el
					usuario no tiene una personalización individual.
				</p>
			</div>

			<div className="grid gap-3">
				{roleConfig.map(role => {
					const Icon = role.icon
					const color = localSettings[role.key] || role.defaultColor

					return (
						<div
							key={role.key}
							className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border bg-card/50 hover:bg-card hover:shadow-sm transition-all gap-4"
						>
							<div className="flex items-start gap-4">
								<div className="p-2.5 rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
									<Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
								</div>
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<Label className="text-base font-medium">{role.label}</Label>
										{localSettings[role.key] !== role.defaultColor && (
											<Badge variant="secondary" className="text-[10px] h-4 px-1">
												Modificado
											</Badge>
										)}
									</div>
									<p className="text-xs text-muted-foreground">{role.description}</p>
								</div>
							</div>

							<div className="flex items-center gap-4 pl-12 sm:pl-0">
								{/* Live Preview */}
								<div className="hidden sm:block px-3 py-1.5 rounded-md bg-muted/30 border border-transparent group-hover:border-border transition-colors">
									<span className="text-sm font-medium" style={{ color }}>
										{role.label}
									</span>
								</div>

								<div className="flex items-center gap-2">
									<div className="relative">
										<div
											className="h-9 w-9 rounded-full border shadow-sm flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 hover:ring-ring transition-all"
											style={{ backgroundColor: color }}
										>
											<Input
												type="color"
												className="absolute inset-0 w-full h-full opacity-0 cursor-pointer p-0 border-0"
												value={color}
												onChange={e => handleColorChange(role.key, e.target.value)}
											/>
										</div>
									</div>

									<Button
										variant="ghost"
										size="icon"
										className="h-9 w-9 text-muted-foreground hover:text-foreground"
										onClick={() => handleColorChange(role.key, role.defaultColor)}
										disabled={color === role.defaultColor}
										title="Restaurar color original"
									>
										<RotateCcw className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</div>
					)
				})}
			</div>

			<div className="flex items-center justify-between pt-4 border-t">
				<Button
					variant="outline"
					onClick={handleResetAll}
					className="border text-muted-foreground hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30"
				>
					<RotateCcw className="h-4 w-4 mr-2" />
					Restaurar valores
				</Button>

				<Button onClick={handleSave} disabled={!isDirty} className="min-w-[140px] shadow-sm">
					<Save className="h-4 w-4 mr-2" />
					Guardar Cambios
				</Button>
			</div>
		</div>
	)
}
