/**
 * Native Live Delay - Storage
 *
 * Persists user's preferred delay setting for native LIVE threads.
 */

import { storage } from '@wxt-dev/storage'
import { STORAGE_KEYS } from '@/constants/storage-keys'

/**
 * Storage for the user's preferred delay in milliseconds.
 * Default is 0 (no delay / real-time).
 */
export const nativeLiveDelayStorage = storage.defineItem<number>(`local:${STORAGE_KEYS.NATIVE_LIVE_DELAY}`, {
	defaultValue: 0,
})
