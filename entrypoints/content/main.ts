/**
 * Content Script Main
 *
 * Lightweight platform bootstrap. Desktop-only initialization is dynamically
 * imported after the Firefox Android Mobile Lite path has had a chance to exit.
 */
import { useSettingsStore, waitForHydration } from '@/store/settings-store'
import { logger } from '@/lib/logger'
import { getPlatformKind } from '@/lib/platform'
import {
	getMobileLiteDevActivation,
	getUrlWithoutMobileLiteDevParam,
	hasMobileLiteIgnoredUsersDevSeed,
} from '@/features/mobile-lite/logic/dev-activation'
import { seedMobileLiteIgnoredUsersForDev } from '@/features/mobile-lite/logic/dev-ignored-users-seed'

export async function runContentMain(ctx: unknown): Promise<void> {
	if (getPlatformKind() === 'firefox-android') {
		useSettingsStore.persist.rehydrate()
		await waitForHydration()

		const devActivation = getMobileLiteDevActivation(window.location.search, window.location.hash)
		const seedIgnoredUsers = hasMobileLiteIgnoredUsersDevSeed(window.location.search, window.location.hash)
		if (devActivation) {
			useSettingsStore.getState().setSetting('mobileLiteEnabled', devActivation === 'enable')
			logger.info(`Mobile Lite dev activation: ${devActivation}`)
		}

		if (seedIgnoredUsers) {
			await seedMobileLiteIgnoredUsersForDev()
			logger.info('Mobile Lite ignored users dev seed applied')
		}

		if (devActivation || seedIgnoredUsers) {
			window.history.replaceState(window.history.state, document.title, getUrlWithoutMobileLiteDevParam(window.location.href))
		}

		let mobileLiteEnabled = useSettingsStore.getState().mobileLiteEnabled
		if (!devActivation && !mobileLiteEnabled) {
			useSettingsStore.getState().setSetting('mobileLiteEnabled', true)
			mobileLiteEnabled = true
			logger.info('Mobile Lite auto-enabled on Firefox Android')
		}

		if (!mobileLiteEnabled) {
			logger.debug('Skipping content main on Firefox Android because mobile lite is disabled')
			return
		}

		const { initMobileLite } = await import('@/features/mobile-lite')
		initMobileLite()
		return
	}

	const { runDesktopContentMain } = await import('./desktop-main')
	await runDesktopContentMain(ctx)
}
