import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { DOM_MARKERS, FEATURE_IDS } from '@/constants'
import { injectFootballCalendar } from './inject-football-calendar'

const { mountFeatureWithBoundary, isFeatureMounted, settingsState } = vi.hoisted(() => ({
	mountFeatureWithBoundary: vi.fn(),
	isFeatureMounted: vi.fn(() => false),
	settingsState: {
		footballCalendarEnabled: true,
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

vi.mock('../components/football-calendar', () => ({
	FootballCalendar: () => <div />,
}))

function setPath(pathname: string) {
	window.history.replaceState({}, '', pathname)
}

describe('injectFootballCalendar', () => {
	beforeEach(() => {
		document.body.innerHTML = '<main class="c-main"></main>'
		mountFeatureWithBoundary.mockClear()
		isFeatureMounted.mockReturnValue(false)
		settingsState.footballCalendarEnabled = true
		setPath('/foro/deportes')
	})

	it('injects on the Deportes subforum', () => {
		injectFootballCalendar()

		expect(document.getElementById(DOM_MARKERS.IDS.FOOTBALL_CALENDAR)).not.toBeNull()
		expect(mountFeatureWithBoundary).toHaveBeenCalledWith(
			FEATURE_IDS.FOOTBALL_CALENDAR,
			expect.any(HTMLDivElement),
			expect.anything(),
			'Calendario de fútbol'
		)
	})

	it.each(['/foro/juegos', '/foro', '/foro/deportes/algo-123'])('does not inject on %s', path => {
		setPath(path)

		injectFootballCalendar()

		expect(document.getElementById(DOM_MARKERS.IDS.FOOTBALL_CALENDAR)).toBeNull()
		expect(mountFeatureWithBoundary).not.toHaveBeenCalled()
	})

	it('does not inject when the feature is disabled', () => {
		settingsState.footballCalendarEnabled = false

		injectFootballCalendar()

		expect(document.getElementById(DOM_MARKERS.IDS.FOOTBALL_CALENDAR)).toBeNull()
		expect(mountFeatureWithBoundary).not.toHaveBeenCalled()
	})

	it('does not inject twice when the marker already exists', () => {
		injectFootballCalendar()

		injectFootballCalendar()

		expect(mountFeatureWithBoundary).toHaveBeenCalledTimes(1)
		expect(document.querySelectorAll(`#${DOM_MARKERS.IDS.FOOTBALL_CALENDAR}`)).toHaveLength(1)
	})
})
