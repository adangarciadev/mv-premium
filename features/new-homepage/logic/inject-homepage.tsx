import { createElement } from 'react'
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { FEATURE_IDS } from '@/constants/feature-ids'
import { DOM_MARKERS } from '@/constants/dom-markers'
import { isFeatureEnabled, FeatureFlag } from '@/lib/feature-flags'
import { isFeatureMounted, mountFeatureWithBoundary } from '@/lib/content-modules/utils/react-helpers'
import { Home } from '../components/home'

export function injectHomepage(): void {
	if (!isFeatureEnabled(FeatureFlag.NewHomepage)) return
	if (isFeatureMounted(FEATURE_IDS.NEW_HOMEPAGE)) return

	const mainElement = document.getElementById('main')
	if (!mainElement) return

	mainElement.replaceChildren()

	const container = document.createElement('div')
	container.id = DOM_MARKERS.IDS.NEW_HOMEPAGE_ROOT
	mainElement.appendChild(container)

	mountFeatureWithBoundary(
		FEATURE_IDS.NEW_HOMEPAGE,
		container,
		createElement(ShadowWrapper, {
			children: createElement(Home),
		}),
		'Nueva Portada'
	)
}
