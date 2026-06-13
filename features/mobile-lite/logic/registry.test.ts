import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getRunnableMobileLiteModuleIds, initMobileLite, teardownMobileLite, type MobileLiteContext } from './registry'

const mocks = vi.hoisted(() => ({
	getPlatformKind: vi.fn(() => 'firefox-android'),
	isFeatureEnabled: vi.fn(() => true),
	initBoldColor: vi.fn(),
	teardownBoldColor: vi.fn(),
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
	initGallery: vi.fn(),
	teardownGallery: vi.fn(),
	initLiveThread: vi.fn(),
	teardownLiveThread: vi.fn(),
	initThreadCompanion: vi.fn(),
	teardownThreadCompanion: vi.fn(),
	initThreadSummary: vi.fn(),
	teardownThreadSummary: vi.fn(),
	initPostSummary: vi.fn(),
	teardownPostSummary: vi.fn(),
	initPanel: vi.fn(),
	teardownPanel: vi.fn(),
	initPostGestures: vi.fn(),
	teardownPostGestures: vi.fn(),
	initQuoteSelection: vi.fn(),
	teardownQuoteSelection: vi.fn(),
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

vi.mock('./bold-color', () => ({
	initMobileLiteBoldColor: mocks.initBoldColor,
	teardownMobileLiteBoldColor: mocks.teardownBoldColor,
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
	// Mirrors the real implementation: subforum listings only, never global views
	// (spy, new, unread, top, featured) or thread URLs (slug ending in -<id>).
	isNormalMobileLiteSubforumPath: vi.fn((pathname: string) => {
		if (!pathname.startsWith('/foro/')) return false
		const globalViews = ['/foro/spy', '/foro/new', '/foro/unread', '/foro/top', '/foro/featured']
		if (globalViews.some(view => pathname === view || pathname.startsWith(`${view}/`))) return false

		const segments = pathname.split('/').filter(Boolean)
		if (segments.length < 2) return false

		const maybeThreadSlug = segments[2]
		return !maybeThreadSlug || !/-\d+$/.test(maybeThreadSlug)
	}),
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

vi.mock('./gallery', () => ({
	initMobileLiteGallery: mocks.initGallery,
	teardownMobileLiteGallery: mocks.teardownGallery,
}))

vi.mock('./live-thread', () => ({
	initMobileLiteLiveThread: mocks.initLiveThread,
	teardownMobileLiteLiveThread: mocks.teardownLiveThread,
}))

vi.mock('./panel', () => ({
	initMobileLitePanel: mocks.initPanel,
	teardownMobileLitePanel: mocks.teardownPanel,
}))

vi.mock('./post-gestures', () => ({
	initMobileLitePostGestures: mocks.initPostGestures,
	teardownMobileLitePostGestures: mocks.teardownPostGestures,
}))

vi.mock('./quote-selection', () => ({
	initMobileLiteQuoteSelection: mocks.initQuoteSelection,
	teardownMobileLiteQuoteSelection: mocks.teardownQuoteSelection,
}))

vi.mock('./thread-companion', () => ({
	initMobileLiteThreadCompanion: mocks.initThreadCompanion,
	teardownMobileLiteThreadCompanion: mocks.teardownThreadCompanion,
}))

vi.mock('./thread-summary', () => ({
	initMobileLiteThreadSummary: mocks.initThreadSummary,
	teardownMobileLiteThreadSummary: mocks.teardownThreadSummary,
}))

vi.mock('./post-summary', () => ({
	initMobileLitePostSummary: mocks.initPostSummary,
	teardownMobileLitePostSummary: mocks.teardownPostSummary,
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
		isThreadPage: false,
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
		).toEqual(['bold-color', 'live-thread', 'gallery', 'ignored-users', 'post-gestures', 'panel'])
	})

	it('runs the panel on forum pages even if the user menu is mounted later', () => {
		expect(
			getRunnableMobileLiteModuleIds(
				context({
					isForumRelated: true,
				})
			)
		).toEqual(['bold-color', 'editor-lite', 'panel'])
	})

	it('runs ignored author thread filtering on normal subforum pages', () => {
		expect(
			getRunnableMobileLiteModuleIds(
				context({
					isForumRelated: true,
					isNormalSubforumThreadList: true,
					pathname: '/foro/juegos',
				})
			)
		).toEqual(['bold-color', 'ignored-user-threads', 'hidden-threads', 'editor-lite', 'panel'])
	})

	it('detects normal subforum pages even if thread rows mount later', () => {
		window.history.replaceState({}, '', '/foro/juegos')
		document.body.innerHTML = ''

		expect(getRunnableMobileLiteModuleIds()).toEqual(['bold-color', 'ignored-user-threads', 'hidden-threads', 'editor-lite', 'panel'])
	})

	it('initializes the mobile live thread module on thread URLs before posts mount', () => {
		window.history.replaceState({}, '', '/foro/deportes/pretemporada-2026-123456')
		document.body.innerHTML = ''

		expect(getRunnableMobileLiteModuleIds()).toEqual(['bold-color', 'live-thread', 'gallery', 'thread-companion', 'thread-summary', 'post-summary', 'quote-selection', 'post-gestures', 'editor-lite', 'panel'])
	})

	it('runs individual hidden thread controls on spy without ignored-author filtering', () => {
		window.history.replaceState({}, '', '/foro/spy')
		document.body.innerHTML = ''

		expect(getRunnableMobileLiteModuleIds()).toEqual(['bold-color', 'hidden-threads', 'editor-lite', 'panel'])
	})

	it('initializes only runnable modules', () => {
		initMobileLite(
			context({
				hasEditor: true,
				isForumRelated: true,
			})
		)

		expect(mocks.initBoldColor).toHaveBeenCalledOnce()
		expect(mocks.initEditor).toHaveBeenCalledOnce()
		expect(mocks.initGallery).not.toHaveBeenCalled()
		expect(mocks.initPostGestures).not.toHaveBeenCalled()
		expect(mocks.initIgnoredUsersImport).not.toHaveBeenCalled()
		expect(mocks.initIgnoredUsers).not.toHaveBeenCalled()
		expect(mocks.initIgnoredUserThreads).not.toHaveBeenCalled()
		expect(mocks.initHiddenThreads).not.toHaveBeenCalled()
		expect(mocks.initPanel).toHaveBeenCalledOnce()
	})

	it('initializes the mobile live thread button on thread pages', () => {
		initMobileLite(
			context({
				hasPosts: true,
			})
		)

		expect(mocks.initBoldColor).toHaveBeenCalledOnce()
		expect(mocks.initLiveThread).toHaveBeenCalledOnce()
		expect(mocks.initGallery).toHaveBeenCalledOnce()
		expect(mocks.initIgnoredUsers).toHaveBeenCalledOnce()
		expect(mocks.initPostGestures).toHaveBeenCalledOnce()
	})

	it('initializes the thread companion and summaries only on thread pages', () => {
		initMobileLite(context({ hasPosts: true }))
		expect(mocks.initThreadCompanion).not.toHaveBeenCalled()
		expect(mocks.initThreadSummary).not.toHaveBeenCalled()
		expect(mocks.initPostSummary).not.toHaveBeenCalled()

		initMobileLite(context({ isThreadPage: true }))
		expect(mocks.initThreadCompanion).toHaveBeenCalledOnce()
		expect(mocks.initThreadSummary).toHaveBeenCalledOnce()
		expect(mocks.initPostSummary).toHaveBeenCalledOnce()
	})

	it('initializes the quote selection fix only on thread pages', () => {
		initMobileLite(context({ hasPosts: true }))
		expect(mocks.initQuoteSelection).not.toHaveBeenCalled()

		initMobileLite(context({ isThreadPage: true }))
		expect(mocks.initQuoteSelection).toHaveBeenCalledOnce()
	})

	it('initializes thread filtering modules on normal subforum pages', () => {
		initMobileLite(
			context({
				isForumRelated: true,
				isNormalSubforumThreadList: true,
				pathname: '/foro/juegos',
			})
		)

		expect(mocks.initBoldColor).toHaveBeenCalledOnce()
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
		expect(mocks.initBoldColor).not.toHaveBeenCalled()
		expect(mocks.initEditor).not.toHaveBeenCalled()
		expect(mocks.initGallery).not.toHaveBeenCalled()
		expect(mocks.initPostGestures).not.toHaveBeenCalled()
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
		expect(mocks.initBoldColor).not.toHaveBeenCalled()
		expect(mocks.initLiveThread).not.toHaveBeenCalled()
		expect(mocks.initGallery).not.toHaveBeenCalled()
		expect(mocks.initIgnoredUsers).not.toHaveBeenCalled()
		expect(mocks.initPostGestures).not.toHaveBeenCalled()
		expect(mocks.initIgnoredUserThreads).not.toHaveBeenCalled()
		expect(mocks.initHiddenThreads).not.toHaveBeenCalled()
		expect(mocks.initPanel).not.toHaveBeenCalled()
	})

	it('tears down all registered modules', () => {
		teardownMobileLite()

		expect(mocks.teardownIgnoredUsersImport).toHaveBeenCalledOnce()
		expect(mocks.teardownBoldColor).toHaveBeenCalledOnce()
		expect(mocks.teardownLiveThread).toHaveBeenCalledOnce()
		expect(mocks.teardownGallery).toHaveBeenCalledOnce()
		expect(mocks.teardownThreadCompanion).toHaveBeenCalledOnce()
		expect(mocks.teardownThreadSummary).toHaveBeenCalledOnce()
		expect(mocks.teardownPostSummary).toHaveBeenCalledOnce()
		expect(mocks.teardownQuoteSelection).toHaveBeenCalledOnce()
		expect(mocks.teardownIgnoredUsers).toHaveBeenCalledOnce()
		expect(mocks.teardownPostGestures).toHaveBeenCalledOnce()
		expect(mocks.teardownIgnoredUserThreads).toHaveBeenCalledOnce()
		expect(mocks.teardownHiddenThreads).toHaveBeenCalledOnce()
		expect(mocks.teardownEditor).toHaveBeenCalledOnce()
		expect(mocks.teardownPanel).toHaveBeenCalledOnce()
	})
})
