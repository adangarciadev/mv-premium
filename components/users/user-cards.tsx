/**
 * User Card Components
 *
 * Card components for displaying users in the UserFinder.
 */
import { useMemo } from 'react'
import PenLine from 'lucide-react/dist/esm/icons/pen-line'
import UserX from 'lucide-react/dist/esm/icons/user-x'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import { getAvatarUrl } from '@/features/users/lib/mv-users'
import type { SearchedUser } from '@/features/users/hooks/use-user-search'
import type { UserCustomization } from '@/features/user-customizations/storage'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

// =============================================================================
// USER CARD (For Directory tab)
// =============================================================================

interface UserCardProps {
	user: SearchedUser
	customization?: UserCustomization
	onEdit: () => void
}

export function UserCard({ user, customization, onEdit }: UserCardProps) {
	const avatarSrc = useMemo(() => {
		return getAvatarUrl(user.data.avatar)
	}, [user.data.avatar])

	const displayName = customization?.usernameCustom || user.data.nombre
	const nameColor = customization?.usernameColour

	return (
		<div
			className={cn(
				'group relative flex items-center gap-3 p-4 rounded-lg border bg-card transition-all hover:shadow-md hover:border-primary/30',
				customization?.isIgnored && 'opacity-50 border-destructive/30 bg-destructive/5'
			)}
		>
			{/* Avatar */}
			<Avatar className="h-10 w-10 rounded-md border border-border">
				<AvatarImage src={avatarSrc} className="object-cover" />
				<AvatarFallback className="rounded-md text-xs bg-muted">MV</AvatarFallback>
			</Avatar>

			{/* Info */}
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<span className="font-medium text-sm truncate" style={{ color: nameColor }}>
						{displayName}
					</span>
					{customization?.usernameCustom && <Sparkles className="h-3 w-3 text-yellow-500 shrink-0" />}
					<UserBadge customization={customization} />
				</div>
				{customization?.usernameCustom && (
					<span className="text-xs text-muted-foreground line-through">{user.data.nombre}</span>
				)}
			</div>

			{/* Edit Button */}
			<Button
				variant="ghost"
				size="icon"
				className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
				onClick={onEdit}
			>
				<PenLine className="h-4 w-4" />
			</Button>

			{/* Ignored Indicator */}
			{customization?.isIgnored && (
				<div className="absolute top-1 right-1">
					<UserX className="h-3 w-3 text-destructive" />
				</div>
			)}
		</div>
	)
}

// =============================================================================
// CUSTOMIZED USER CARD (For Personalizados tab)
// =============================================================================

interface CustomizedUserCardProps {
	username: string
	customization: UserCustomization
	onEdit: () => void
	onDelete: () => void
}

export function CustomizedUserCard({ username, customization, onEdit, onDelete }: CustomizedUserCardProps) {
	const displayName = customization.usernameCustom || username
	const nameColor = customization.usernameColour

	return (
		<div
			className={cn(
				'group relative flex items-center gap-3 p-4 rounded-lg border bg-card transition-all hover:shadow-md hover:border-primary/30',
				customization.isIgnored && 'opacity-70 border-destructive/30 bg-destructive/5'
			)}
		>
			{/* Avatar */}
			<Avatar className="h-10 w-10 rounded-md border border-border">
				{customization.avatarUrl ? (
					<AvatarImage src={customization.avatarUrl} className="object-cover" />
				) : null}
				<AvatarFallback className="rounded-md bg-muted text-sm font-medium text-muted-foreground">
					{username.charAt(0).toUpperCase()}
				</AvatarFallback>
			</Avatar>

			{/* Info */}
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<span className="font-medium text-sm truncate" style={{ color: nameColor }}>
						{displayName}
					</span>
					{customization.usernameCustom && <Sparkles className="h-3 w-3 text-yellow-500 shrink-0" />}
					<UserBadge customization={customization} />
					{customization.isIgnored && (
						<Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
							Ignorado
						</Badge>
					)}
				</div>
				{customization.usernameCustom && (
					<span className="text-xs text-muted-foreground line-through">{username}</span>
				)}
			</div>

			{/* Actions */}
			<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
				<Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
					<PenLine className="h-3.5 w-3.5" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="h-7 w-7 text-destructive hover:text-destructive"
					onClick={onDelete}
				>
					<Trash2 className="h-3.5 w-3.5" />
				</Button>
			</div>
		</div>
	)
}

// =============================================================================
// USER BADGE (Shared helper)
// =============================================================================

interface UserBadgeProps {
	customization?: UserCustomization
}

function UserBadge({ customization }: UserBadgeProps) {
	if (!customization?.badge) return null

	if (customization.badgeStyle === 'text') {
		return (
			<span
				className="text-[11px] opacity-70 ml-1"
				style={{ color: customization.badgeColor || '#85939e' }}
			>
				{customization.badge}
			</span>
		)
	}

	return (
		<Badge
			variant="secondary"
			className="text-[10px] px-1.5 py-0 h-4 shrink-0 rounded-sm"
			style={{
				backgroundColor: customization.badgeColor || 'var(--muted)',
				color: customization.badgeTextColor || undefined,
			}}
		>
			{customization.badge}
		</Badge>
	)
}
