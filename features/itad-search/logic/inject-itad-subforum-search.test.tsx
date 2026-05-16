import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { DOM_MARKERS, FEATURE_IDS } from '@/constants'
import { injectItadSubforumSearch } from './inject-itad-subforum-search'

const { mountFeatureWithBoundary, isFeatureMounted, settingsState } = vi.hoisted(() => ({
	mountFeatureWithBoundary: vi.fn(),
	isFeatureMounted: vi.fn(() => false),
	settingsState: {
		itadSubforumSearchJuegosEnabled: true,
		itadSubforumSearchHuchaEnabled: true,
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

vi.mock('@/features/itad-search/components/itad-subforum-typeahead', () => ({
	ItadSubforumTypeahead: () => <div />,
}))

vi.mock('@/store/settings-store', () => ({
	useSettingsStore: {
		getState: vi.fn(() => settingsState),
	},
}))

function setPath(pathname: string) {
	window.history.replaceState({}, '', pathname)
}

describe('injectItadSubforumSearch', () => {
	beforeEach(() => {
		document.body.innerHTML = '<main class="c-main"></main>'
		mountFeatureWithBoundary.mockClear()
		isFeatureMounted.mockReturnValue(false)
		settingsState.itadSubforumSearchJuegosEnabled = true
		settingsState.itadSubforumSearchHuchaEnabled = true
	})

	it('mounts on Juegos', () => {
		setPath('/foro/juegos')

		injectItadSubforumSearch()

		expect(document.getElementById(DOM_MARKERS.IDS.ITAD_SUBFORUM_SEARCH)).not.toBeNull()
		expect(mountFeatureWithBoundary).toHaveBeenCalledWith(
			FEATURE_IDS.ITAD_SUBFORUM_SEARCH,
			expect.any(HTMLDivElement),
			expect.anything(),
			'Buscador de ofertas ITAD'
		)
	})

	it('mounts on Club de la hucha', () => {
		setPath('/foro/club-hucha')

		injectItadSubforumSearch()

		expect(document.getElementById(DOM_MARKERS.IDS.ITAD_SUBFORUM_SEARCH)).not.toBeNull()
		expect(mountFeatureWithBoundary).toHaveBeenCalled()
	})

	it('does not mount on unrelated subforums', () => {
		setPath('/foro/cine')

		injectItadSubforumSearch()

		expect(document.getElementById(DOM_MARKERS.IDS.ITAD_SUBFORUM_SEARCH)).toBeNull()
		expect(mountFeatureWithBoundary).not.toHaveBeenCalled()
	})

	it('respects per-subforum settings', () => {
		settingsState.itadSubforumSearchHuchaEnabled = false
		setPath('/foro/club-hucha')

		injectItadSubforumSearch()

		expect(document.getElementById(DOM_MARKERS.IDS.ITAD_SUBFORUM_SEARCH)).toBeNull()
		expect(mountFeatureWithBoundary).not.toHaveBeenCalled()
	})
})
