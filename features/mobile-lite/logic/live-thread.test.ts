import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	getPlatformKind: vi.fn(() => 'firefox-android'),
	isFeatureEnabled: vi.fn(() => true),
	isThreadPage: vi.fn(() => true),
	getSettings: vi.fn(() => Promise.resolve({ liveThreadEnabled: true })),
	cleanupLiveThreadButton: vi.fn(),
	configureLiveThreadRuntime: vi.fn(() => Promise.resolve(true)),
	startLiveMode: vi.fn(() => Promise.resolve()),
	getIsLiveActive: vi.fn(() => false),
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

vi.mock('@/lib/content-modules/utils/page-detection', () => ({
	isThreadPage: mocks.isThreadPage,
}))

vi.mock('@/store/settings-store', () => ({
	getSettings: mocks.getSettings,
}))

vi.mock('@/features/live-thread', () => ({
	cleanupLiveThreadButton: mocks.cleanupLiveThreadButton,
	configureLiveThreadRuntime: mocks.configureLiveThreadRuntime,
	startLiveMode: mocks.startLiveMode,
}))

vi.mock('@/features/live-thread/logic/live-thread-polling', () => ({
	getIsLiveActive: mocks.getIsLiveActive,
}))

import { DOM_MARKERS, MV_SELECTORS } from '@/constants'
import { initMobileLiteLiveThread, syncMobileLiteLiveThreadButton, teardownMobileLiteLiveThread } from './live-thread'

function setMoreActions(): HTMLElement {
	document.body.innerHTML = `
		<div id="${MV_SELECTORS.GLOBAL.MORE_ACTIONS_ID}">
			<a id="topic-reply" class="btn quickreply" href="/foro/test/responder">Responder</a>
			<a id="share-thread" class="btn" href="#">Compartir</a>
		</div>
	`
	return document.getElementById(MV_SELECTORS.GLOBAL.MORE_ACTIONS_ID) as HTMLElement
}

describe('Mobile Lite live thread button', () => {
	beforeEach(() => {
		vi.useRealTimers()
		vi.clearAllMocks()
		mocks.getPlatformKind.mockReturnValue('firefox-android')
		mocks.isFeatureEnabled.mockReturnValue(true)
		mocks.isThreadPage.mockReturnValue(true)
		mocks.getSettings.mockResolvedValue({ liveThreadEnabled: true })
		mocks.configureLiveThreadRuntime.mockResolvedValue(true)
		mocks.startLiveMode.mockResolvedValue(undefined)
		mocks.getIsLiveActive.mockReturnValue(false)
		document.body.innerHTML = ''
		document.head.innerHTML = ''
	})

	it('injects the Live button directly into #more-actions when it already exists', async () => {
		const moreActions = setMoreActions()

		await syncMobileLiteLiveThreadButton()

		const button = document.getElementById('mvp-mobile-lite-live-thread-button')
		expect(button).toBeTruthy()
		expect(button?.parentElement).toBe(moreActions)
		expect(button?.previousElementSibling?.id).toBe('topic-reply')
	})

	it('injects the Live button when #more-actions appears after initialization', async () => {
		vi.useFakeTimers()
		initMobileLiteLiveThread()

		setMoreActions()
		await Promise.resolve()
		await vi.advanceTimersByTimeAsync(100)

		expect(document.getElementById('mvp-mobile-lite-live-thread-button')).toBeTruthy()
	})

	it('does not duplicate the Live button after repeated syncs', async () => {
		setMoreActions()

		await syncMobileLiteLiveThreadButton()
		await syncMobileLiteLiveThreadButton()

		expect(document.querySelectorAll('#mvp-mobile-lite-live-thread-button')).toHaveLength(1)
	})

	it('removes the Mobile Lite button and legacy Live containers when disabled', async () => {
		setMoreActions()
		document.body.insertAdjacentHTML(
			'beforeend',
			`
				<div id="mvp-mobile-lite-live-thread-container"></div>
				<div id="${DOM_MARKERS.IDS.EXTRA_ACTIONS}">
					<div id="${DOM_MARKERS.IDS.MAIN_ACTIONS}"></div>
					<div id="${DOM_MARKERS.IDS.STATUS_ACTIONS}"></div>
				</div>
			`
		)
		await syncMobileLiteLiveThreadButton(true)

		await syncMobileLiteLiveThreadButton(false)

		expect(document.getElementById('mvp-mobile-lite-live-thread-button')).toBeNull()
		expect(document.getElementById('mvp-mobile-lite-live-thread-container')).toBeNull()
		expect(mocks.cleanupLiveThreadButton).toHaveBeenCalled()
		expect(document.getElementById(DOM_MARKERS.IDS.EXTRA_ACTIONS)).toBeNull()
	})

	it('starts Live with the Mobile Lite variant when tapped', async () => {
		setMoreActions()
		await syncMobileLiteLiveThreadButton()

		document.getElementById('mvp-mobile-lite-live-thread-button')?.dispatchEvent(
			new MouseEvent('click', { bubbles: true, cancelable: true })
		)
		await Promise.resolve()
		await Promise.resolve()

		expect(mocks.startLiveMode).toHaveBeenCalledWith({ variant: 'mobile-lite' })
	})

	afterEach(() => {
		teardownMobileLiteLiveThread()
	})
})
