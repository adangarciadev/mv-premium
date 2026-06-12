import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { DOM_MARKERS, FEATURE_IDS } from '@/constants'
import { injectReleaseCalendar, toggleReleaseCalendarJuegosMovil } from './inject-release-calendar'

const { mountFeatureWithBoundary, isFeatureMounted, unmountFeature, settingsState } = vi.hoisted(() => ({
	mountFeatureWithBoundary: vi.fn(),
	isFeatureMounted: vi.fn(() => false),
	unmountFeature: vi.fn(),
	settingsState: {
		gameReleaseCalendarJuegosEnabled: true,
		gameReleaseCalendarJuegosMovilEnabled: true,
		setSetting: vi.fn((key: 'gameReleaseCalendarJuegosEnabled' | 'gameReleaseCalendarJuegosMovilEnabled', value: boolean) => {
			settingsState[key] = value
		}),
	},
}))

vi.mock('@/lib/content-modules/utils/react-helpers', () => ({
	isFeatureMounted,
	mountFeatureWithBoundary,
	unmountFeature,
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
		unmountFeature.mockClear()
		settingsState.gameReleaseCalendarJuegosEnabled = true
		settingsState.gameReleaseCalendarJuegosMovilEnabled = true
		settingsState.setSetting.mockClear()
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

	it('mounts the mobile calendar on the Juegos de móvil subforum', () => {
		setPath('/foro/juegos-movil')

		injectReleaseCalendar()

		expect(document.getElementById(DOM_MARKERS.IDS.GAME_RELEASE_CALENDAR_MOVIL)).not.toBeNull()
		expect(document.getElementById(DOM_MARKERS.IDS.GAME_RELEASE_CALENDAR)).toBeNull()
		expect(mountFeatureWithBoundary).toHaveBeenCalledWith(
			FEATURE_IDS.GAME_RELEASE_CALENDAR_MOVIL,
			expect.any(HTMLDivElement),
			expect.anything(),
			'Calendario de lanzamientos'
		)
	})

	it('respects the Juegos de móvil setting independently', () => {
		settingsState.gameReleaseCalendarJuegosMovilEnabled = false
		setPath('/foro/juegos-movil')

		injectReleaseCalendar()

		expect(document.getElementById(DOM_MARKERS.IDS.GAME_RELEASE_CALENDAR_MOVIL)).toBeNull()
		expect(mountFeatureWithBoundary).not.toHaveBeenCalled()

		// The Juegos calendar must keep working with its own setting
		setPath('/foro/juegos')
		injectReleaseCalendar()

		expect(document.getElementById(DOM_MARKERS.IDS.GAME_RELEASE_CALENDAR)).not.toBeNull()
	})

	it('toggles the Juegos de móvil calendar setting explicitly', async () => {
		document.body.innerHTML = `<main class="c-main"><div id="${DOM_MARKERS.IDS.GAME_RELEASE_CALENDAR_MOVIL}"></div></main>`

		await toggleReleaseCalendarJuegosMovil()

		expect(settingsState.setSetting).toHaveBeenCalledWith('gameReleaseCalendarJuegosMovilEnabled', false)
		expect(unmountFeature).toHaveBeenCalledWith(FEATURE_IDS.GAME_RELEASE_CALENDAR_MOVIL)
		expect(document.getElementById(DOM_MARKERS.IDS.GAME_RELEASE_CALENDAR_MOVIL)).toBeNull()
		expect(settingsState.gameReleaseCalendarJuegosEnabled).toBe(true)
	})
})
