/**
 * What's New Storage - Manages user progression through extension versions.
 * Tracks the last seen version to determine if notification badges should be displayed.
 */
import { storage } from '#imports'
import { getLatestVersion, getChangesSince } from './changelog'
import { STORAGE_KEYS } from '@/constants'

const STORAGE_KEY = `local:${STORAGE_KEYS.LAST_SEEN_VERSION}` as `local:${string}`

/**
 * Retrieves the version string last acknowledged by the user.
 */
export async function getLastSeenVersion(): Promise<string | null> {
	return storage.getItem<string>(STORAGE_KEY)
}

/**
 * Persists a specific version string as the last one seen by the user.
 * @param version - The version string to save
 */
export async function setLastSeenVersion(version: string): Promise<void> {
	await storage.setItem(STORAGE_KEY, version)
}

/**
 * Marks the currently installed version of the extension as seen by the user.
 */
export async function markCurrentVersionAsSeen(): Promise<void> {
	const latestVersion = getLatestVersion()
	await setLastSeenVersion(latestVersion)
}

/**
 * Determines if there are newer versions available that the user has not yet viewed.
 * @returns True if updates are available
 */
export async function hasUnseenChanges(): Promise<boolean> {
	const lastSeen = await getLastSeenVersion()
	if (!lastSeen) {
		// Usuario nuevo o storage limpio - hay novedades
		return true
	}
	const latestVersion = getLatestVersion()
	return lastSeen !== latestVersion
}

/**
 * Returns a list of all changelog entries released after the user's last seen version.
 */
export async function getUnseenChanges() {
	const lastSeen = await getLastSeenVersion()
	if (!lastSeen) {
		// Devolver todas las novedades
		return getChangesSince('')
	}
	return getChangesSince(lastSeen)
}

/**
 * Watches for changes to the last seen version (cross-tab sync).
 * Useful for updating UI elements when version is marked as seen in another tab.
 * @param callback - Function to call when the version changes
 * @returns Unwatch function
 */
export function watchVersionChanges(callback: (newVersion: string | null) => void): () => void {
	return storage.watch<string>(STORAGE_KEY, newValue => {
		callback(newValue)
	})
}
