import { storage } from '#imports'
import { logger } from '@/lib/logger'
import { browser } from 'wxt/browser'
import { STORAGE_KEYS } from '@/constants/storage-keys'
import { getDecompressedSnapshot, setFromImport } from '@/lib/storage/compressed-storage'

export interface ExportData {
	version: number
	timestamp: number
	data: Record<string, any>
}

const CURRENT_EXPORT_VERSION = 2

/**
 * Keys to exclude from export/import
 */
const EXCLUDED_KEYS = [
	`local:${STORAGE_KEYS.BOOKMARKS_VIEW_MODE}`, // View preference that shouldn't survive reset/import
	// Add other keys to exclude here if needed
]

/**
 * Filter and process storage items for export
 */
function shouldExportKey(key: string): boolean {
	// Only export our extension's keys
	if (!key.startsWith('mvp-')) {
		return false
	}

	// Exclude specific keys
	if (EXCLUDED_KEYS.includes(key)) {
		return false
	}

	return true
}

/**
 * Export all relevant extension data (decompressed for human readability)
 */
export async function exportAllData(): Promise<ExportData> {
	// Get decompressed snapshot (automatically decompresses mvp-activity, mvp-drafts, etc.)
	const snapshot = await getDecompressedSnapshot()

	const exportData: Record<string, any> = {}

	// Filter and collect data
	for (const [key, value] of Object.entries(snapshot)) {
		if (shouldExportKey(key)) {
			exportData[key] = value
		}
	}

	return {
		version: CURRENT_EXPORT_VERSION,
		timestamp: Date.now(),
		data: exportData,
	}
}

/**
 * Trigger a browser download for the exported data
 */
export function downloadJSON(data: ExportData, filename = 'mv-premium-backup.json') {
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = filename
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)

	// Revoke URL after a small delay to ensure download starts (Firefox compatibility)
	setTimeout(() => URL.revokeObjectURL(url), 100)
}

/**
 * Import data from an ExportData object (automatically compresses applicable keys)
 */
export interface ImportStats {
	pinnedPosts: number
	savedThreads: number
	mutedWords: number
	userCustomizations: number
	drafts: number
	templates: number
	activityDays: number
	subforumStats: number
	favorites: number
	settingsUpdated: boolean
}

export interface ImportResult {
	success: boolean
	error?: string
	stats?: ImportStats
}

/**
 * Helper to safely extract Zustand state from storage value
 */
function parseSettingsState(val: unknown): any {
	if (typeof val === 'string') {
		try {
			return JSON.parse(val)?.state
		} catch {
			return null
		}
	}
	// If somehow it's already an object
	if (val && typeof val === 'object') {
		return (val as any).state
	}
	return null
}

/**
 * Import data from an ExportData object (automatically compresses applicable keys)
 */
export async function importAllData(data: ExportData): Promise<ImportResult> {
	try {
		// Basic validation
		if (!data.data || typeof data.data !== 'object') {
			return { success: false, error: 'Formato de archivo inválido' }
		}

		const entries = Object.entries(data.data)
		if (entries.length === 0) {
			return { success: false, error: 'El archivo no contiene datos' }
		}

		const stats: ImportStats = {
			pinnedPosts: 0,
			savedThreads: 0,
			mutedWords: 0,
			userCustomizations: 0,
			drafts: 0,
			templates: 0,
			activityDays: 0,
			subforumStats: 0,
			favorites: 0,
			settingsUpdated: false,
		}

		// Get current state to compare and avoid redundant writes
		// USE decompressed snapshot to compare apples to apples (export data is decompressed)
		const currentSnapshot = await getDecompressedSnapshot()

		// Restore all items (setFromImport auto-compresses mvp-activity, mvp-drafts, etc.)
		for (const [key, value] of entries) {
			// Double check it's one of our keys before writing (security)
			if (shouldExportKey(key)) {
				// SMART IMPORT: Check if data is identical to skip write and noise in stats
				// We use JSON.stringify for a quick deep comparison.
				// Note: snapshot keys don't have 'local:' prefix, but export keys might depending on how they were saved.
				// Based on previous fix, export keys are 'mvp-...'. snapshot keys are also 'mvp-...'.
				const currentVal = currentSnapshot[key]

				// sensitive check: if both are objects/arrays, stringify. If primitives, direct compare.
				const isDifferent = JSON.stringify(currentVal) !== JSON.stringify(value)

				if (!isDifferent) {
					continue
				}

				await setFromImport(key, value)

				// Calculate stats based on key and value
				if (key.startsWith('local:mvp-pinned-') && !key.includes('-meta-')) {
					stats.pinnedPosts++
				} else if (key.includes('mvp-saved-threads') && Array.isArray(value)) {
					stats.savedThreads += value.length
				} else if (key.includes('mvp-muted-words') && Array.isArray(value)) {
					stats.mutedWords += value.length
				} else if (key.includes('mvp-user-customizations') && typeof value === 'object') {
					stats.userCustomizations += Object.keys(value).length
				} else if (key.includes('mvp-drafts')) {
					// Drafts are stored as { drafts: [], folders: [] }
					// value is the decompressed object
					const newDraftsData = value as any

					if (newDraftsData && Array.isArray(newDraftsData.drafts)) {
						// Logic redundancy removed: !isDifferent check above already confirmed change
						// Just count the new state
						newDraftsData.drafts.forEach((d: any) => {
							if (d.type === 'template') stats.templates++
							else stats.drafts++
						})
					}
				} else if (key.includes('mvp-activity') && typeof value === 'object') {
					stats.activityDays += Object.keys(value).length
				} else if (key.includes('mvp-time-stats') && typeof value === 'object') {
					stats.subforumStats += Object.keys(value).length
				} else if (key.includes('mvp-favorite-subforums') && Array.isArray(value)) {
					stats.favorites += value.length
				} else if (key.includes('mvp-settings')) {
					// Settings contains multiple features, inspect deeply
					try {
						const newSettings = parseSettingsState(value)
						const oldSettings = parseSettingsState(currentSnapshot[key])

						if (newSettings) {
							let isGenericUpdate = false

							// Check Muted Words specifically
							if (Array.isArray(newSettings.mutedWords)) {
								const oldWords = Array.isArray(oldSettings?.mutedWords) ? oldSettings.mutedWords : []
								const newWords = newSettings.mutedWords

								if (JSON.stringify(oldWords) !== JSON.stringify(newWords)) {
									stats.mutedWords = newWords.length
								}
							}

							// Check if there are OTHER changes besides mutedWords
							// Create copies without mutedWords to compare
							const newRest = { ...newSettings, mutedWords: undefined }
							const oldRest = { ...(oldSettings || {}), mutedWords: undefined }

							if (JSON.stringify(newRest) !== JSON.stringify(oldRest)) {
								isGenericUpdate = true
							}

							stats.settingsUpdated = isGenericUpdate
						} else {
							// If parsing failed but string diff was true, assume update
							stats.settingsUpdated = true
						}
					} catch (e) {
						// Fallback if parsing fails
						stats.settingsUpdated = true
					}
				}
			}
		}

		return { success: true, stats }
	} catch (error) {
		logger.error('Import error:', error)
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Error desconocido al importar',
		}
	}
}

/**
 * "Nuclear" reset - Clears ALL extension data
 */
export async function resetAllData(): Promise<void> {
	// Use browser.storage.local.clear() to wipe everything nicely
	await browser.storage.local.clear()

	// Note: We don't manually clear 'sync' storage here as the request
	// specifically targeted 'local' storage data cleanup and export/import.
	// Sync storage usually holds critical small settings that might persist.
	// But if "Nuclear" implies EVERYTHING, we might want to clear sync too.
	// Given the context of "obsolete storage items" locally, local.clear() is the safe "factory reset" for the app state.
}
