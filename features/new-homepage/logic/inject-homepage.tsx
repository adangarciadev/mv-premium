import { createElement } from 'react'
import { FEATURE_IDS } from '@/constants/feature-ids'
import { DOM_MARKERS } from '@/constants/dom-markers'
import { mountFeature, isFeatureMounted } from '@/lib/content-modules/utils/react-helpers'
import { isFeatureEnabled, FeatureFlag } from '@/lib/feature-flags'
import { HomepageProvider } from '../components/homepage-provider'
import { Home } from '../components/home'

export function injectHomepage(): void {
	if (!isFeatureEnabled(FeatureFlag.NewHomepage)) return
	if (isFeatureMounted(FEATURE_IDS.NEW_HOMEPAGE)) return

	const mainElement = document.getElementById('main')
	if (!mainElement) return

	const contentElement = document.getElementById('content')
	if (contentElement) {
		contentElement.style.opacity = '0'
	}

	mainElement.innerHTML = ''

	// Create a wrapper with the scoped reset ID so box-sizing: border-box applies
	const wrapper = document.createElement('div')
	wrapper.id = DOM_MARKERS.IDS.NEW_HOMEPAGE_ROOT
	mainElement.appendChild(wrapper)

	mountFeature(
		FEATURE_IDS.NEW_HOMEPAGE,
		wrapper,
		createElement(
			HomepageProvider,
			null,
			createElement(Home, {
				onLoad: () => {
					if (contentElement) {
						contentElement.style.opacity = '1'
					}
				},
			})
		),
		{ withProviders: false }
	)
}
