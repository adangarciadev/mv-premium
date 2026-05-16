import { ShadowWrapper } from '@/components/shadow-wrapper'
import { DOM_MARKERS, FEATURE_IDS } from '@/constants'
import { isFeatureMounted, mountFeatureWithBoundary, unmountFeature } from '@/lib/content-modules/utils/react-helpers'
import { useSettingsStore } from '@/store/settings-store'
import { ReleaseCalendar } from '../components/release-calendar'

const JUEGOS_SUBFORUM_PATH_PATTERN = /^\/foro\/juegos\/?$/

function isJuegosSubforumPage(): boolean {
	return JUEGOS_SUBFORUM_PATH_PATTERN.test(window.location.pathname)
}

function findInsertionTarget(): Element | null {
	return (
		document.querySelector('.c-main') ||
		document.querySelector('#content') ||
		document.querySelector('main') ||
		document.body
	)
}

export function injectReleaseCalendar(): void {
	if (!isJuegosSubforumPage()) return
	if (!useSettingsStore.getState().gameReleaseCalendarJuegosEnabled) return
	if (isFeatureMounted(FEATURE_IDS.GAME_RELEASE_CALENDAR)) return
	if (document.getElementById(DOM_MARKERS.IDS.GAME_RELEASE_CALENDAR)) return

	const target = findInsertionTarget()
	if (!target) return

	const container = document.createElement('div')
	container.id = DOM_MARKERS.IDS.GAME_RELEASE_CALENDAR
	container.style.cssText = 'display: block; margin-bottom: 10px;'

	target.insertBefore(container, target.firstChild)

	mountFeatureWithBoundary(
		FEATURE_IDS.GAME_RELEASE_CALENDAR,
		container,
		<ShadowWrapper>
			<ReleaseCalendar />
		</ShadowWrapper>,
		'Calendario de lanzamientos'
	)
}

export function removeReleaseCalendar(): void {
	unmountFeature(FEATURE_IDS.GAME_RELEASE_CALENDAR)
	document.getElementById(DOM_MARKERS.IDS.GAME_RELEASE_CALENDAR)?.remove()
}

export async function setReleaseCalendarJuegosEnabled(enabled: boolean): Promise<void> {
	useSettingsStore.getState().setSetting('gameReleaseCalendarJuegosEnabled', enabled)

	if (enabled) {
		injectReleaseCalendar()
		return
	}

	removeReleaseCalendar()
}

export async function toggleReleaseCalendarJuegos(): Promise<void> {
	const enabled = !useSettingsStore.getState().gameReleaseCalendarJuegosEnabled
	await setReleaseCalendarJuegosEnabled(enabled)
}
