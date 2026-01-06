/**
 * User Form Fields
 *
 * Shared form fields for user customization modals.
 * Extracted to avoid duplication between EditUserModal and EditCustomizedUserModal.
 */
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import VolumeX from 'lucide-react/dist/esm/icons/volume-x'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { UserCustomization } from '@/features/user-customizations/storage'

// =============================================================================
// TYPES
// =============================================================================

interface UserFormFieldsProps {
	formData: UserCustomization
	onChange: (data: UserCustomization) => void
	usernamePlaceholder: string
}

// =============================================================================
// NICK CUSTOMIZATION FIELD
// =============================================================================

export function NickCustomizationField({ formData, onChange, usernamePlaceholder }: UserFormFieldsProps) {
	return (
		<div className="grid grid-cols-3 gap-3">
			<div className="col-span-2 space-y-2">
				<Label>Nick Personalizado</Label>
				<Input
					placeholder={usernamePlaceholder}
					value={formData.usernameCustom || ''}
					onChange={e => onChange({ ...formData, usernameCustom: e.target.value || undefined })}
				/>
			</div>
			<div className="space-y-2">
				<Label>Color</Label>
				<div className="flex gap-1">
					<Input
						type="color"
						className="h-10 w-full p-1 cursor-pointer"
						value={formData.usernameColour || '#ffffff'}
						onChange={e => onChange({ ...formData, usernameColour: e.target.value })}
					/>
					<Button
						variant="ghost"
						size="icon"
						className="h-10 w-10 shrink-0"
						onClick={() => onChange({ ...formData, usernameColour: '' })}
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</div>
		</div>
	)
}

// =============================================================================
// HIGHLIGHT COLOR FIELD
// =============================================================================

interface HighlightColorFieldProps {
	formData: UserCustomization
	onChange: (data: UserCustomization) => void
}

export function HighlightColorField({ formData, onChange }: HighlightColorFieldProps) {
	return (
		<div className="space-y-2 pt-2 border-t">
			<Label className="text-sm font-semibold flex items-center gap-2">
				<div className="w-2 h-2 rounded-full bg-primary" />
				Resaltado de Post (Fondo)
			</Label>
			<div className="flex gap-2">
				<Input
					type="color"
					className="h-10 w-16 p-1 cursor-pointer"
					value={formData.highlightColor || '#1a1a1a'}
					onChange={e => onChange({ ...formData, highlightColor: e.target.value })}
				/>
				<Input
					placeholder="Ej: #1a1a1a o transparente"
					value={formData.highlightColor || ''}
					onChange={e => onChange({ ...formData, highlightColor: e.target.value })}
					className="flex-1"
				/>
				<Button
					variant="ghost"
					size="icon"
					className="h-10 w-10 shrink-0"
					onClick={() => onChange({ ...formData, highlightColor: '' })}
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>
			<p className="text-[11px] text-muted-foreground italic">
				Selecciona un color para destacar los mensajes de este usuario al hacer scroll.
			</p>
		</div>
	)
}

// =============================================================================
// BADGE CONFIGURATION FIELD
// =============================================================================

interface BadgeConfigFieldProps {
	formData: UserCustomization
	onChange: (data: UserCustomization) => void
}

export function BadgeConfigField({ formData, onChange }: BadgeConfigFieldProps) {
	const badgeStyle = formData.badgeStyle || 'badge'

	return (
		<div className="space-y-4 rounded-lg border p-4 bg-muted/30">
			<div className="flex items-center justify-between">
				<Label className="text-sm font-semibold">Configuración de Etiqueta</Label>
				<Tabs
					value={badgeStyle}
					onValueChange={v => onChange({ ...formData, badgeStyle: v as 'badge' | 'text' })}
					className="h-8"
				>
					<TabsList className="h-8 p-0.5">
						<TabsTrigger value="badge" className="text-[10px] h-7">
							Badge
						</TabsTrigger>
						<TabsTrigger value="text" className="text-[10px] h-7">
							Texto (Nativo)
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>

			<div className={badgeStyle === 'text' ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-4 gap-3'}>
				<div className={badgeStyle === 'text' ? 'space-y-2' : 'col-span-2 space-y-2'}>
					<Label className="text-xs">Texto de la etiqueta</Label>
					<Input
						placeholder="Ej: Amigo, VIP..."
						value={formData.badge || ''}
						onChange={e => onChange({ ...formData, badge: e.target.value || undefined })}
					/>
				</div>

				{badgeStyle === 'text' ? (
					<div className="space-y-2">
						<Label className="text-xs">Color del texto</Label>
						<Input
							type="color"
							className="h-10 w-full p-1 cursor-pointer"
							value={formData.badgeColor || '#85939e'}
							onChange={e => onChange({ ...formData, badgeColor: e.target.value })}
						/>
					</div>
				) : (
					<>
						<div className="space-y-2">
							<Label className="text-xs">Color fondo</Label>
							<Input
								type="color"
								className="h-10 w-full p-1 cursor-pointer"
								value={formData.badgeColor || '#3b82f6'}
								onChange={e => onChange({ ...formData, badgeColor: e.target.value })}
							/>
						</div>
						<div className="space-y-2">
							<Label className="text-xs">Color texto</Label>
							<Input
								type="color"
								className="h-10 w-full p-1 cursor-pointer"
								value={formData.badgeTextColor || '#ffffff'}
								onChange={e => onChange({ ...formData, badgeTextColor: e.target.value })}
							/>
						</div>
					</>
				)}
			</div>
		</div>
	)
}

// =============================================================================
// NOTE FIELD
// =============================================================================

interface NoteFieldProps {
	formData: UserCustomization
	onChange: (data: UserCustomization) => void
}

export function NoteField({ formData, onChange }: NoteFieldProps) {
	const noteLength = formData.note?.length || 0

	return (
		<div className="space-y-2">
			<div className="flex justify-between">
				<Label>Nota sobre el usuario (Privada)</Label>
				<span className={cn('text-xs', noteLength > 160 ? 'text-destructive' : 'text-muted-foreground')}>
					{noteLength}/160
				</span>
			</div>
			<Textarea
				placeholder="Escribe una nota para recordar quién es este usuario..."
				value={formData.note || ''}
				onChange={e => {
					const val = e.target.value
					if (val.length <= 160) onChange({ ...formData, note: val })
				}}
				className="resize-none h-20 text-sm"
			/>
		</div>
	)
}

// =============================================================================
// IGNORE USER FIELD
// =============================================================================

interface IgnoreUserFieldProps {
	formData: UserCustomization
	onChange: (data: UserCustomization) => void
}

export function IgnoreUserField({ formData, onChange }: IgnoreUserFieldProps) {
	return (
		<div className="space-y-3 p-3 rounded-md bg-destructive/5 border border-destructive/20">
			<div className="flex items-center justify-between">
				<div className="space-y-0.5">
					<Label className="text-destructive">Ignorar Usuario</Label>
					<p className="text-xs text-muted-foreground">Oculta o colapsa sus mensajes en el foro.</p>
				</div>
				<Switch
					checked={formData.isIgnored || false}
					onCheckedChange={checked => onChange({ ...formData, isIgnored: checked })}
				/>
			</div>

			{formData.isIgnored && (
				<div className="pt-2 border-t border-destructive/10">
					<Label className="text-[11px] uppercase tracking-wider font-semibold opacity-70 mb-2 block">
						Tipo de Ignore
					</Label>
					<Tabs
						value={formData.ignoreType || 'hide'}
						onValueChange={v => onChange({ ...formData, ignoreType: v as 'hide' | 'mute' })}
						className="w-full"
					>
						<TabsList className="grid grid-cols-2 h-9 p-1 bg-secondary/50">
							<TabsTrigger 
								value="hide" 
								className="text-xs h-7 gap-1.5 data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground data-[state=active]:shadow-sm"
							>
								<EyeOff className="h-3.5 w-3.5" />
								Ocultar
							</TabsTrigger>
							<TabsTrigger 
								value="mute" 
								className="text-xs h-7 gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
							>
								<VolumeX className="h-3.5 w-3.5" />
								Mutear
							</TabsTrigger>
						</TabsList>
					</Tabs>
					<p className="text-[10px] text-muted-foreground mt-2 italic">
						{formData.ignoreType === 'mute'
							? 'Se mostrará un aviso colapsado con opción a revelar el post.'
							: 'El mensaje desaparecerá por completo sin dejar rastro.'}
					</p>
				</div>
			)}
		</div>
	)
}
