import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'
import { CHANGELOG, getLatestVersion, type ChangeEntry, type ChangelogEntry } from '@/features/dashboard/lib/changelog'

declare const __MVP_BUILD_ID__: string

const STORAGE_KEY = `local:${STORAGE_KEYS.MOBILE_LITE_LAST_SEEN_VERSION}` as `local:${string}`
const SEEN_ID_SEPARATOR = '|'

export type MobileLiteChangeEntry = ChangeEntry & {
	surface: 'mobile-lite' | 'shared' | Array<'desktop' | 'mobile-lite' | 'shared'>
}

export interface MobileLiteChangelogEntry extends ChangelogEntry {
	changes: MobileLiteChangeEntry[]
}

function getChangeSurfaces(change: ChangeEntry): Array<'desktop' | 'mobile-lite' | 'shared'> {
	if (Array.isArray(change.surface)) return change.surface
	if (change.surface) return [change.surface]
	return ['desktop']
}

export function isMobileLiteRelevantChange(change: ChangeEntry): change is MobileLiteChangeEntry {
	const surfaces = getChangeSurfaces(change)
	return surfaces.includes('mobile-lite') || surfaces.includes('shared')
}

export function getMobileLiteChangelog(): MobileLiteChangelogEntry[] {
	return CHANGELOG.map(entry => ({
		...entry,
		changes: entry.changes.filter(isMobileLiteRelevantChange),
	})).filter(entry => entry.changes.length > 0)
}

export function getLatestMobileLiteVersion(): string {
	return getMobileLiteChangelog()[0]?.version ?? getLatestVersion()
}

function getMobileLiteBuildId(): string {
	return typeof __MVP_BUILD_ID__ === 'string' && __MVP_BUILD_ID__ ? __MVP_BUILD_ID__ : 'runtime'
}

export function getCurrentMobileLiteSeenId(): string {
	return `${getLatestMobileLiteVersion()}${SEEN_ID_SEPARATOR}${getMobileLiteBuildId()}`
}

function getStoredMobileLiteVersion(seenId: string | null): string | null {
	if (!seenId) return null
	return seenId.split(SEEN_ID_SEPARATOR)[0] || null
}

export function getLatestMobileLiteEntry(): MobileLiteChangelogEntry | null {
	return getMobileLiteChangelog()[0] ?? null
}

export function getMobileLiteChangesSince(version: string | null): MobileLiteChangelogEntry[] {
	const entries = getMobileLiteChangelog()
	if (!version) return entries

	const index = entries.findIndex(entry => entry.version === version)
	if (index === -1) return entries
	return entries.slice(0, index)
}

export async function getMobileLiteLastSeenVersion(): Promise<string | null> {
	return storage.getItem<string>(STORAGE_KEY)
}

export async function markCurrentMobileLiteVersionAsSeen(): Promise<void> {
	await storage.setItem(STORAGE_KEY, getCurrentMobileLiteSeenId())
}

export async function resetMobileLiteWhatsNew(): Promise<void> {
	await storage.removeItem(STORAGE_KEY)
}

export async function hasUnseenMobileLiteChanges(): Promise<boolean> {
	const lastSeen = await getMobileLiteLastSeenVersion()
	return lastSeen !== getCurrentMobileLiteSeenId()
}

export async function getUnseenMobileLiteChanges(): Promise<MobileLiteChangelogEntry[]> {
	return getMobileLiteChangesSince(getStoredMobileLiteVersion(await getMobileLiteLastSeenVersion()))
}

export function watchMobileLiteVersionChanges(callback: (newVersion: string | null) => void): () => void {
	return storage.watch<string>(STORAGE_KEY, newValue => {
		callback(newValue)
	})
}
