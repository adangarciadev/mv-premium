import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	buildIgnoredUsersImportUrl,
	type IgnoredUsersSyncPayload,
} from '@/features/ignored-users-mobile-sync'
import type { UserCustomizationsData } from '@/features/user-customizations/storage'
import {
	confirmIgnoredUsersImport,
	hasIgnoredUsersImportParam,
	initMobileLiteIgnoredUsersImport,
	teardownMobileLiteIgnoredUsersImport,
} from './ignored-users-import'

const mocks = vi.hoisted(() => ({
	getPlatformKind: vi.fn(() => 'firefox-android'),
	isFeatureEnabled: vi.fn(() => true),
	getUserCustomizations: vi.fn(),
	saveUserCustomizations: vi.fn(),
	mountFeatureWithBoundary: vi.fn(),
	unmountFeature: vi.fn(),
	isFeatureMounted: vi.fn(() => false),
}))

vi.mock('@/lib/platform', () => ({
	getPlatformKind: mocks.getPlatformKind,
}))

vi.mock('@/lib/feature-flags', () => ({
	FeatureFlag: {
		MobileLite: 'mobile-lite',
	},
	isFeatureEnabled: mocks.isFeatureEnabled,
}))

vi.mock('@/lib/content-modules/utils/react-helpers', () => ({
	createContainer: vi.fn(({ id, parent }) => {
		const container = document.createElement('div')
		container.id = id
		parent.appendChild(container)
		return container
	}),
	isFeatureMounted: mocks.isFeatureMounted,
	mountFeatureWithBoundary: mocks.mountFeatureWithBoundary,
	unmountFeature: mocks.unmountFeature,
}))

vi.mock('@/features/user-customizations/storage', async importOriginal => {
	const actual = await importOriginal<typeof import('@/features/user-customizations/storage')>()
	return {
		...actual,
		getUserCustomizations: mocks.getUserCustomizations,
		saveUserCustomizations: mocks.saveUserCustomizations,
	}
})

const GLOBAL_SETTINGS = {
	adminColor: '',
	subadminColor: '',
	modColor: '',
	userColor: '',
}

const payload: IgnoredUsersSyncPayload = {
	type: 'mvp-ignored-users',
	version: 1,
	users: [
		{ nick: 'HiddenUser', ignoreType: 'hide' },
		{ nick: 'MutedUser', ignoreType: 'mute' },
	],
}

function data(users: UserCustomizationsData['users']): UserCustomizationsData {
	return {
		users,
		globalSettings: GLOBAL_SETTINGS,
	}
}

describe('Mobile Lite ignored users import', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.getPlatformKind.mockReturnValue('firefox-android')
		mocks.isFeatureEnabled.mockReturnValue(true)
		mocks.isFeatureMounted.mockReturnValue(false)
		mocks.getUserCustomizations.mockResolvedValue(data({}))
		mocks.saveUserCustomizations.mockResolvedValue(undefined)
		window.history.replaceState({}, '', '/')
	})

	it('detects the import query param', () => {
		expect(hasIgnoredUsersImportParam('?mvp_import_ignored=abc')).toBe(true)
		expect(hasIgnoredUsersImportParam('?other=abc')).toBe(false)
	})

	it('does not initialize outside Firefox Android Mobile Lite', () => {
		const url = buildIgnoredUsersImportUrl(payload)
		window.history.replaceState({}, '', `/${new URL(url).search}`)
		mocks.getPlatformKind.mockReturnValue('firefox-desktop')

		initMobileLiteIgnoredUsersImport()

		expect(mocks.mountFeatureWithBoundary).not.toHaveBeenCalled()
		expect(mocks.getUserCustomizations).not.toHaveBeenCalled()
		expect(window.location.search).toContain('mvp_import_ignored')
	})

	it('cleans the query param after reading it', () => {
		const url = buildIgnoredUsersImportUrl(payload)
		window.history.replaceState({}, '', `/${new URL(url).search}&keep=1`)

		initMobileLiteIgnoredUsersImport()

		expect(window.location.search).toBe('?keep=1')
		expect(mocks.mountFeatureWithBoundary).toHaveBeenCalledOnce()
	})

	it('merges imported users after confirmation', async () => {
		mocks.getUserCustomizations.mockResolvedValue(
			data({
				HiddenUser: { isIgnored: true, ignoreType: 'mute', note: 'preserved' },
				OtherUser: { usernameColour: '#fff' },
			})
		)

		await confirmIgnoredUsersImport(payload)

		expect(mocks.saveUserCustomizations).toHaveBeenCalledWith(
			data({
				HiddenUser: { isIgnored: true, ignoreType: 'hide', note: 'preserved' },
				OtherUser: { usernameColour: '#fff' },
				MutedUser: { isIgnored: true, ignoreType: 'mute' },
			})
		)
	})

	it('tears down the import panel', () => {
		const container = document.createElement('div')
		container.id = 'mvp-mobile-lite-ignored-users-import-root'
		document.body.appendChild(container)

		teardownMobileLiteIgnoredUsersImport()

		expect(mocks.unmountFeature).toHaveBeenCalledWith('mobile-lite-ignored-users-import')
		expect(document.getElementById('mvp-mobile-lite-ignored-users-import-root')).toBeNull()
	})
})
