import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { DOM_MARKERS, FEATURE_IDS } from '@/constants'
import { injectMovieReleaseCalendar } from './inject-movie-release-calendar'

const { mountFeatureWithBoundary, isFeatureMounted, settingsState } = vi.hoisted(() => ({
	mountFeatureWithBoundary: vi.fn(),
	isFeatureMounted: vi.fn(() => false),
	settingsState: {
		movieReleaseCalendarCineEnabled: true,
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

vi.mock('../components/movie-release-calendar', () => ({
	MovieReleaseCalendar: () => <div />,
}))

function setPath(pathname: string) {
	window.history.replaceState({}, '', pathname)
}

describe('injectMovieReleaseCalendar', () => {
	beforeEach(() => {
		document.body.innerHTML = '<main class="c-main"></main>'
		mountFeatureWithBoundary.mockClear()
		isFeatureMounted.mockReturnValue(false)
		settingsState.movieReleaseCalendarCineEnabled = true
		setPath('/foro/cine')
	})

	it('mounts the calendar on the Cine subforum', () => {
		injectMovieReleaseCalendar()

		expect(document.getElementById(DOM_MARKERS.IDS.MOVIE_RELEASE_CALENDAR)).not.toBeNull()
		expect(mountFeatureWithBoundary).toHaveBeenCalledWith(
			FEATURE_IDS.MOVIE_RELEASE_CALENDAR,
			expect.any(HTMLDivElement),
			expect.anything(),
			'Calendario de estrenos'
		)
	})

	it('does not mount outside Cine', () => {
		setPath('/foro/juegos')

		injectMovieReleaseCalendar()

		expect(document.getElementById(DOM_MARKERS.IDS.MOVIE_RELEASE_CALENDAR)).toBeNull()
		expect(mountFeatureWithBoundary).not.toHaveBeenCalled()
	})

	it('respects the Cine setting', () => {
		settingsState.movieReleaseCalendarCineEnabled = false

		injectMovieReleaseCalendar()

		expect(document.getElementById(DOM_MARKERS.IDS.MOVIE_RELEASE_CALENDAR)).toBeNull()
		expect(mountFeatureWithBoundary).not.toHaveBeenCalled()
	})
})
