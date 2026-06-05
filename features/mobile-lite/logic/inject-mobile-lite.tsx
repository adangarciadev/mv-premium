import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { getPlatformKind } from '@/lib/platform'
import { initMobileLiteEditorEnhancements } from './editor-lite'
import { initMobileLiteIgnoredUsers } from './ignored-users'
import { initMobileLitePanel } from './panel'

export function injectMobileLite(): void {
	if (getPlatformKind() !== 'firefox-android') return
	if (!isFeatureEnabled(FeatureFlag.MobileLite)) return

	initMobileLiteIgnoredUsers()
	initMobileLiteEditorEnhancements()
	initMobileLitePanel()
}
