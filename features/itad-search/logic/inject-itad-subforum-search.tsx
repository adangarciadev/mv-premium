import { ShadowWrapper } from '@/components/shadow-wrapper'
import { DOM_MARKERS, FEATURE_IDS } from '@/constants'
import { isFeatureMounted, mountFeatureWithBoundary, unmountFeature } from '@/lib/content-modules/utils/react-helpers'
import { ItadSubforumTypeahead } from '@/features/itad-search/components/itad-subforum-typeahead'
import { useSettingsStore } from '@/store/settings-store'

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

export function injectItadSubforumSearch(): void {
	if (!isJuegosSubforumPage()) return
	if (!useSettingsStore.getState().itadSubforumSearchEnabled) return
	if (isFeatureMounted(FEATURE_IDS.ITAD_SUBFORUM_SEARCH)) return
	if (document.getElementById(DOM_MARKERS.IDS.ITAD_SUBFORUM_SEARCH)) return

	const target = findInsertionTarget()
	if (!target) return

	const container = document.createElement('div')
	container.id = DOM_MARKERS.IDS.ITAD_SUBFORUM_SEARCH
	container.style.cssText = 'display: block; margin-bottom: 10px;'

	target.insertBefore(container, target.firstChild)

	mountFeatureWithBoundary(
		FEATURE_IDS.ITAD_SUBFORUM_SEARCH,
		container,
		<ShadowWrapper>
			<ItadSubforumTypeahead />
		</ShadowWrapper>,
		'Buscador de ofertas ITAD'
	)
}

export function removeItadSubforumSearch(): void {
	unmountFeature(FEATURE_IDS.ITAD_SUBFORUM_SEARCH)
	document.getElementById(DOM_MARKERS.IDS.ITAD_SUBFORUM_SEARCH)?.remove()
}

export async function setItadSubforumSearchEnabled(enabled: boolean): Promise<void> {
	useSettingsStore.getState().setSetting('itadSubforumSearchEnabled', enabled)

	if (enabled) {
		injectItadSubforumSearch()
		return
	}

	removeItadSubforumSearch()
}

export async function toggleItadSubforumSearch(): Promise<void> {
	const enabled = !useSettingsStore.getState().itadSubforumSearchEnabled
	await setItadSubforumSearchEnabled(enabled)
}
