import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ThreadMedia } from '@/features/gallery/lib/thread-scraper'

const mocks = vi.hoisted(() => ({
	getPlatformKind: vi.fn(() => 'firefox-android'),
	isFeatureEnabled: vi.fn(() => true),
	isThreadPage: vi.fn(() => true),
	getSettings: vi.fn(() => Promise.resolve({ galleryButtonEnabled: true })),
	getThreadMedia: vi.fn((): ThreadMedia[] => []),
	getIsLiveActive: vi.fn(() => false),
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

vi.mock('@/lib/content-modules/utils/page-detection', () => ({
	isThreadPage: mocks.isThreadPage,
}))

vi.mock('@/store/settings-store', () => ({
	getSettings: mocks.getSettings,
}))

vi.mock('@/features/gallery/lib/thread-scraper', () => ({
	getThreadMedia: mocks.getThreadMedia,
}))

vi.mock('@/features/live-thread/logic/live-thread-polling', () => ({
	getIsLiveActive: mocks.getIsLiveActive,
}))

vi.mock('@/lib/content-modules/utils/react-helpers', () => ({
	mountFeatureWithBoundary: mocks.mountFeatureWithBoundary,
	unmountFeature: mocks.unmountFeature,
	isFeatureMounted: mocks.isFeatureMounted,
}))

vi.mock('@/features/gallery/components/gallery-carousel', () => ({
	GalleryCarousel: () => null,
}))

import { FEATURE_IDS, MV_SELECTORS } from '@/constants'
import { initMobileLiteGallery, syncMobileLiteGalleryButton, teardownMobileLiteGallery } from './gallery'

const BUTTON_ID = 'mvp-mobile-lite-gallery-button'
const LIVE_BUTTON_ID = 'mvp-mobile-lite-live-thread-button'

function mediaFixture(count: number): ThreadMedia[] {
	return Array.from({ length: count }, (_, index) => ({
		id: `1-${index}`,
		type: 'image' as const,
		src: `https://example.com/image-${index}.jpg`,
		author: 'tester',
		postLink: '#1',
		postNum: 1,
	}))
}

function setMoreActions({ withLiveButton = false } = {}): HTMLElement {
	document.body.innerHTML = `
		<div id="${MV_SELECTORS.GLOBAL.MORE_ACTIONS_ID}">
			<a id="topic-reply" class="btn quickreply" href="/foro/test/responder">Responder</a>
			${withLiveButton ? `<a id="${LIVE_BUTTON_ID}" class="btn">Live</a>` : ''}
			<a id="share-thread" class="btn" href="#">Compartir</a>
		</div>
	`
	return document.getElementById(MV_SELECTORS.GLOBAL.MORE_ACTIONS_ID) as HTMLElement
}

describe('Mobile Lite gallery button', () => {
	beforeEach(() => {
		vi.useRealTimers()
		vi.clearAllMocks()
		mocks.getPlatformKind.mockReturnValue('firefox-android')
		mocks.isFeatureEnabled.mockReturnValue(true)
		mocks.isThreadPage.mockReturnValue(true)
		mocks.getSettings.mockResolvedValue({ galleryButtonEnabled: true })
		mocks.getThreadMedia.mockReturnValue(mediaFixture(2))
		mocks.getIsLiveActive.mockReturnValue(false)
		mocks.isFeatureMounted.mockReturnValue(false)
		document.body.innerHTML = ''
		document.head.innerHTML = ''
	})

	afterEach(() => {
		teardownMobileLiteGallery()
	})

	it('injects the gallery button right after the Live button when present', async () => {
		const moreActions = setMoreActions({ withLiveButton: true })

		await syncMobileLiteGalleryButton()

		const button = document.getElementById(BUTTON_ID)
		expect(button).toBeTruthy()
		expect(button?.parentElement).toBe(moreActions)
		expect(button?.previousElementSibling?.id).toBe(LIVE_BUTTON_ID)
	})

	it('injects the gallery button after the reply action when there is no Live button', async () => {
		setMoreActions()

		await syncMobileLiteGalleryButton()

		const button = document.getElementById(BUTTON_ID)
		expect(button).toBeTruthy()
		expect(button?.previousElementSibling?.id).toBe('topic-reply')
	})

	it('injects the gallery button when #more-actions appears after initialization', async () => {
		vi.useFakeTimers()
		initMobileLiteGallery()

		setMoreActions()
		await Promise.resolve()
		await vi.advanceTimersByTimeAsync(100)

		expect(document.getElementById(BUTTON_ID)).toBeTruthy()
	})

	it('does not duplicate the gallery button after repeated syncs', async () => {
		setMoreActions()

		await syncMobileLiteGalleryButton()
		await syncMobileLiteGalleryButton()

		expect(document.querySelectorAll(`#${BUTTON_ID}`)).toHaveLength(1)
	})

	it('shows the media count in the button badge', async () => {
		setMoreActions()
		mocks.getThreadMedia.mockReturnValue(mediaFixture(12))

		await syncMobileLiteGalleryButton()

		const badge = document.querySelector(`#${BUTTON_ID} .mvp-mobile-lite-gallery-count`)
		expect(badge?.textContent).toBe('12')
	})

	it('does not inject the button when the thread has no media', async () => {
		setMoreActions()
		mocks.getThreadMedia.mockReturnValue([])

		await syncMobileLiteGalleryButton()

		expect(document.getElementById(BUTTON_ID)).toBeNull()
	})

	it('removes the button when the gallery setting is disabled', async () => {
		setMoreActions()
		await syncMobileLiteGalleryButton()
		expect(document.getElementById(BUTTON_ID)).toBeTruthy()

		mocks.getSettings.mockResolvedValue({ galleryButtonEnabled: false })
		await syncMobileLiteGalleryButton()

		expect(document.getElementById(BUTTON_ID)).toBeNull()
	})

	it('removes the button while Live mode is active', async () => {
		setMoreActions()
		await syncMobileLiteGalleryButton()
		expect(document.getElementById(BUTTON_ID)).toBeTruthy()

		mocks.getIsLiveActive.mockReturnValue(true)
		await syncMobileLiteGalleryButton()

		expect(document.getElementById(BUTTON_ID)).toBeNull()
	})

	it('mounts the gallery carousel when tapped', async () => {
		setMoreActions()
		await syncMobileLiteGalleryButton()

		document.getElementById(BUTTON_ID)?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

		await vi.waitFor(() => {
			expect(mocks.mountFeatureWithBoundary).toHaveBeenCalled()
		})
		expect(mocks.mountFeatureWithBoundary.mock.calls[0][0]).toBe(FEATURE_IDS.GALLERY_MODAL)
	})
})
