import { describe, expect, it } from 'vitest'
import type { UserCustomizationsData } from '@/features/user-customizations/storage'
import { getCustomizationEntryForUser, getIgnoreTypeForUser, setUserIgnoreInData } from './ignore-helpers'

const DEFAULT_GLOBAL_SETTINGS = {
	adminColor: '',
	subadminColor: '',
	modColor: '',
	userColor: '',
}

function userCustomizations(users: UserCustomizationsData['users']): UserCustomizationsData {
	return {
		users,
		globalSettings: DEFAULT_GLOBAL_SETTINGS,
	}
}

describe('Mobile Lite ignore helpers', () => {
	it('finds existing customization entries case-insensitively', () => {
		const data = userCustomizations({
			OriginalUser: {
				isIgnored: true,
				ignoreType: 'mute',
			},
		})

		expect(getCustomizationEntryForUser(data, 'originaluser')).toEqual({
			storageKey: 'OriginalUser',
			customization: {
				isIgnored: true,
				ignoreType: 'mute',
			},
		})
		expect(getIgnoreTypeForUser(data, 'ORIGINALUSER')).toBe('mute')
	})

	it('preserves unrelated desktop customizations when setting ignore type', () => {
		const data = userCustomizations({
			OriginalUser: {
				note: 'No spoilers',
				badge: 'Watchlist',
				avatarUrl: 'https://example.com/avatar.png',
				usernameColour: '#ff9900',
			},
		})

		const result = setUserIgnoreInData(data, 'originaluser', 'hide')

		expect(result.storageKey).toBe('OriginalUser')
		expect(data.users.OriginalUser).toEqual({
			note: 'No spoilers',
			badge: 'Watchlist',
			avatarUrl: 'https://example.com/avatar.png',
			usernameColour: '#ff9900',
			isIgnored: true,
			ignoreType: 'hide',
		})
	})

	it('removes only ignore fields when clearing a user with other customizations', () => {
		const data = userCustomizations({
			OriginalUser: {
				note: 'Keep this',
				isIgnored: true,
				ignoreType: 'mute',
			},
		})

		setUserIgnoreInData(data, 'OriginalUser', null)

		expect(data.users.OriginalUser).toEqual({
			note: 'Keep this',
		})
	})

	it('deletes the user entry when clearing the only meaningful customization', () => {
		const data = userCustomizations({
			OriginalUser: {
				isIgnored: true,
				ignoreType: 'hide',
			},
		})

		setUserIgnoreInData(data, 'OriginalUser', null)

		expect(data.users.OriginalUser).toBeUndefined()
	})
})
