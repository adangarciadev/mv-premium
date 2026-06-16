import type { UserCustomization, UserCustomizationsData } from '@/features/user-customizations/storage'
import type { MobileLiteIgnoreType } from '../logic/ignore-helpers'
import type { MobileLiteChangelogEntry } from '../logic/whats-new'

export const EMPTY_GLOBAL_SETTINGS = {
	adminColor: '',
	subadminColor: '',
	modColor: '',
	userColor: '',
}
export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 13
export const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/
export const USERNAME_VALIDATION_ID = 'mvp-mobile-lite-username-validation'
export const SELF_IGNORE_MESSAGE = 'No puedes silenciarte a ti mismo.'
export const USER_SUGGESTIONS_DEBOUNCE_MS = 300
export const USER_SUGGESTIONS_MAX = 5
export const DEFAULT_BOLD_COLOR = '#ffffff'

export interface FilteredUser {
	username: string
	customization: UserCustomization
}

export type ActiveFilter = 'all' | MobileLiteIgnoreType
export type PanelTab = 'users' | 'threads' | 'settings'
export type PanelView = 'main' | 'whats-new'
export type SavingMobileLiteSetting =
	| 'liveThreadEnabled'
	| 'galleryButtonEnabled'
	| 'quoteSelectionEnabled'
	| 'hideThreadEnabled'
	| null

export interface UserFilterOption {
	id: ActiveFilter
	label: string
	count: number
}

export function getEmptyData(): UserCustomizationsData {
	return {
		users: {},
		globalSettings: EMPTY_GLOBAL_SETTINGS,
	}
}

export function getFilteredUsers(data: UserCustomizationsData): FilteredUser[] {
	return Object.entries(data.users)
		.filter(([, customization]) => customization.isIgnored)
		.map(([username, customization]) => ({ username, customization }))
		.sort((a, b) => a.username.localeCompare(b.username, 'es', { sensitivity: 'base' }))
}

export function normalizeUsername(username: string): string {
	return username.trim()
}

export function getSubforumSlugFromId(subforumId: string): string {
	return subforumId.replace(/^\/foro\//, '').replace(/^foro\//, '').trim()
}

export function formatHiddenThreadDate(hiddenAt: number): string {
	if (!Number.isFinite(hiddenAt) || hiddenAt <= 0) return ''

	return new Intl.DateTimeFormat('es-ES', {
		day: '2-digit',
		month: '2-digit',
		year: '2-digit',
	}).format(new Date(hiddenAt))
}

export function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value)
	} catch {
		return value
	}
}

export function getUsernameValidationMessage(username: string): string | null {
	if (!username) return null
	if (username.length < USERNAME_MIN_LENGTH) return 'Escribe al menos 3 caracteres para añadir un usuario.'
	if (username.length > USERNAME_MAX_LENGTH) return 'El nick no puede tener más de 13 caracteres.'
	if (!USERNAME_PATTERN.test(username)) return 'Usa solo letras, números, guiones y guiones bajos.'
	return null
}

export function getChangeTypeLabel(type: MobileLiteChangelogEntry['changes'][number]['type']): string {
	switch (type) {
		case 'feature':
			return 'Nuevo'
		case 'improvement':
			return 'Mejora'
		case 'fix':
			return 'Fix'
		default:
			return 'Cambio'
	}
}
