import { ShadowWrapper } from '@/components/shadow-wrapper'
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { getPlatformKind } from '@/lib/platform'
import { createContainer, isFeatureMounted, mountFeatureWithBoundary } from '@/lib/content-modules/utils/react-helpers'
import { MobileLiteFloatingButton } from '../components/mobile-lite-floating-button'
import { initMobileLiteIgnoredUsers } from './ignored-users'

const FEATURE_ID = 'mobile-lite-floating-button'
const CONTAINER_ID = 'mvp-mobile-lite-root'

export function injectMobileLite(): void {
	if (getPlatformKind() !== 'firefox-android') return
	if (!isFeatureEnabled(FeatureFlag.MobileLite)) return

	initMobileLiteIgnoredUsers()

	if (isFeatureMounted(FEATURE_ID)) return

	const existingContainer = document.getElementById(CONTAINER_ID)
	const container =
		existingContainer ??
		createContainer({
			id: CONTAINER_ID,
			parent: document.body,
		})

	mountFeatureWithBoundary(
		FEATURE_ID,
		container,
		<ShadowWrapper>
			<MobileLiteFloatingButton />
		</ShadowWrapper>,
		'Mobile Lite'
	)
}
