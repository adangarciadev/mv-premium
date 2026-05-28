import { ShadowWrapper } from '@/components/shadow-wrapper'
import { DOM_MARKERS, FEATURE_IDS } from '@/constants'
import { isFeatureMounted, mountFeatureWithBoundary, unmountFeature } from '@/lib/content-modules/utils/react-helpers'
import { useSettingsStore } from '@/store/settings-store'
import { MovieReleaseCalendar } from '../components/movie-release-calendar'

const CINE_SUBFORUM_PATH_PATTERN = /^\/foro\/cine\/?$/

function isCineSubforumPage(): boolean {
	return CINE_SUBFORUM_PATH_PATTERN.test(window.location.pathname)
}

function findInsertionTarget(): Element | null {
	return (
		document.querySelector('.c-main') ||
		document.querySelector('#content') ||
		document.querySelector('main') ||
		document.body
	)
}

export function injectMovieReleaseCalendar(): void {
	if (!isCineSubforumPage()) return
	if (!useSettingsStore.getState().movieReleaseCalendarCineEnabled) return
	if (isFeatureMounted(FEATURE_IDS.MOVIE_RELEASE_CALENDAR)) return
	if (document.getElementById(DOM_MARKERS.IDS.MOVIE_RELEASE_CALENDAR)) return

	const target = findInsertionTarget()
	if (!target) return

	const container = document.createElement('div')
	container.id = DOM_MARKERS.IDS.MOVIE_RELEASE_CALENDAR
	container.style.cssText = 'display: block; margin-bottom: 10px;'

	target.insertBefore(container, target.firstChild)

	mountFeatureWithBoundary(
		FEATURE_IDS.MOVIE_RELEASE_CALENDAR,
		container,
		<ShadowWrapper>
			<MovieReleaseCalendar />
		</ShadowWrapper>,
		'Calendario de estrenos'
	)
}

export function removeMovieReleaseCalendar(): void {
	unmountFeature(FEATURE_IDS.MOVIE_RELEASE_CALENDAR)
	document.getElementById(DOM_MARKERS.IDS.MOVIE_RELEASE_CALENDAR)?.remove()
}

export async function setMovieReleaseCalendarCineEnabled(enabled: boolean): Promise<void> {
	useSettingsStore.getState().setSetting('movieReleaseCalendarCineEnabled', enabled)

	if (enabled) {
		injectMovieReleaseCalendar()
		return
	}

	removeMovieReleaseCalendar()
}

export async function toggleMovieReleaseCalendarCine(): Promise<void> {
	const enabled = !useSettingsStore.getState().movieReleaseCalendarCineEnabled
	await setMovieReleaseCalendarCineEnabled(enabled)
}
