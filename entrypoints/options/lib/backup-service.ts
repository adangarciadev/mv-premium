import { storage } from '#imports'
import packageJson from '@/package.json'
import { STORAGE_KEYS } from '@/constants/storage-keys'
import { logger } from '@/lib/logger'
import { getDecompressedSnapshot, setFromImport } from '@/lib/storage/compressed-storage'

export const BACKUP_SCHEMA_VERSION = 1

const APP_NAME = 'mv-premium'
const PINNED_META_PREFIX = 'mvp-pinned-meta-'
const USER_API_KEY_FIELDS = ['imgbbApiKey', 'geminiApiKey'] as const
const EXTENSION_API_KEY_FIELDS = ['tmdbApiKey', 'giphyApiKey'] as const
const SECRET_SETTINGS_FIELDS = [...USER_API_KEY_FIELDS, ...EXTENSION_API_KEY_FIELDS] as const

type SecretSettingsField = (typeof SECRET_SETTINGS_FIELDS)[number]
type UserApiKeyField = (typeof USER_API_KEY_FIELDS)[number]

export interface PinnedPostsBackupEntry {
	threadId: string
	metadata?: unknown
	posts: unknown[]
}

export interface BackupData {
	schemaVersion: typeof BACKUP_SCHEMA_VERSION
	exportedAt: string
	app: {
		name: typeof APP_NAME
		extensionVersion: string
	}
	policy: {
		secrets: 'excluded' | 'user-selected'
		activity: 'time-stats-only'
		compressedValues: 'decompressed'
	}
	data: {
		settings: Record<string, unknown>
		themes: {
			ui: {
				resolvedTheme?: unknown
				rawTheme?: unknown
				custom?: unknown
				savedPresets?: unknown
				customFont?: unknown
				applyFontGlobally?: unknown
				postFontSize?: unknown
			}
			mediavida: {
				state?: unknown
				savedPresets?: unknown
			}
		}
		content: {
			drafts?: unknown
			savedThreads?: unknown
			hiddenThreads?: unknown
			hiddenSubforums?: unknown
			contentRules?: unknown
			userCustomizations?: unknown
			favoriteSubforums?: unknown
			pinnedPosts: PinnedPostsBackupEntry[]
		}
		preferences: {
			nativeLiveDelay?: unknown
			liveThreadDelay?: unknown
		}
		stats: {
			timeStats?: unknown
		}
	}
	excluded: {
		secretFields: UserApiKeyField[]
		storageKeys: string[]
		patterns: string[]
	}
}

export interface BackupOptions {
	includePersonalApiKeys?: boolean
}

export interface BackupImportOptions {
	includePersonalApiKeys?: boolean
}

export interface BackupImportStats {
	pinnedPosts: number
	savedThreads: number
	mutedWords: number
	userCustomizations: number
	drafts: number
	templates: number
	subforumStats: number
	favorites: number
	settingsUpdated: boolean
	themesUpdated: boolean
	contentRules: number
	hiddenThreads: number
	hiddenSubforums: number
}

export interface BackupImportResult {
	success: boolean
	error?: string
	stats?: BackupImportStats
}

const EMPTY_STATS: BackupImportStats = {
	pinnedPosts: 0,
	savedThreads: 0,
	mutedWords: 0,
	userCustomizations: 0,
	drafts: 0,
	templates: 0,
	subforumStats: 0,
	favorites: 0,
	settingsUpdated: false,
	themesUpdated: false,
	contentRules: 0,
	hiddenThreads: 0,
	hiddenSubforums: 0,
}

const EXCLUDED_STORAGE_KEYS = [
	STORAGE_KEYS.IGDB_ACCESS_TOKEN,
	STORAGE_KEYS.IGDB_TOKEN_EXPIRY,
	STORAGE_KEYS.ACTIVITY,
	STORAGE_KEYS.MV_THEME_CSS,
	STORAGE_KEYS.FID_ICONS_CACHE,
	STORAGE_KEYS.CURRENT_USER,
	STORAGE_KEYS.EDITOR_PRESERVE,
	STORAGE_KEYS.THREAD_CLIPPER_BASKET,
	STORAGE_KEYS.PROFILE,
	STORAGE_KEYS.BOOKMARKS_VIEW_MODE,
	STORAGE_KEYS.LAST_SEEN_VERSION,
	STORAGE_KEYS.STORAGE_VERSION,
	STORAGE_KEYS.HOMEPAGE_RECENT_FORUMS,
	STORAGE_KEYS.LIVE_THREADS,
]

function cloneStats(): BackupImportStats {
	return { ...EMPTY_STATS }
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function getSnapshotValue(snapshot: Record<string, unknown>, key: string): unknown {
	return snapshot[key]
}

function parseSettingsState(value: unknown): Record<string, unknown> {
	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value) as unknown
			if (isRecord(parsed) && isRecord(parsed.state)) return parsed.state
			return {}
		} catch {
			return {}
		}
	}

	if (isRecord(value) && isRecord(value.state)) return value.state
	if (isRecord(value)) return value
	return {}
}

function parseSettingsPersistVersion(value: unknown): number {
	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value) as unknown
			return isRecord(parsed) && typeof parsed.version === 'number' ? parsed.version : 0
		} catch {
			return 0
		}
	}

	return isRecord(value) && typeof value.version === 'number' ? value.version : 0
}

function sanitizeSettingsForBackup(settings: Record<string, unknown>, options: BackupOptions = {}): Record<string, unknown> {
	const sanitized = { ...settings }
	const fieldsToStrip = options.includePersonalApiKeys ? EXTENSION_API_KEY_FIELDS : SECRET_SETTINGS_FIELDS
	for (const field of fieldsToStrip) {
		delete sanitized[field]
	}
	return sanitized
}

function mergeSettingsForImport(
	currentStoredValue: unknown,
	importedSettings: Record<string, unknown>,
	options: BackupImportOptions = {}
): { serialized: string; changed: boolean; nextState: Record<string, unknown> } {
	const currentState = parseSettingsState(currentStoredValue)
	const currentVersion = parseSettingsPersistVersion(currentStoredValue)
	const sanitizedImported = sanitizeSettingsForBackup(importedSettings, {
		includePersonalApiKeys: options.includePersonalApiKeys,
	})
	const fieldsToPreserve = options.includePersonalApiKeys ? EXTENSION_API_KEY_FIELDS : SECRET_SETTINGS_FIELDS
	const preservedSecrets = Object.fromEntries(
		fieldsToPreserve.map(field => [field, currentState[field]]).filter(([, value]) => value !== undefined)
	)
	const missingImportedUserApiKeys = Object.fromEntries(
		USER_API_KEY_FIELDS
			.map(field => [field, currentState[field]])
			.filter(([field, value]) => sanitizedImported[field as SecretSettingsField] === undefined && value !== undefined)
	)
	const nextState = {
		...currentState,
		...sanitizedImported,
		...missingImportedUserApiKeys,
		...preservedSecrets,
	}
	const serialized = JSON.stringify({ state: nextState, version: currentVersion })
	return {
		serialized,
		changed: JSON.stringify(currentState) !== JSON.stringify(nextState),
		nextState,
	}
}

function createPinnedPostsBackup(snapshot: Record<string, unknown>): PinnedPostsBackupEntry[] {
	const pinnedByThread = new Map<string, PinnedPostsBackupEntry>()

	for (const [key, value] of Object.entries(snapshot)) {
		if (key.startsWith(PINNED_META_PREFIX)) continue
		if (!key.startsWith(STORAGE_KEYS.PINNED_PREFIX)) continue
		if (!Array.isArray(value)) continue

		const threadId = key.slice(STORAGE_KEYS.PINNED_PREFIX.length)
		pinnedByThread.set(threadId, {
			threadId,
			posts: value,
		})
	}

	for (const [key, value] of Object.entries(snapshot)) {
		if (!key.startsWith(PINNED_META_PREFIX)) continue

		const threadId = key.slice(PINNED_META_PREFIX.length)
		const entry = pinnedByThread.get(threadId)
		if (entry) {
			entry.metadata = value
		}
	}

	return Array.from(pinnedByThread.values()).sort((a, b) => a.threadId.localeCompare(b.threadId))
}

function countDrafts(value: unknown): { drafts: number; templates: number } {
	if (!isRecord(value) || !Array.isArray(value.drafts)) return { drafts: 0, templates: 0 }

	return value.drafts.reduce(
		(acc, draft) => {
			if (isRecord(draft) && draft.type === 'template') {
				acc.templates += 1
			} else {
				acc.drafts += 1
			}
			return acc
		},
		{ drafts: 0, templates: 0 }
	)
}

function countObjectKeys(value: unknown): number {
	return isRecord(value) ? Object.keys(value).length : 0
}

function countArray(value: unknown): number {
	return Array.isArray(value) ? value.length : 0
}

function countMutedWords(settings: Record<string, unknown>): number {
	return Array.isArray(settings.mutedWords) ? settings.mutedWords.length : 0
}

function validatePinnedPosts(value: unknown): PinnedPostsBackupEntry[] {
	if (value === undefined) return []
	if (!Array.isArray(value)) {
		throw new Error('El backup no es válido: content.pinnedPosts debe ser una lista.')
	}

	return value
		.filter((entry): entry is Record<string, unknown> => isRecord(entry))
		.map(entry => {
			if (typeof entry.threadId !== 'string' || !entry.threadId.trim()) {
				throw new Error('El backup no es válido: hay posts anclados sin threadId.')
			}
			if (!Array.isArray(entry.posts)) {
				throw new Error(`El backup no es válido: los posts anclados de ${entry.threadId} no son una lista.`)
			}
			return {
				threadId: entry.threadId,
				metadata: entry.metadata,
				posts: entry.posts,
			}
		})
}

export function validateBackupData(input: unknown, options: BackupImportOptions = {}): BackupData {
	if (!isRecord(input)) {
		throw new Error('El archivo no contiene un backup válido de MV Premium.')
	}

	if (!('schemaVersion' in input)) {
		throw new Error('El backup no tiene schemaVersion. Exporta de nuevo tus datos con una versión reciente de MV Premium.')
	}

	if (input.schemaVersion !== BACKUP_SCHEMA_VERSION) {
		throw new Error(`Versión de backup no soportada: ${String(input.schemaVersion)}.`)
	}

	if (!isRecord(input.data)) {
		throw new Error('El backup no es válido: falta el bloque data.')
	}

	const data = input.data
	const themes = isRecord(data.themes) ? data.themes : {}
	const content = isRecord(data.content) ? data.content : {}
	const preferences = isRecord(data.preferences) ? data.preferences : {}
	const stats = isRecord(data.stats) ? data.stats : {}
	const excluded = isRecord(input.excluded) ? input.excluded : {}
	const excludedSecretFields = excluded.secretFields

	return {
		schemaVersion: BACKUP_SCHEMA_VERSION,
		exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : '',
		app: {
			name: APP_NAME,
			extensionVersion: isRecord(input.app) && typeof input.app.extensionVersion === 'string'
				? input.app.extensionVersion
				: '',
		},
		policy: {
			secrets: isRecord(input.policy) && input.policy.secrets === 'user-selected' ? 'user-selected' : 'excluded',
			activity: 'time-stats-only',
			compressedValues: 'decompressed',
		},
		data: {
			settings: isRecord(data.settings) ? sanitizeSettingsForBackup(data.settings, options) : {},
			themes: {
				ui: isRecord(themes.ui) ? themes.ui : {},
				mediavida: isRecord(themes.mediavida) ? themes.mediavida : {},
			},
			content: {
				drafts: content.drafts,
				savedThreads: content.savedThreads,
				hiddenThreads: content.hiddenThreads,
				hiddenSubforums: content.hiddenSubforums,
				contentRules: content.contentRules,
				userCustomizations: content.userCustomizations,
				favoriteSubforums: content.favoriteSubforums,
				pinnedPosts: validatePinnedPosts(content.pinnedPosts),
			},
			preferences: {
				nativeLiveDelay: preferences.nativeLiveDelay,
				liveThreadDelay: preferences.liveThreadDelay,
			},
			stats: {
				timeStats: stats.timeStats,
			},
		},
		excluded: {
			secretFields: Array.isArray(excludedSecretFields)
				? USER_API_KEY_FIELDS.filter(field => excludedSecretFields.includes(field))
				: [...USER_API_KEY_FIELDS],
			storageKeys: [...EXCLUDED_STORAGE_KEYS],
			patterns: ['mv-cache:*', 'mvp-pending-*', 'mvp-live-preview-*'],
		},
	}
}

export function backupContainsPersonalApiKeys(input: unknown): boolean {
	if (!isRecord(input) || !isRecord(input.data) || !isRecord(input.data.settings)) return false

	const settings = input.data.settings
	return USER_API_KEY_FIELDS.some(field => {
		const value = settings[field]
		return typeof value === 'string' && value.trim().length > 0
	})
}

export async function createBackupData(options: BackupOptions = {}): Promise<BackupData> {
	const snapshot = await getDecompressedSnapshot()
	const settings = sanitizeSettingsForBackup(parseSettingsState(getSnapshotValue(snapshot, STORAGE_KEYS.SETTINGS)), options)
	if (settings.boldColor === undefined && typeof getSnapshotValue(snapshot, STORAGE_KEYS.BOLD_COLOR) === 'string') {
		settings.boldColor = getSnapshotValue(snapshot, STORAGE_KEYS.BOLD_COLOR)
	}
	if (
		settings.boldColorEnabled === undefined &&
		typeof getSnapshotValue(snapshot, STORAGE_KEYS.BOLD_COLOR_ENABLED) === 'boolean'
	) {
		settings.boldColorEnabled = getSnapshotValue(snapshot, STORAGE_KEYS.BOLD_COLOR_ENABLED)
	}

	return {
		schemaVersion: BACKUP_SCHEMA_VERSION,
		exportedAt: new Date().toISOString(),
		app: {
			name: APP_NAME,
			extensionVersion: packageJson.version,
		},
		policy: {
			secrets: options.includePersonalApiKeys ? 'user-selected' : 'excluded',
			activity: 'time-stats-only',
			compressedValues: 'decompressed',
		},
		data: {
			settings,
			themes: {
				ui: {
					resolvedTheme: getSnapshotValue(snapshot, STORAGE_KEYS.THEME),
					rawTheme: getSnapshotValue(snapshot, STORAGE_KEYS.THEME_RAW),
					custom: getSnapshotValue(snapshot, STORAGE_KEYS.THEME_CUSTOM),
					savedPresets: getSnapshotValue(snapshot, STORAGE_KEYS.THEME_SAVED_PRESETS),
					customFont: getSnapshotValue(snapshot, STORAGE_KEYS.CUSTOM_FONT),
					applyFontGlobally: getSnapshotValue(snapshot, STORAGE_KEYS.APPLY_FONT_GLOBALLY),
					postFontSize: getSnapshotValue(snapshot, STORAGE_KEYS.POST_FONT_SIZE),
				},
				mediavida: {
					state: getSnapshotValue(snapshot, STORAGE_KEYS.MV_THEME),
					savedPresets: getSnapshotValue(snapshot, STORAGE_KEYS.MV_THEME_SAVED_PRESETS),
				},
			},
			content: {
				drafts: getSnapshotValue(snapshot, STORAGE_KEYS.DRAFTS),
				savedThreads: getSnapshotValue(snapshot, STORAGE_KEYS.SAVED_THREADS),
				hiddenThreads: getSnapshotValue(snapshot, STORAGE_KEYS.HIDDEN_THREADS),
				hiddenSubforums: getSnapshotValue(snapshot, STORAGE_KEYS.HIDDEN_SUBFORUMS),
				contentRules: getSnapshotValue(snapshot, STORAGE_KEYS.CONTENT_RULES),
				userCustomizations: getSnapshotValue(snapshot, STORAGE_KEYS.USER_CUSTOMIZATIONS),
				favoriteSubforums: getSnapshotValue(snapshot, STORAGE_KEYS.FAVORITE_SUBFORUMS),
				pinnedPosts: createPinnedPostsBackup(snapshot),
			},
			preferences: {
				nativeLiveDelay: getSnapshotValue(snapshot, STORAGE_KEYS.NATIVE_LIVE_DELAY),
				liveThreadDelay: getSnapshotValue(snapshot, STORAGE_KEYS.LIVE_THREAD_DELAY),
			},
			stats: {
				timeStats: getSnapshotValue(snapshot, STORAGE_KEYS.TIME_STATS),
			},
		},
		excluded: {
			secretFields: options.includePersonalApiKeys ? [] : [...USER_API_KEY_FIELDS],
			storageKeys: [...EXCLUDED_STORAGE_KEYS],
			patterns: ['mv-cache:*', 'mvp-pending-*', 'mvp-live-preview-*'],
		},
	}
}

export function downloadBackupJSON(data: BackupData, filename = 'mv-premium-backup.json'): void {
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = filename
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
	setTimeout(() => URL.revokeObjectURL(url), 100)
}

async function writeIfDefined(key: string, value: unknown): Promise<boolean> {
	if (value === undefined) return false
	await setFromImport(key, value)
	return true
}

async function importSettings(settings: Record<string, unknown>, options: BackupImportOptions = {}): Promise<boolean> {
	const currentStoredValue = await storage.getItem<unknown>(`local:${STORAGE_KEYS.SETTINGS}`)
	const { serialized, changed, nextState } = mergeSettingsForImport(currentStoredValue, settings, options)
	await setFromImport(STORAGE_KEYS.SETTINGS, serialized)
	if (typeof nextState.boldColor === 'string') {
		await setFromImport(STORAGE_KEYS.BOLD_COLOR, nextState.boldColor)
	}
	if (typeof nextState.boldColorEnabled === 'boolean') {
		await setFromImport(STORAGE_KEYS.BOLD_COLOR_ENABLED, nextState.boldColorEnabled)
	}
	return changed
}

async function regenerateMvThemeCSSAfterImport(): Promise<void> {
	try {
		const { useMvThemeStore } = await import('@/features/mv-theme/mv-theme-store')
		await useMvThemeStore.getState().loadFromStorage()
		useMvThemeStore.getState().regenerateAndCacheCSS()
	} catch (error) {
		logger.warn('MV theme CSS regeneration after backup import skipped:', error)
	}
}

export async function importBackupData(input: unknown, options: BackupImportOptions = {}): Promise<BackupImportResult> {
	try {
		const backup = validateBackupData(input, options)
		const stats = cloneStats()
		const { data } = backup

		if (Object.keys(data.settings).length > 0) {
			stats.settingsUpdated = await importSettings(data.settings, options)
			stats.mutedWords = countMutedWords(data.settings)
		}

		if (await writeIfDefined(STORAGE_KEYS.THEME, data.themes.ui.resolvedTheme)) stats.themesUpdated = true
		if (await writeIfDefined(STORAGE_KEYS.THEME_RAW, data.themes.ui.rawTheme)) stats.themesUpdated = true
		if (await writeIfDefined(STORAGE_KEYS.THEME_CUSTOM, data.themes.ui.custom)) stats.themesUpdated = true
		if (await writeIfDefined(STORAGE_KEYS.THEME_SAVED_PRESETS, data.themes.ui.savedPresets)) stats.themesUpdated = true
		if (await writeIfDefined(STORAGE_KEYS.CUSTOM_FONT, data.themes.ui.customFont)) stats.themesUpdated = true
		if (await writeIfDefined(STORAGE_KEYS.APPLY_FONT_GLOBALLY, data.themes.ui.applyFontGlobally)) stats.themesUpdated = true
		if (await writeIfDefined(STORAGE_KEYS.POST_FONT_SIZE, data.themes.ui.postFontSize)) stats.themesUpdated = true
		if (await writeIfDefined(STORAGE_KEYS.MV_THEME, data.themes.mediavida.state)) stats.themesUpdated = true
		if (await writeIfDefined(STORAGE_KEYS.MV_THEME_SAVED_PRESETS, data.themes.mediavida.savedPresets)) {
			stats.themesUpdated = true
		}

		if (await writeIfDefined(STORAGE_KEYS.DRAFTS, data.content.drafts)) {
			const counts = countDrafts(data.content.drafts)
			stats.drafts = counts.drafts
			stats.templates = counts.templates
		}
		if (await writeIfDefined(STORAGE_KEYS.SAVED_THREADS, data.content.savedThreads)) {
			stats.savedThreads = countArray(data.content.savedThreads)
		}
		if (await writeIfDefined(STORAGE_KEYS.HIDDEN_THREADS, data.content.hiddenThreads)) {
			stats.hiddenThreads = countArray(data.content.hiddenThreads)
		}
		if (await writeIfDefined(STORAGE_KEYS.HIDDEN_SUBFORUMS, data.content.hiddenSubforums)) {
			stats.hiddenSubforums = countArray(data.content.hiddenSubforums)
		}
		if (await writeIfDefined(STORAGE_KEYS.CONTENT_RULES, data.content.contentRules)) {
			stats.contentRules = countArray(data.content.contentRules)
		}
		if (await writeIfDefined(STORAGE_KEYS.USER_CUSTOMIZATIONS, data.content.userCustomizations)) {
			const userCustomizations = data.content.userCustomizations
			stats.userCustomizations = isRecord(userCustomizations) && isRecord(userCustomizations.users)
				? Object.keys(userCustomizations.users).length
				: countObjectKeys(data.content.userCustomizations)
		}
		if (await writeIfDefined(STORAGE_KEYS.FAVORITE_SUBFORUMS, data.content.favoriteSubforums)) {
			stats.favorites = countArray(data.content.favoriteSubforums)
		}

		for (const entry of data.content.pinnedPosts) {
			if (entry.posts.length > 0) {
				await setFromImport(`${STORAGE_KEYS.PINNED_PREFIX}${entry.threadId}`, entry.posts)
				stats.pinnedPosts += entry.posts.length
			}
			if (entry.metadata !== undefined) {
				await setFromImport(`${PINNED_META_PREFIX}${entry.threadId}`, entry.metadata)
			}
		}

		await writeIfDefined(STORAGE_KEYS.NATIVE_LIVE_DELAY, data.preferences.nativeLiveDelay)
		await writeIfDefined(STORAGE_KEYS.LIVE_THREAD_DELAY, data.preferences.liveThreadDelay)
		if (await writeIfDefined(STORAGE_KEYS.TIME_STATS, data.stats.timeStats)) {
			stats.subforumStats = countObjectKeys(data.stats.timeStats)
		}

		if (stats.themesUpdated) {
			await regenerateMvThemeCSSAfterImport()
		}

		return { success: true, stats }
	} catch (error) {
		logger.error('Backup import error:', error)
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Error desconocido al importar el backup',
		}
	}
}
