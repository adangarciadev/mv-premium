/**
 * Edit User Modals
 *
 * Modal dialogs for editing user customizations.
 */
import { useState, useEffect } from 'react'
import PenLine from 'lucide-react/dist/esm/icons/pen-line'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import Save from 'lucide-react/dist/esm/icons/save'
import Eye from 'lucide-react/dist/esm/icons/eye'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import UserX from 'lucide-react/dist/esm/icons/user-x'
import type { SearchedUser } from '@/features/users/hooks/use-user-search'
import type { UserCustomization } from '@/features/user-customizations/storage'
import { getAvatarUrl } from '@/features/users/lib/mv-users'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/lib/lazy-toast'
import { cn } from '@/lib/utils'
import {
	NickCustomizationField,
	HighlightColorField,
	BadgeConfigField,
	NoteField,
	IgnoreUserField,
} from './user-form-fields'

// =============================================================================
// DEFAULT CUSTOMIZATION
// =============================================================================

const defaultCustomization: UserCustomization = {
	usernameCustom: '',
	usernameColour: '',
	badge: '',
	badgeColor: '#3b82f6',
	badgeTextColor: '#ffffff',
	badgeStyle: 'badge',
	isIgnored: false,
	note: '',
	highlightColor: '',
	ignoreType: 'hide',
}

// =============================================================================
// LIVE PREVIEW COMPONENT
// =============================================================================

interface LivePreviewProps {
	displayName: string
	originalName: string
	avatarSrc?: string
	customization: UserCustomization
}

function LivePreview({ displayName, originalName, avatarSrc, customization }: LivePreviewProps) {
	const nameColor = customization.usernameColour

	return (
		<div className="rounded-lg border-2 border-dashed border-primary/30 p-4 bg-muted/30">
			<div className="flex items-center gap-2 mb-3">
				<Eye className="h-4 w-4 text-primary" />
				<span className="text-xs font-medium text-primary">Vista Previa</span>
			</div>

			<div
				className={cn(
					'flex items-center gap-3 p-3 rounded-md bg-card border',
					customization.isIgnored && 'opacity-50 border-destructive/30'
				)}
			>
				<Avatar className="h-10 w-10 rounded-md border border-border">
					{avatarSrc && <AvatarImage src={avatarSrc} className="object-cover" />}
					<AvatarFallback className="rounded-md bg-muted text-sm font-medium text-muted-foreground">
						{originalName.charAt(0).toUpperCase()}
					</AvatarFallback>
				</Avatar>

				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<span className="font-semibold text-sm" style={{ color: nameColor }}>
							{displayName}
						</span>
						{customization.usernameCustom && <Sparkles className="h-3 w-3 text-yellow-500" />}
						{customization.badge &&
							(customization.badgeStyle === 'text' ? (
								<span
									className="text-[11px] opacity-70"
									style={{ color: customization.badgeColor || '#85939e' }}
								>
									{customization.badge}
								</span>
							) : (
								<Badge
									variant="secondary"
									className="text-[10px] px-1.5 py-0 h-4 rounded-sm"
									style={{
										backgroundColor: customization.badgeColor || 'var(--muted)',
										color: customization.badgeTextColor || undefined,
									}}
								>
									{customization.badge}
								</Badge>
							))}
					</div>
					{customization.usernameCustom && (
						<span className="text-xs text-muted-foreground line-through">{originalName}</span>
					)}
					{customization.isIgnored && (
						<span className="text-xs text-destructive flex items-center gap-1 mt-1">
							<UserX className="h-3 w-3" /> Usuario Ignorado
						</span>
					)}
				</div>
			</div>
		</div>
	)
}

// =============================================================================
// EDIT USER MODAL (For Directory - with SearchedUser)
// =============================================================================

interface EditUserModalProps {
	user: SearchedUser | null
	open: boolean
	onOpenChange: (open: boolean) => void
	initialCustomization?: UserCustomization
	onSave: (username: string, customization: UserCustomization) => void
}

export function EditUserModal({ user, open, onOpenChange, initialCustomization, onSave }: EditUserModalProps) {
	const [formData, setFormData] = useState<UserCustomization>(defaultCustomization)

	useEffect(() => {
		if (open && user) {
			setFormData(initialCustomization || defaultCustomization)
		}
	}, [open, user, initialCustomization])

	const handleReset = () => setFormData(defaultCustomization)

	const handleSave = () => {
		if (user) {
			const customizationWithAvatar: UserCustomization = {
				...formData,
				avatarUrl: getAvatarUrl(user.data.avatar),
			}
			onSave(user.data.nombre, customizationWithAvatar)
			toast.success('Cambios guardados', {
				description: `Configuración de ${user.data.nombre} actualizada.`,
			})
			onOpenChange(false)
		}
	}

	if (!user) return null

	const avatarSrc = getAvatarUrl(user.data.avatar)
	const displayName = formData.usernameCustom || user.data.nombre

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
				<DialogHeader className="px-6 pt-6 pb-2">
					<DialogTitle className="flex items-center gap-2">
						<PenLine className="h-5 w-5" />
						Personalizar Usuario
					</DialogTitle>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
					<LivePreview
						displayName={displayName}
						originalName={user.data.nombre}
						avatarSrc={avatarSrc}
						customization={formData}
					/>

					<Separator />

					<NickCustomizationField
						formData={formData}
						onChange={setFormData}
						usernamePlaceholder={user.data.nombre}
					/>

					<HighlightColorField formData={formData} onChange={setFormData} />

					<BadgeConfigField formData={formData} onChange={setFormData} />

					<NoteField formData={formData} onChange={setFormData} />

					<IgnoreUserField formData={formData} onChange={setFormData} />
				</div>

				<DialogFooter className="px-6 py-4 border-t bg-muted/20 flex-row justify-end gap-3">
					<Button variant="outline" onClick={handleReset}>
						<RotateCcw className="h-4 w-4 mr-2" />
						Reset
					</Button>
					<Button onClick={handleSave}>
						<Save className="h-4 w-4 mr-2" />
						Guardar
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

// =============================================================================
// EDIT CUSTOMIZED USER MODAL (For Personalizados tab - username only)
// =============================================================================

interface EditCustomizedUserModalProps {
	username: string
	customization: UserCustomization
	open: boolean
	onOpenChange: (open: boolean) => void
	onSave: (username: string, customization: UserCustomization) => void
}

export function EditCustomizedUserModal({
	username,
	customization,
	open,
	onOpenChange,
	onSave,
}: EditCustomizedUserModalProps) {
	const [formData, setFormData] = useState<UserCustomization>(customization)

	useEffect(() => {
		if (open) {
			setFormData(customization)
		}
	}, [open, customization])

	const handleReset = () => setFormData({})

	const handleSave = () => {
		onSave(username, formData)
		toast.success('Personalización guardada', { description: `Cambios guardados para ${username}` })
		onOpenChange(false)
	}

	const displayName = formData.usernameCustom || username

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
				<DialogHeader className="px-6 pt-6 pb-2">
					<DialogTitle className="flex items-center gap-2">
						<PenLine className="h-5 w-5" />
						Editar: {username}
					</DialogTitle>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
					<LivePreview
						displayName={displayName}
						originalName={username}
						avatarSrc={formData.avatarUrl}
						customization={formData}
					/>

					<Separator />

					<NickCustomizationField
						formData={formData}
						onChange={setFormData}
						usernamePlaceholder={username}
					/>

					<HighlightColorField formData={formData} onChange={setFormData} />

					<BadgeConfigField formData={formData} onChange={setFormData} />

					<NoteField formData={formData} onChange={setFormData} />

					<IgnoreUserField formData={formData} onChange={setFormData} />
				</div>

				<DialogFooter className="px-6 py-4 border-t bg-muted/20 flex-row justify-end gap-3">
					<Button variant="outline" onClick={handleReset}>
						<RotateCcw className="h-4 w-4 mr-2" />
						Reset
					</Button>
					<Button onClick={handleSave}>
						<Save className="h-4 w-4 mr-2" />
						Guardar
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
