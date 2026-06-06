import { ShadowWrapper } from '@/components/shadow-wrapper'
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { createContainer, isFeatureMounted, mountFeatureWithBoundary, unmountFeature } from '@/lib/content-modules/utils/react-helpers'
import { logger } from '@/lib/logger'
import { getPlatformKind } from '@/lib/platform'
import { getUserCustomizations, saveUserCustomizations } from '@/features/user-customizations/storage'
import {
	decodeIgnoredUsersSyncPayload,
	getUrlWithoutIgnoredUsersImportParam,
	IGNORED_USERS_IMPORT_PARAM,
	mergeIgnoredUsersIntoData,
	type IgnoredUsersSyncPayload,
} from '@/features/ignored-users-mobile-sync'
import { IgnoredUsersImportPanel } from '../components/ignored-users-import-panel'
import { dispatchMobileLiteIgnoredUsersSync } from './ignored-users-sync-event'

const FEATURE_ID = 'mobile-lite-ignored-users-import'
const CONTAINER_ID = 'mvp-mobile-lite-ignored-users-import-root'

function isMobileLiteIgnoredUsersImportAllowed(): boolean {
	return getPlatformKind() === 'firefox-android' && isFeatureEnabled(FeatureFlag.MobileLite)
}

export function hasIgnoredUsersImportParam(search: string = window.location.search): boolean {
	return new URLSearchParams(search).has(IGNORED_USERS_IMPORT_PARAM)
}

export function readIgnoredUsersImportPayload(search: string = window.location.search): IgnoredUsersSyncPayload | null {
	const encoded = new URLSearchParams(search).get(IGNORED_USERS_IMPORT_PARAM)
	if (!encoded) return null
	return decodeIgnoredUsersSyncPayload(encoded)
}

function cleanIgnoredUsersImportParamFromUrl(): void {
	window.history.replaceState(
		window.history.state,
		document.title,
		getUrlWithoutIgnoredUsersImportParam(window.location.href)
	)
}

function closeIgnoredUsersImportPanel(): void {
	unmountFeature(FEATURE_ID)
	document.getElementById(CONTAINER_ID)?.remove()
}

export async function confirmIgnoredUsersImport(payload: IgnoredUsersSyncPayload): Promise<void> {
	const currentData = await getUserCustomizations()
	const result = mergeIgnoredUsersIntoData(currentData, payload)
	await saveUserCustomizations(result.data)
	dispatchMobileLiteIgnoredUsersSync({
		data: result.data,
	})
}

function mountIgnoredUsersImportPanel(payload: IgnoredUsersSyncPayload | null, errorMessage: string | null): void {
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

	let payload: IgnoredUsersSyncPayload | null = null
	let errorMessage: string | null = null

	try {
		payload = readIgnoredUsersImportPayload()
		if (!payload || payload.users.length === 0) {
			errorMessage = 'El enlace no contiene usuarios ignorados para importar.'
		}
	} catch (error) {
		logger.warn('Invalid Mobile Lite ignored users import payload:', error)
		errorMessage = 'El enlace de importación no es válido.'
	}

	cleanIgnoredUsersImportParamFromUrl()
	mountIgnoredUsersImportPanel(payload, errorMessage)
}

export function teardownMobileLiteIgnoredUsersImport(): void {
	closeIgnoredUsersImportPanel()
}
