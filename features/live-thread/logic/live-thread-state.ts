/**
 * Live Thread State Management
 *
 * Handles state persistence and storage for live thread mode.
 */
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'

// =============================================================================
// TYPES
// =============================================================================

export interface LiveThreadState {
	enabled: boolean
	lastSeenPostNum: number
	timestamp: number
}

export interface PostInfo {
	num: number
	html: string
	timestamp?: number
}

export type LiveStatus = 'connected' | 'updating' | 'error' | 'paused'

// =============================================================================
// CONSTANTS
// =============================================================================

export const MAX_VISIBLE_POSTS = 30

export const POLL_INTERVALS = {
	HIGH_ACTIVITY: 5000,
	NORMAL: 10000,
	LOW_ACTIVITY: 20000,
	INACTIVE: 45000,
}

export type PollInterval = typeof POLL_INTERVALS[keyof typeof POLL_INTERVALS]

// =============================================================================
// STORAGE
// =============================================================================

const liveThreadsStorage = storage.defineItem<Record<string, LiveThreadState>>(`local:${STORAGE_KEYS.LIVE_THREADS}`, {
	defaultValue: {},
})

// =============================================================================
// RUNTIME STATE
// =============================================================================

let currentThreadId = ''

export function setCurrentThreadId(id: string): void {
	currentThreadId = id
}

export function getCurrentThreadId(): string {
	return currentThreadId
}

// =============================================================================
// STATE PERSISTENCE
// =============================================================================

/**
 * Retrieves the persisted live state for the current thread from storage.
 */
export async function loadLiveState(): Promise<LiveThreadState | null> {
	const states = await liveThreadsStorage.getValue()
	return states[currentThreadId] ?? null
}

/**
 * Persists the live state for the current thread to storage.
 * @param state - The LiveThreadState object to save
 */
export async function saveLiveState(state: LiveThreadState): Promise<void> {
	const states = await liveThreadsStorage.getValue()
	states[currentThreadId] = state
	await liveThreadsStorage.setValue(states)
}

/**
 * Removes the live state for the current thread from storage.
 */
export async function clearLiveState(): Promise<void> {
	const states = await liveThreadsStorage.getValue()
	delete states[currentThreadId]
	await liveThreadsStorage.setValue(states)
}
