import { ShadowWrapper } from '@/components/shadow-wrapper'
import { DOM_MARKERS, FEATURE_IDS } from '@/constants'
import { isFeatureMounted, mountFeatureWithBoundary, unmountFeature } from '@/lib/content-modules/utils/react-helpers'
import { ItadSubforumTypeahead } from '@/features/itad-search/components/itad-subforum-typeahead'
import { useSettingsStore } from '@/store/settings-store'

const DEALS_SUBFORUM_PATH_PATTERN = /^\/foro\/(?:juegos|club-hucha)\/?$/
type ItadDealsSubforum = 'juegos' | 'club-hucha'

function isDealsSubforumPage(): boolean {
	return DEALS_SUBFORUM_PATH_PATTERN.test(window.location.pathname)
}

function getCurrentDealsSubforum(): ItadDealsSubforum | null {
	const match = /^\/foro\/(juegos|club-hucha)\/?$/.exec(window.location.pathname)
	return (match?.[1] as ItadDealsSubforum | undefined) ?? null
}

function getSettingKey(subforum: ItadDealsSubforum): 'itadSubforumSearchJuegosEnabled' | 'itadSubforumSearchHuchaEnabled' {
	return subforum === 'juegos' ? 'itadSubforumSearchJuegosEnabled' : 'itadSubforumSearchHuchaEnabled'
}

function isItadSubforumSearchEnabled(): boolean {
	const subforum = getCurrentDealsSubforum()
	if (!subforum) return false
	return useSettingsStore.getState()[getSettingKey(subforum)]
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
	if (!isDealsSubforumPage()) return
	if (!isItadSubforumSearchEnabled()) return
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

export async function setItadSubforumSearchEnabled(subforum: ItadDealsSubforum, enabled: boolean): Promise<void> {
	useSettingsStore.getState().setSetting(getSettingKey(subforum), enabled)

	if (enabled && getCurrentDealsSubforum() === subforum) {
		injectItadSubforumSearch()
		return
	}

	if (getCurrentDealsSubforum() === subforum) {
		removeItadSubforumSearch()
	}
}

export async function toggleItadSubforumSearch(subforum?: ItadDealsSubforum): Promise<void> {
	const targetSubforum = subforum ?? getCurrentDealsSubforum()
	if (!targetSubforum) return

	const settingKey = getSettingKey(targetSubforum)
	const enabled = !useSettingsStore.getState()[settingKey]
	await setItadSubforumSearchEnabled(targetSubforum, enabled)
}
