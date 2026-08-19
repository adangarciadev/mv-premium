import { ShadowWrapper } from '@/components/shadow-wrapper'
import { DOM_MARKERS, FEATURE_IDS } from '@/constants'
import { isFeatureMounted, mountFeatureWithBoundary, unmountFeature } from '@/lib/content-modules/utils/react-helpers'
import { useSettingsStore } from '@/store/settings-store'
import { FootballCalendar } from '../components/football-calendar'

const FOOTBALL_SUBFORUM_PATH_PATTERN = /^\/foro\/deportes\/?$/

function findInsertionTarget(): Element | null {
	return (
		document.querySelector('.c-main') ||
		document.querySelector('#content') ||
		document.querySelector('main') ||
		document.body
	)
}

export function injectFootballCalendar(): void {
	if (!FOOTBALL_SUBFORUM_PATH_PATTERN.test(window.location.pathname)) return
	if (!useSettingsStore.getState().footballCalendarEnabled) return
	if (isFeatureMounted(FEATURE_IDS.FOOTBALL_CALENDAR)) return
	if (document.getElementById(DOM_MARKERS.IDS.FOOTBALL_CALENDAR)) return

	const target = findInsertionTarget()
	if (!target) return

	const container = document.createElement('div')
	container.id = DOM_MARKERS.IDS.FOOTBALL_CALENDAR
	container.style.cssText = 'display: block; margin-bottom: 10px;'
	target.insertBefore(container, target.firstChild)

	mountFeatureWithBoundary(
		FEATURE_IDS.FOOTBALL_CALENDAR,
		container,
		<ShadowWrapper>
			<FootballCalendar />
		</ShadowWrapper>,
		'Calendario de fútbol'
	)
}

export function removeFootballCalendar(): void {
	unmountFeature(FEATURE_IDS.FOOTBALL_CALENDAR)
	document.getElementById(DOM_MARKERS.IDS.FOOTBALL_CALENDAR)?.remove()
}
