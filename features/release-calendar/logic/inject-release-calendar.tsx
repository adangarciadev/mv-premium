import { ShadowWrapper } from '@/components/shadow-wrapper'
import { DOM_MARKERS, FEATURE_IDS } from '@/constants'
import { isFeatureMounted, mountFeatureWithBoundary, unmountFeature } from '@/lib/content-modules/utils/react-helpers'
import { useSettingsStore } from '@/store/settings-store'
import { ReleaseCalendar, type ReleaseCalendarVariant } from '../components/release-calendar'

const JUEGOS_SUBFORUM_PATH_PATTERN = /^\/foro\/juegos\/?$/
const JUEGOS_MOVIL_SUBFORUM_PATH_PATTERN = /^\/foro\/juegos-movil\/?$/

interface CalendarTarget {
	variant: ReleaseCalendarVariant
	featureId: string
	domId: string
	settingKey: 'gameReleaseCalendarJuegosEnabled' | 'gameReleaseCalendarJuegosMovilEnabled'
}

const CALENDAR_TARGETS: CalendarTarget[] = [
	{
		variant: 'juegos',
		featureId: FEATURE_IDS.GAME_RELEASE_CALENDAR,
		domId: DOM_MARKERS.IDS.GAME_RELEASE_CALENDAR,
		settingKey: 'gameReleaseCalendarJuegosEnabled',
	},
	{
		variant: 'juegos-movil',
		featureId: FEATURE_IDS.GAME_RELEASE_CALENDAR_MOVIL,
		domId: DOM_MARKERS.IDS.GAME_RELEASE_CALENDAR_MOVIL,
		settingKey: 'gameReleaseCalendarJuegosMovilEnabled',
	},
]

function getCurrentCalendarTarget(): CalendarTarget | null {
	const pathname = window.location.pathname
	if (JUEGOS_SUBFORUM_PATH_PATTERN.test(pathname)) return CALENDAR_TARGETS[0]
	if (JUEGOS_MOVIL_SUBFORUM_PATH_PATTERN.test(pathname)) return CALENDAR_TARGETS[1]
	return null
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
	const calendarTarget = getCurrentCalendarTarget()
	if (!calendarTarget) return
	if (!useSettingsStore.getState()[calendarTarget.settingKey]) return
	if (isFeatureMounted(calendarTarget.featureId)) return
	if (document.getElementById(calendarTarget.domId)) return

	const target = findInsertionTarget()
	if (!target) return

	const container = document.createElement('div')
	container.id = calendarTarget.domId
	container.style.cssText = 'display: block; margin-bottom: 10px;'

	target.insertBefore(container, target.firstChild)

	mountFeatureWithBoundary(
		calendarTarget.featureId,
		container,
		<ShadowWrapper>
			<ReleaseCalendar variant={calendarTarget.variant} />
		</ShadowWrapper>,
		'Calendario de lanzamientos'
	)
}

export function removeReleaseCalendar(): void {
	for (const calendarTarget of CALENDAR_TARGETS) {
		unmountFeature(calendarTarget.featureId)
		document.getElementById(calendarTarget.domId)?.remove()
	}
}

export async function setReleaseCalendarJuegosEnabled(enabled: boolean): Promise<void> {
	// Operates on the calendar of the current page (juegos or juegos-movil),
	// falling back to the juegos setting outside both subforums.
	const calendarTarget = getCurrentCalendarTarget() ?? CALENDAR_TARGETS[0]
	await setReleaseCalendarTargetEnabled(calendarTarget, enabled)
}

async function setReleaseCalendarTargetEnabled(calendarTarget: CalendarTarget, enabled: boolean): Promise<void> {
	useSettingsStore.getState().setSetting(calendarTarget.settingKey, enabled)

	if (enabled) {
		injectReleaseCalendar()
		return
	}

	unmountFeature(calendarTarget.featureId)
	document.getElementById(calendarTarget.domId)?.remove()
}

export async function setReleaseCalendarJuegosMovilEnabled(enabled: boolean): Promise<void> {
	await setReleaseCalendarTargetEnabled(CALENDAR_TARGETS[1], enabled)
}

export async function toggleReleaseCalendarJuegos(): Promise<void> {
	const calendarTarget = getCurrentCalendarTarget() ?? CALENDAR_TARGETS[0]
	const enabled = !useSettingsStore.getState()[calendarTarget.settingKey]
	await setReleaseCalendarJuegosEnabled(enabled)
}

export async function toggleReleaseCalendarJuegosMovil(): Promise<void> {
	const calendarTarget = CALENDAR_TARGETS[1]
	const enabled = !useSettingsStore.getState()[calendarTarget.settingKey]
	await setReleaseCalendarJuegosMovilEnabled(enabled)
}
