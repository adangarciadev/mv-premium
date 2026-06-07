import type { UserCustomization, UserCustomizationsData } from '@/features/user-customizations/storage'

export type MobileLiteIgnoreType = 'hide' | 'mute'

export function getCustomizationEntryForUser(
	data: UserCustomizationsData,
	username: string
): { storageKey: string; customization: UserCustomization } | null {
	const directCustomization = data.users[username]
	if (directCustomization) return { storageKey: username, customization: directCustomization }

	const matchingKey = Object.keys(data.users).find(key => key.toLowerCase() === username.toLowerCase())
	return matchingKey ? { storageKey: matchingKey, customization: data.users[matchingKey] } : null
}

export function hasMeaningfulCustomizationValue(customization: UserCustomization): boolean {
	return Object.values(customization).some(value => value !== undefined && value !== '' && value !== false)
}

export function getIgnoreTypeFromCustomization(customization: UserCustomization | undefined): MobileLiteIgnoreType | null {
	if (!customization?.isIgnored) return null
	return customization.ignoreType === 'mute' ? 'mute' : 'hide'
}

export function getIgnoreTypeForUser(data: UserCustomizationsData, username: string): MobileLiteIgnoreType | null {
	return getIgnoreTypeFromCustomization(getCustomizationEntryForUser(data, username)?.customization)
}

export function setUserIgnoreInData(
	data: UserCustomizationsData,
	username: string,
	ignoreType: MobileLiteIgnoreType | null
): { storageKey: string; data: UserCustomizationsData } {
	const entry = getCustomizationEntryForUser(data, username)
	const storageKey = entry?.storageKey ?? username
	const existing = entry ? { ...entry.customization } : {}

	if (ignoreType) {
		data.users[storageKey] = { ...existing, isIgnored: true, ignoreType }
		return { storageKey, data }
	}

	const { isIgnored: _isIgnored, ignoreType: _ignoreType, ...rest } = existing
	if (hasMeaningfulCustomizationValue(rest)) {
		data.users[storageKey] = rest
	} else {
		delete data.users[storageKey]
	}

	return { storageKey, data }
}
