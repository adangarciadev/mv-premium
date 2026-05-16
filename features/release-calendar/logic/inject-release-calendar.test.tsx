import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { DOM_MARKERS, FEATURE_IDS } from '@/constants'
import { injectReleaseCalendar } from './inject-release-calendar'

const { mountFeatureWithBoundary, isFeatureMounted, settingsState } = vi.hoisted(() => ({
	mountFeatureWithBoundary: vi.fn(),
	isFeatureMounted: vi.fn(() => false),
	settingsState: {
		gameReleaseCalendarJuegosEnabled: true,
	},
}))

vi.mock('@/lib/content-modules/utils/react-helpers', () => ({
	isFeatureMounted,
	mountFeatureWithBoundary,
	unmountFeature: vi.fn(),
}))

vi.mock('@/components/shadow-wrapper', () => ({
	ShadowWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/store/settings-store', () => ({
	useSettingsStore: {
		getState: vi.fn(() => settingsState),
	},
}))

vi.mock('../components/release-calendar', () => ({
	ReleaseCalendar: () => <div />,
}))

function setPath(pathname: string) {
	window.history.replaceState({}, '', pathname)
}

describe('injectReleaseCalendar', () => {
	beforeEach(() => {
		document.body.innerHTML = '<main class="c-main"></main>'
		mountFeatureWithBoundary.mockClear()
		isFeatureMounted.mockReturnValue(false)
		settingsState.gameReleaseCalendarJuegosEnabled = true
		setPath('/foro/juegos')
	})

	it('mounts the calendar on the Juegos subforum', () => {
		injectReleaseCalendar()

		expect(document.getElementById(DOM_MARKERS.IDS.GAME_RELEASE_CALENDAR)).not.toBeNull()
		expect(mountFeatureWithBoundary).toHaveBeenCalledWith(
			FEATURE_IDS.GAME_RELEASE_CALENDAR,
			expect.any(HTMLDivElement),
			expect.anything(),
			'Calendario de lanzamientos'
		)
	})

	it('does not mount outside Juegos', () => {
		setPath('/foro/club-hucha')

		injectReleaseCalendar()

		expect(document.getElementById(DOM_MARKERS.IDS.GAME_RELEASE_CALENDAR)).toBeNull()
		expect(mountFeatureWithBoundary).not.toHaveBeenCalled()
	})

	it('respects the Juegos setting', () => {
		settingsState.gameReleaseCalendarJuegosEnabled = false

		injectReleaseCalendar()

		expect(document.getElementById(DOM_MARKERS.IDS.GAME_RELEASE_CALENDAR)).toBeNull()
		expect(mountFeatureWithBoundary).not.toHaveBeenCalled()
	})
})
