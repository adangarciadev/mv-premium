import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runContentMain } from './main'

const mocks = vi.hoisted(() => ({
	getPlatformKind: vi.fn(() => 'firefox-android'),
	rehydrate: vi.fn(),
	waitForHydration: vi.fn(() => Promise.resolve()),
	setSetting: vi.fn(),
	getState: vi.fn(),
	getMobileLiteDevActivation: vi.fn(() => null),
	getUrlWithoutMobileLiteDevParam: vi.fn(() => '/foro'),
	hasMobileLiteIgnoredUsersDevSeed: vi.fn(() => false),
	seedMobileLiteIgnoredUsersForDev: vi.fn(() => Promise.resolve()),
	initMobileLite: vi.fn(),
	runDesktopContentMain: vi.fn(() => Promise.resolve()),
	debug: vi.fn(),
	info: vi.fn(),
}))

vi.mock('@/lib/platform', () => ({
	getPlatformKind: mocks.getPlatformKind,
}))

vi.mock('@/store/settings-store', () => ({
	useSettingsStore: {
		persist: {
			rehydrate: mocks.rehydrate,
		},
		getState: mocks.getState,
	},
	waitForHydration: mocks.waitForHydration,
}))

vi.mock('@/lib/logger', () => ({
	logger: {
		debug: mocks.debug,
		info: mocks.info,
	},
}))

vi.mock('@/features/mobile-lite/logic/dev-activation', () => ({
	getMobileLiteDevActivation: mocks.getMobileLiteDevActivation,
	getUrlWithoutMobileLiteDevParam: mocks.getUrlWithoutMobileLiteDevParam,
	hasMobileLiteIgnoredUsersDevSeed: mocks.hasMobileLiteIgnoredUsersDevSeed,
}))

vi.mock('@/features/mobile-lite/logic/dev-ignored-users-seed', () => ({
	seedMobileLiteIgnoredUsersForDev: mocks.seedMobileLiteIgnoredUsersForDev,
}))

vi.mock('@/features/mobile-lite', () => ({
	initMobileLite: mocks.initMobileLite,
}))

vi.mock('./desktop-main', () => ({
	runDesktopContentMain: mocks.runDesktopContentMain,
}))

describe('content main platform bootstrap', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.getPlatformKind.mockReturnValue('firefox-android')
		mocks.getState.mockReturnValue({
			mobileLiteEnabled: false,
			setSetting: mocks.setSetting,
		})
	})

	it('auto-enables Mobile Lite on Firefox Android without running desktop initialization', async () => {
		await runContentMain({ source: 'test' })

		expect(mocks.rehydrate).toHaveBeenCalledOnce()
		expect(mocks.waitForHydration).toHaveBeenCalledOnce()
		expect(mocks.setSetting).toHaveBeenCalledWith('mobileLiteEnabled', true)
		expect(mocks.initMobileLite).toHaveBeenCalledOnce()
		expect(mocks.runDesktopContentMain).not.toHaveBeenCalled()
	})

	it('respects explicit Mobile Lite dev disable on Firefox Android', async () => {
		mocks.getMobileLiteDevActivation.mockReturnValue('disable')

		await runContentMain({ source: 'test' })

		expect(mocks.setSetting).toHaveBeenCalledWith('mobileLiteEnabled', false)
		expect(mocks.initMobileLite).not.toHaveBeenCalled()
		expect(mocks.runDesktopContentMain).not.toHaveBeenCalled()
	})

	it('runs Mobile Lite on enabled Firefox Android without running desktop initialization', async () => {
		mocks.getState.mockReturnValue({
			mobileLiteEnabled: true,
			setSetting: mocks.setSetting,
		})

		await runContentMain({ source: 'test' })

		expect(mocks.initMobileLite).toHaveBeenCalledOnce()
		expect(mocks.runDesktopContentMain).not.toHaveBeenCalled()
	})

	it('runs desktop initialization outside Firefox Android', async () => {
		const ctx = { source: 'desktop-test' }
		mocks.getPlatformKind.mockReturnValue('firefox-desktop')

		await runContentMain(ctx)

		expect(mocks.rehydrate).not.toHaveBeenCalled()
		expect(mocks.initMobileLite).not.toHaveBeenCalled()
		expect(mocks.runDesktopContentMain).toHaveBeenCalledWith(ctx)
	})
})
