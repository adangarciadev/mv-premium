/**
 * User Finder
 *
 * Main component for managing user customizations in the dashboard.
 * Allows searching users, customizing their appearance, and configuring
 * global role colors.
 *
 * Subcomponents extracted for maintainability:
 * - user-cards.tsx: UserCard, CustomizedUserCard
 * - user-form-fields.tsx: Form field components
 * - edit-user-modal.tsx: EditUserModal, EditCustomizedUserModal
 * - global-settings-tab.tsx: GlobalSettingsTab
 */
import { useState, useEffect, useCallback } from 'react'
import { logger } from '@/lib/logger'
import { useUserSearch, type SearchedUser } from '@/features/users/hooks/use-user-search'
import {
	getUserCustomizations,
	saveUserCustomization,
	saveGlobalRoleSettings,
	watchUserCustomizations,
	removeUserCustomization,
	type UserCustomization,
	type GlobalRoleSettings,
} from '@/features/user-customizations/storage'
import Search from 'lucide-react/dist/esm/icons/search'
import UserX from 'lucide-react/dist/esm/icons/user-x'
import Settings2 from 'lucide-react/dist/esm/icons/settings-2'
import User from 'lucide-react/dist/esm/icons/user'

import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/lib/lazy-toast'
import { browser } from 'wxt/browser'
import { MV_ROLE_COLORS } from '@/constants'

// Extracted components
import { UserCard, CustomizedUserCard } from './user-cards'
import { EditUserModal, EditCustomizedUserModal } from './edit-user-modal'
import { GlobalSettingsTab } from './global-settings-tab'

export type { UserCustomization, GlobalRoleSettings }

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function UserFinder() {
	// Search state
	const [searchQuery, setSearchQuery] = useState('')
	const [debouncedQuery, setDebouncedQuery] = useState('')
	const [isStorageLoading, setIsStorageLoading] = useState(true)

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(searchQuery), 400)
		return () => clearTimeout(timer)
	}, [searchQuery])

	const { users, isLoading } = useUserSearch(debouncedQuery)

	// User customizations from storage
	const [userCustomizations, setUserCustomizations] = useState<Record<string, UserCustomization>>({})

	// Global settings from storage
	const [globalSettings, setGlobalSettings] = useState<GlobalRoleSettings>({
		adminColor: MV_ROLE_COLORS.ADMIN,
		subadminColor: MV_ROLE_COLORS.SUBADMIN,
		modColor: MV_ROLE_COLORS.MOD,
		userColor: MV_ROLE_COLORS.USER,
	})

	// Modal state
	const [editingUser, setEditingUser] = useState<SearchedUser | null>(null)
	const [editingCustomizedUser, setEditingCustomizedUser] = useState<string | null>(null)

	// Load initial data from storage
	useEffect(() => {
		const loadData = async () => {
			try {
				const data = await getUserCustomizations()
				setUserCustomizations(data.users)
				setGlobalSettings(data.globalSettings)
			} catch (error) {
				logger.error('Error loading user customizations:', error)
			} finally {
				setIsStorageLoading(false)
			}
		}
		loadData()

		// Watch for changes from other tabs/contexts
		const unwatch = watchUserCustomizations(data => {
			setUserCustomizations(data.users)
			setGlobalSettings(data.globalSettings)
		})

		return () => unwatch()
	}, [])

	// Save user customization to storage
	const handleSaveUser = useCallback(async (username: string, customization: UserCustomization) => {
		setUserCustomizations(prev => ({
			...prev,
			[username]: customization,
		}))

		try {
			await saveUserCustomization(username, customization)

			// Refresh all Mediavida tabs so customizations apply immediately
			try {
				const tabs = await browser.tabs.query({ url: '*://*.mediavida.com/*' })
				for (const tab of tabs) {
					if (tab.id) {
						browser.tabs.reload(tab.id)
					}
				}
			} catch (tabError) {
				logger.warn('Could not refresh tabs:', tabError)
			}
		} catch (error) {
			logger.error('Error saving user:', error)
			toast.error('Error al guardar', { description: 'No se pudo guardar la configuración.' })
		}
	}, [])

	// Save global settings to storage
	const handleSaveGlobalSettings = useCallback(async (settings: GlobalRoleSettings) => {
		setGlobalSettings(settings)

		try {
			await saveGlobalRoleSettings(settings)
		} catch (error) {
			logger.error('Error saving global settings:', error)
			toast.error('Error al guardar', { description: 'No se pudo guardar la configuración global.' })
		}
	}, [])

	// Delete user customization
	const handleDeleteUser = useCallback(async (username: string) => {
		setUserCustomizations(prev => {
			const next = { ...prev }
			delete next[username]
			return next
		})

		try {
			await removeUserCustomization(username)
			toast.success('Personalización eliminada', {
				description: `Se eliminó la configuración de ${username}`,
			})
		} catch (error) {
			logger.error('Error deleting user:', error)
			toast.error('Error al eliminar', { description: 'No se pudo eliminar la configuración.' })
		}
	}, [])

	const customizedUserCount = Object.keys(userCustomizations).length

	return (
		<div className="w-full max-w-5xl mx-auto space-y-6 pb-20">
			{/* Header */}
			<div className="space-y-1">
				<h1 className="text-2xl font-bold tracking-tight">Gestión de Usuarios</h1>
				<p className="text-muted-foreground text-sm">Personaliza cómo ves a otros usuarios en el foro.</p>
			</div>

			{/* Tabs */}
			<Tabs defaultValue="directory" className="w-full">
				<TabsList className="grid w-full grid-cols-3 mb-6">
					<TabsTrigger value="directory" className="gap-2">
						<Search className="h-4 w-4" />
						Directorio
					</TabsTrigger>
					<TabsTrigger value="customized" className="gap-2">
						<User className="h-4 w-4" />
						Personalizados
						{customizedUserCount > 0 && (
							<Badge className="ml-1 h-5 px-1.5 text-[10px] bg-primary text-primary-foreground font-bold shadow-sm">
								{customizedUserCount}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger value="settings" className="gap-2">
						<Settings2 className="h-4 w-4" />
						Ajustes Globales
					</TabsTrigger>
				</TabsList>

				{/* Tab 1: Directory */}
				<TabsContent value="directory" className="space-y-6">
					{/* Search */}
					<div className="relative max-w-md">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							className="pl-10"
							placeholder="Buscar usuario..."
							value={searchQuery}
							onChange={e => setSearchQuery(e.target.value)}
						/>
					</div>

					{/* Results Count */}
					{users.length > 0 && (
						<div className="text-sm text-muted-foreground">
							{users.length} usuarios encontrados para "{debouncedQuery}"
						</div>
					)}

					{/* Grid */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
						{users.map(user => (
							<UserCard
								key={user.value}
								user={user}
								customization={userCustomizations[user.data.nombre]}
								onEdit={() => setEditingUser(user)}
							/>
						))}
					</div>

					{/* Empty States */}
					{isLoading && <div className="text-center py-12 text-muted-foreground">Buscando...</div>}
					{!isLoading && debouncedQuery.length >= 3 && users.length === 0 && (
						<div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
							<UserX className="h-10 w-10 mx-auto mb-3 opacity-30" />
							<p>No se encontraron usuarios.</p>
						</div>
					)}
					{!isLoading && debouncedQuery.length < 3 && (
						<div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
							<Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
							<p>Escribe al menos 3 caracteres para buscar.</p>
						</div>
					)}
				</TabsContent>

				{/* Tab 2: Personalizados */}
				<TabsContent value="customized" className="space-y-6">
					<div className="space-y-2">
						<h3 className="text-lg font-semibold">Usuarios Personalizados</h3>
						<p className="text-sm text-muted-foreground">
							Usuarios a los que les has aplicado personalizaciones. Haz hover para editar o eliminar.
						</p>
					</div>

					{customizedUserCount > 0 ? (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
							{Object.entries(userCustomizations).map(([username, customization]) => (
								<CustomizedUserCard
									key={username}
									username={username}
									customization={customization}
									onEdit={() => setEditingCustomizedUser(username)}
									onDelete={() => handleDeleteUser(username)}
								/>
							))}
						</div>
					) : (
						<div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
							<User className="h-10 w-10 mx-auto mb-3 opacity-30" />
							<p>No tienes usuarios personalizados.</p>
							<p className="text-xs mt-1">Busca usuarios en el Directorio y personaliza su apariencia.</p>
						</div>
					)}
				</TabsContent>

				{/* Tab 3: Global Settings */}
				<TabsContent value="settings">
					<GlobalSettingsTab settings={globalSettings} onSave={handleSaveGlobalSettings} />
				</TabsContent>
			</Tabs>

			{/* Edit Modal for Directory users */}
			<EditUserModal
				user={editingUser}
				open={!!editingUser}
				onOpenChange={open => !open && setEditingUser(null)}
				initialCustomization={editingUser ? userCustomizations[editingUser.data.nombre] : undefined}
				onSave={handleSaveUser}
			/>

			{/* Edit Modal for Personalizados tab */}
			{editingCustomizedUser && (
				<EditCustomizedUserModal
					username={editingCustomizedUser}
					customization={userCustomizations[editingCustomizedUser] || {}}
					open={!!editingCustomizedUser}
					onOpenChange={open => !open && setEditingCustomizedUser(null)}
					onSave={handleSaveUser}
				/>
			)}
		</div>
	)
}
