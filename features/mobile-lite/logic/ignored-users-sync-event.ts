import type { UserCustomizationsData } from '@/features/user-customizations/storage'
import type { MobileLiteIgnoreType } from './ignore-helpers'

export const MOBILE_LITE_IGNORED_USERS_SYNC_EVENT = 'mvp-mobile-lite-ignored-users:sync'

export interface MobileLiteIgnoredUsersSyncDetail {
	data: UserCustomizationsData
	manualChange?: {
		storageKey: string
		ignoreType: MobileLiteIgnoreType | null
	}
}

export function dispatchMobileLiteIgnoredUsersSync(detail: MobileLiteIgnoredUsersSyncDetail): void {
	window.dispatchEvent(new CustomEvent(MOBILE_LITE_IGNORED_USERS_SYNC_EVENT, { detail }))
}
