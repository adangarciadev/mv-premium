import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getRunnableMobileLiteModuleIds, initMobileLite, teardownMobileLite, type MobileLiteContext } from './registry'

const mocks = vi.hoisted(() => ({
	getPlatformKind: vi.fn(() => 'firefox-android'),
	isFeatureEnabled: vi.fn(() => true),
	initEditor: vi.fn(),
	teardownEditor: vi.fn(),
	initIgnoredUsers: vi.fn(),
	teardownIgnoredUsers: vi.fn(),
	initPanel: vi.fn(),
	teardownPanel: vi.fn(),
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

vi.mock('./editor-lite', () => ({
	initMobileLiteEditorEnhancements: mocks.initEditor,
	teardownMobileLiteEditorEnhancements: mocks.teardownEditor,
}))

vi.mock('./ignored-users', () => ({
	initMobileLiteIgnoredUsers: mocks.initIgnoredUsers,
	teardownMobileLiteIgnoredUsers: mocks.teardownIgnoredUsers,
}))

vi.mock('./panel', () => ({
	initMobileLitePanel: mocks.initPanel,
	teardownMobileLitePanel: mocks.teardownPanel,
}))

function context(overrides: Partial<MobileLiteContext> = {}): MobileLiteContext {
	return {
		hasEditor: false,
		hasPosts: false,
		hasUserCard: false,
		hasUserMenu: false,
		isForumRelated: false,
		pathname: '/foro',
		...overrides,
	}
}

describe('Mobile Lite registry', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.getPlatformKind.mockReturnValue('firefox-android')
		mocks.isFeatureEnabled.mockReturnValue(true)
	})

	it('returns only modules matching the current mobile context', () => {
		expect(
			getRunnableMobileLiteModuleIds(
				context({
					hasPosts: true,
					hasUserMenu: true,
				})
			)
		).toEqual(['ignored-users', 'panel'])
	})

	it('runs the panel on forum pages even if the user menu is mounted later', () => {
		expect(
			getRunnableMobileLiteModuleIds(
				context({
					isForumRelated: true,
				})
			)
		).toEqual(['editor-lite', 'panel'])
	})

	it('initializes only runnable modules', () => {
		initMobileLite(
			context({
				hasEditor: true,
				isForumRelated: true,
			})
		)

		expect(mocks.initEditor).toHaveBeenCalledOnce()
		expect(mocks.initIgnoredUsers).not.toHaveBeenCalled()
		expect(mocks.initPanel).toHaveBeenCalledOnce()
	})

	it('does not initialize modules outside allowed Firefox Android Mobile Lite runtime', () => {
		mocks.getPlatformKind.mockReturnValue('firefox-desktop')

		initMobileLite(
			context({
				hasEditor: true,
				hasPosts: true,
				hasUserMenu: true,
			})
		)

		expect(mocks.initEditor).not.toHaveBeenCalled()
		expect(mocks.initIgnoredUsers).not.toHaveBeenCalled()
		expect(mocks.initPanel).not.toHaveBeenCalled()
	})

	it('tears down all registered modules', () => {
		teardownMobileLite()

		expect(mocks.teardownIgnoredUsers).toHaveBeenCalledOnce()
		expect(mocks.teardownEditor).toHaveBeenCalledOnce()
		expect(mocks.teardownPanel).toHaveBeenCalledOnce()
	})
})
