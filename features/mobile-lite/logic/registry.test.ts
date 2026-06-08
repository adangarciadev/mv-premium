import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getRunnableMobileLiteModuleIds, initMobileLite, teardownMobileLite, type MobileLiteContext } from './registry'

const mocks = vi.hoisted(() => ({
	getPlatformKind: vi.fn(() => 'firefox-android'),
	isFeatureEnabled: vi.fn(() => true),
	initEditor: vi.fn(),
	teardownEditor: vi.fn(),
	initIgnoredUsers: vi.fn(),
	teardownIgnoredUsers: vi.fn(),
	initIgnoredUserThreads: vi.fn(),
	teardownIgnoredUserThreads: vi.fn(),
	initHiddenThreads: vi.fn(),
	teardownHiddenThreads: vi.fn(),
	initIgnoredUsersImport: vi.fn(),
	teardownIgnoredUsersImport: vi.fn(),
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

vi.mock('./ignored-users-import', () => ({
	hasIgnoredUsersImportParam: vi.fn(() => false),
	initMobileLiteIgnoredUsersImport: mocks.initIgnoredUsersImport,
	teardownMobileLiteIgnoredUsersImport: mocks.teardownIgnoredUsersImport,
}))

vi.mock('./ignored-user-threads', () => ({
	initMobileLiteIgnoredUserThreads: mocks.initIgnoredUserThreads,
	isNormalMobileLiteSubforumPath: vi.fn(
		(pathname: string) => pathname.startsWith('/foro/') && !pathname.startsWith('/foro/spy')
	),
	teardownMobileLiteIgnoredUserThreads: mocks.teardownIgnoredUserThreads,
}))

vi.mock('./hidden-threads', () => ({
	initMobileLiteHiddenThreads: mocks.initHiddenThreads,
	isMobileLiteHiddenThreadsPath: vi.fn(
		(pathname: string) =>
			pathname === '/foro/spy' ||
			pathname.startsWith('/foro/spy/') ||
			(pathname.startsWith('/foro/') && !/-\d+$/.test(pathname.split('/').filter(Boolean)[2] || ''))
	),
	teardownMobileLiteHiddenThreads: mocks.teardownHiddenThreads,
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
		hasIgnoredUsersImport: false,
		isForumRelated: false,
		isNormalSubforumThreadList: false,
		pathname: '/foro',
		...overrides,
	}
}

describe('Mobile Lite registry', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.getPlatformKind.mockReturnValue('firefox-android')
		mocks.isFeatureEnabled.mockReturnValue(true)
		window.history.replaceState({}, '', '/')
		document.body.innerHTML = ''
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

	it('runs ignored author thread filtering on normal subforum pages', () => {
		expect(
			getRunnableMobileLiteModuleIds(
				context({
					isForumRelated: true,
					isNormalSubforumThreadList: true,
				})
			)
		).toEqual(['ignored-user-threads', 'hidden-threads', 'editor-lite', 'panel'])
	})

	it('detects normal subforum pages even if thread rows mount later', () => {
		window.history.replaceState({}, '', '/foro/juegos')
		document.body.innerHTML = ''

		expect(getRunnableMobileLiteModuleIds()).toEqual(['ignored-user-threads', 'hidden-threads', 'editor-lite', 'panel'])
	})

	it('runs individual hidden thread controls on spy without ignored-author filtering', () => {
		window.history.replaceState({}, '', '/foro/spy')
		document.body.innerHTML = ''

		expect(getRunnableMobileLiteModuleIds()).toEqual(['hidden-threads', 'editor-lite', 'panel'])
	})

	it('initializes only runnable modules', () => {
		initMobileLite(
			context({
				hasEditor: true,
				isForumRelated: true,
			})
		)

		expect(mocks.initEditor).toHaveBeenCalledOnce()
		expect(mocks.initIgnoredUsersImport).not.toHaveBeenCalled()
		expect(mocks.initIgnoredUsers).not.toHaveBeenCalled()
		expect(mocks.initIgnoredUserThreads).not.toHaveBeenCalled()
		expect(mocks.initHiddenThreads).not.toHaveBeenCalled()
		expect(mocks.initPanel).toHaveBeenCalledOnce()
	})

	it('initializes thread filtering modules on normal subforum pages', () => {
		initMobileLite(
			context({
				isForumRelated: true,
				isNormalSubforumThreadList: true,
			})
		)

		expect(mocks.initIgnoredUserThreads).toHaveBeenCalledOnce()
		expect(mocks.initHiddenThreads).toHaveBeenCalledOnce()
		expect(mocks.initEditor).toHaveBeenCalledOnce()
		expect(mocks.initPanel).toHaveBeenCalledOnce()
	})

	it('initializes ignored users import only when the import param is present', () => {
		initMobileLite(
			context({
				hasIgnoredUsersImport: true,
			})
		)

		expect(mocks.initIgnoredUsersImport).toHaveBeenCalledOnce()
		expect(mocks.initEditor).not.toHaveBeenCalled()
		expect(mocks.initIgnoredUsers).not.toHaveBeenCalled()
		expect(mocks.initIgnoredUserThreads).not.toHaveBeenCalled()
		expect(mocks.initHiddenThreads).not.toHaveBeenCalled()
		expect(mocks.initPanel).not.toHaveBeenCalled()
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
		expect(mocks.initIgnoredUsersImport).not.toHaveBeenCalled()
		expect(mocks.initIgnoredUsers).not.toHaveBeenCalled()
		expect(mocks.initIgnoredUserThreads).not.toHaveBeenCalled()
		expect(mocks.initHiddenThreads).not.toHaveBeenCalled()
		expect(mocks.initPanel).not.toHaveBeenCalled()
	})

	it('tears down all registered modules', () => {
		teardownMobileLite()

		expect(mocks.teardownIgnoredUsersImport).toHaveBeenCalledOnce()
		expect(mocks.teardownIgnoredUsers).toHaveBeenCalledOnce()
		expect(mocks.teardownIgnoredUserThreads).toHaveBeenCalledOnce()
		expect(mocks.teardownHiddenThreads).toHaveBeenCalledOnce()
		expect(mocks.teardownEditor).toHaveBeenCalledOnce()
		expect(mocks.teardownPanel).toHaveBeenCalledOnce()
	})
})
