import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initMobileLiteThreadCompanion, teardownMobileLiteThreadCompanion } from './thread-companion'

const mocks = vi.hoisted(() => ({
	getPlatformKind: vi.fn(() => 'firefox-android'),
	isFeatureEnabled: vi.fn(() => true),
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

const STYLE_ID = 'mvp-mobile-lite-thread-companion-styles'

describe('Mobile Lite thread companion fix', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.getPlatformKind.mockReturnValue('firefox-android')
		mocks.isFeatureEnabled.mockReturnValue(true)
		document.head.innerHTML = ''
		document.body.innerHTML = ''
	})

	afterEach(() => {
		teardownMobileLiteThreadCompanion()
	})

	it('injects a style that forces the companion back into the document flow', () => {
		initMobileLiteThreadCompanion()

		const style = document.getElementById(STYLE_ID)
		expect(style).not.toBeNull()
		expect(style?.textContent).toContain('#thread-companion')
		expect(style?.textContent).toContain('position: static !important')
		expect(style?.textContent).toContain('top: auto !important')
	})

	it('does not duplicate the style on repeated init', () => {
		initMobileLiteThreadCompanion()
		initMobileLiteThreadCompanion()

		expect(document.querySelectorAll(`#${STYLE_ID}`)).toHaveLength(1)
	})

	it('does nothing outside Firefox Android', () => {
		mocks.getPlatformKind.mockReturnValue('firefox-desktop')

		initMobileLiteThreadCompanion()

		expect(document.getElementById(STYLE_ID)).toBeNull()
	})

	it('does nothing when the Mobile Lite flag is disabled', () => {
		mocks.isFeatureEnabled.mockReturnValue(false)

		initMobileLiteThreadCompanion()

		expect(document.getElementById(STYLE_ID)).toBeNull()
	})

	it('removes the style on teardown and allows re-init', () => {
		initMobileLiteThreadCompanion()
		teardownMobileLiteThreadCompanion()

		expect(document.getElementById(STYLE_ID)).toBeNull()

		initMobileLiteThreadCompanion()
		expect(document.getElementById(STYLE_ID)).not.toBeNull()
	})
})
