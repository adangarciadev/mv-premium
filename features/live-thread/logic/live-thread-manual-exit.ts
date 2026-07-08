/**
 * Tracks a "user just manually exited Live" marker per tab session, so Auto
 * Live doesn't restart itself on the reload stopLiveMode() triggers — and
 * stays off for as long as the user remains on that same thread (across
 * page navigation), not just for the very next reload. The marker is only
 * cleared once the user navigates to a different thread. A separate
 * one-shot flag inside it controls the confirmation toast, so it fires once
 * per exit rather than on every subsequent page of the same thread.
 */
import { STORAGE_KEYS } from '@/constants'
import { logger } from '@/lib/logger'

interface ManualExitMarker {
	threadId: string
	toastPending: boolean
}

export interface ManualLiveExitCheck {
	shouldSuppress: boolean
	shouldNotify: boolean
}

function readMarker(): ManualExitMarker | null {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEYS.LIVE_MANUAL_EXIT_THREAD_ID)
		if (!raw) return null
		const parsed = JSON.parse(raw) as ManualExitMarker
		if (typeof parsed.threadId !== 'string' || typeof parsed.toastPending !== 'boolean') return null
		return parsed
	} catch (error) {
		logger.warn('LiveThread: failed to read manual exit marker', error)
		return null
	}
}

function writeMarker(marker: ManualExitMarker): void {
	try {
		sessionStorage.setItem(STORAGE_KEYS.LIVE_MANUAL_EXIT_THREAD_ID, JSON.stringify(marker))
	} catch (error) {
		logger.warn('LiveThread: failed to persist manual exit marker', error)
	}
}

function clearMarker(): void {
	try {
		sessionStorage.removeItem(STORAGE_KEYS.LIVE_MANUAL_EXIT_THREAD_ID)
	} catch (error) {
		logger.warn('LiveThread: failed to clear manual exit marker', error)
	}
}

export function markManualLiveExit(threadId: string): void {
	writeMarker({ threadId, toastPending: true })
}

export function checkManualLiveExit(threadId: string): ManualLiveExitCheck {
	const marker = readMarker()
	if (!marker || marker.threadId !== threadId) {
		if (marker) clearMarker()
		return { shouldSuppress: false, shouldNotify: false }
	}

	if (marker.toastPending) {
		writeMarker({ threadId, toastPending: false })
	}

	return { shouldSuppress: true, shouldNotify: marker.toastPending }
}
