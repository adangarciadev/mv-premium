import { ShadowWrapper } from '@/components/shadow-wrapper'
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { createContainer, isFeatureMounted, mountFeatureWithBoundary, unmountFeature } from '@/lib/content-modules/utils/react-helpers'
import { logger } from '@/lib/logger'
import { getPlatformKind } from '@/lib/platform'
import { getUserCustomizations, saveUserCustomizations } from '@/features/user-customizations/storage'
import {
	decodeMobileLiteTransferPayload,
	getUrlWithoutMobileLiteImportParam,
	MOBILE_LITE_IMPORT_PARAM,
	mergeMobileLiteIgnoredUsersIntoData,
	type MobileLiteTransferPayload,
} from '@/features/ignored-users-mobile-sync'
import { IgnoredUsersImportPanel } from '../components/ignored-users-import-panel'
import { dispatchMobileLiteIgnoredUsersSync } from './ignored-users-sync-event'
import { saveMobileLiteImgbbApiKey } from './imgbb-api-key-storage'

const FEATURE_ID = 'mobile-lite-ignored-users-import'
const CONTAINER_ID = 'mvp-mobile-lite-ignored-users-import-root'

function isMobileLiteIgnoredUsersImportAllowed(): boolean {
	return getPlatformKind() === 'firefox-android' && isFeatureEnabled(FeatureFlag.MobileLite)
}

export function hasIgnoredUsersImportParam(search: string = window.location.search): boolean {
	return new URLSearchParams(search).has(MOBILE_LITE_IMPORT_PARAM)
}

export function readIgnoredUsersImportPayload(search: string = window.location.search): MobileLiteTransferPayload | null {
	const encoded = new URLSearchParams(search).get(MOBILE_LITE_IMPORT_PARAM)
	if (!encoded) return null
	return decodeMobileLiteTransferPayload(encoded)
}

function cleanIgnoredUsersImportParamFromUrl(): void {
	window.history.replaceState(
		window.history.state,
		document.title,
		getUrlWithoutMobileLiteImportParam(window.location.href)
	)
}

function closeIgnoredUsersImportPanel(): void {
	unmountFeature(FEATURE_ID)
	document.getElementById(CONTAINER_ID)?.remove()
}

export async function confirmIgnoredUsersImport(payload: MobileLiteTransferPayload): Promise<void> {
	if (payload.ignoredUsers.length > 0) {
		const currentData = await getUserCustomizations()
		const result = mergeMobileLiteIgnoredUsersIntoData(currentData, payload)
		await saveUserCustomizations(result.data)
		dispatchMobileLiteIgnoredUsersSync({
			data: result.data,
		})
	}

	if (payload.imgbbApiKey) {
		await saveMobileLiteImgbbApiKey(payload.imgbbApiKey)
	}
}

function mountIgnoredUsersImportPanel(payload: MobileLiteTransferPayload | null, errorMessage: string | null): void {
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
			<IgnoredUsersImportPanel
				payload={payload}
				errorMessage={errorMessage}
				onCancel={closeIgnoredUsersImportPanel}
				onImport={() => (payload ? confirmIgnoredUsersImport(payload) : Promise.resolve())}
			/>
		</ShadowWrapper>,
		'Mobile Lite Ignored Users Import'
	)
}

export function initMobileLiteIgnoredUsersImport(): void {
	if (!isMobileLiteIgnoredUsersImportAllowed()) return
	if (!hasIgnoredUsersImportParam()) return
	if (isFeatureMounted(FEATURE_ID)) return

	let payload: MobileLiteTransferPayload | null = null
	let errorMessage: string | null = null

	try {
		payload = readIgnoredUsersImportPayload()
		if (!payload || (payload.ignoredUsers.length === 0 && !payload.imgbbApiKey)) {
			errorMessage = 'El enlace no contiene datos de Mobile Lite para importar.'
		}
	} catch (error) {
		logger.warn('Invalid Mobile Lite import payload:', error)
		errorMessage = 'El enlace de importación de Mobile Lite no es válido.'
	}

	cleanIgnoredUsersImportParamFromUrl()
	mountIgnoredUsersImportPanel(payload, errorMessage)
}

export function teardownMobileLiteIgnoredUsersImport(): void {
	closeIgnoredUsersImportPanel()
}
