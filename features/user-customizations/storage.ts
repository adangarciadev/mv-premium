/**
 * User Customizations Storage
 * Persistencia de personalizaciones de usuarios
 *
 * Refactored to use @wxt-dev/storage (API unificada)
 */
import { storage } from '#imports'
import { logger } from '@/lib/logger'
import { STORAGE_KEYS, MV_ROLE_COLORS } from '@/constants'

// ============================================================================
// TYPES
// ============================================================================

export interface UserCustomization {
	usernameCustom?: string
	usernameColour?: string
	badge?: string
	badgeColor?: string
	badgeTextColor?: string
	badgeStyle?: 'badge' | 'text' // 'badge' (current) or 'text' (native span.ct)
	isIgnored?: boolean
	avatarUrl?: string // Cached avatar URL for display in dashboard
	note?: string // Private note about the user
	highlightColor?: string // Custom background color for posts
	ignoreType?: 'hide' | 'mute' // Type of ignore: total hide or collapse with reveal button
}

export interface GlobalRoleSettings {
	adminColor: string
	subadminColor: string
	modColor: string
	userColor: string
}

export interface UserCustomizationsData {
	users: Record<string, UserCustomization>
	globalSettings: GlobalRoleSettings
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_GLOBAL_SETTINGS: GlobalRoleSettings = {
	adminColor: MV_ROLE_COLORS.ADMIN,
	subadminColor: MV_ROLE_COLORS.SUBADMIN,
	modColor: MV_ROLE_COLORS.MOD,
	userColor: MV_ROLE_COLORS.USER,
}

const DEFAULT_DATA: UserCustomizationsData = {
	users: {},
	globalSettings: DEFAULT_GLOBAL_SETTINGS,
}

// ============================================================================
// STORAGE ITEM DEFINITION
// ============================================================================

// Define the item once. WXT handles cache, writing and reading.
export const userCustomizationsStorage = storage.defineItem<UserCustomizationsData>(
	`local:${STORAGE_KEYS.USER_CUSTOMIZATIONS}`,
	{
		defaultValue: DEFAULT_DATA,
	}
)

// ============================================================================
// STORAGE FUNCTIONS
// ============================================================================

/**
 * Retrieves all user customizations from local storage.
 * @returns A Promise resolving to the UserCustomizationsData object.
 */
export async function getUserCustomizations(): Promise<UserCustomizationsData> {
	try {
		return await userCustomizationsStorage.getValue()
	} catch (error) {
		logger.error('Error reading user customizations storage:', error)
		return DEFAULT_DATA
	}
}

/**
 * Persists the complete user customizations data (users and global settings) to storage.
 * @param data - The full UserCustomizationsData object to save
 */
export async function saveUserCustomizations(data: UserCustomizationsData): Promise<void> {
	try {
		await userCustomizationsStorage.setValue(data)
	} catch (error) {
		logger.error('Error writing user customizations storage:', error)
		throw error
	}
}

/**
 * Retrieves specific customization data for a single user by their username.
 * @param username - The username to lookup
 * @returns The user's customization object or undefined if not found
 */
export async function getUserCustomization(username: string): Promise<UserCustomization | undefined> {
	const data = await getUserCustomizations()
	return data.users[username]
}

/**
 * Saves specific customization data for a single user.
 * Automatically removes empty entries to keep storage clean.
 * @param username - The user to customize
 * @param customization - The new customization data
 */
export async function saveUserCustomization(username: string, customization: UserCustomization): Promise<void> {
	const data = await getUserCustomizations()

	// If customization is essentially empty, remove the user entry
	const hasValues = Object.values(customization).some(v => v !== undefined && v !== '' && v !== false)

	if (hasValues) {
		data.users[username] = customization
	} else {
		delete data.users[username]
	}

	await saveUserCustomizations(data)
}

/**
 * Remove customization for a specific user
 */
export async function removeUserCustomization(username: string): Promise<void> {
	const data = await getUserCustomizations()
	delete data.users[username]
	await saveUserCustomizations(data)
}

/**
 * Retrieves the global role colors and configuration.
 */
export async function getGlobalRoleSettings(): Promise<GlobalRoleSettings> {
	const data = await getUserCustomizations()
	return data.globalSettings || DEFAULT_GLOBAL_SETTINGS
}

/**
 * Persists the global role configuration to storage.
 */
export async function saveGlobalRoleSettings(settings: GlobalRoleSettings): Promise<void> {
	const data = await getUserCustomizations()
	data.globalSettings = settings
	await saveUserCustomizations(data)
}

/**
 * Subscribes to changes in user customizations storage.
 * @param callback - Function executed when data changes
 * @returns A cleanup function to stop watching
 */
export function watchUserCustomizations(callback: (data: UserCustomizationsData) => void): () => void {
	return userCustomizationsStorage.watch(newData => {
		if (newData) {
			callback(newData)
		}
	})
}
