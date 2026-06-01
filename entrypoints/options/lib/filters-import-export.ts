import { logger } from '@/lib/logger'
import { MV_ROLE_COLORS, STORAGE_KEYS } from '@/constants'
import { getContentRules, saveContentRules, type ContentRule } from '@/features/content-rules'
import { getHiddenThreads, saveHiddenThreads, type HiddenThread } from '@/features/hidden-threads/logic/storage'
import {
	getHiddenSubforums,
	saveHiddenSubforums,
	type HiddenSubforum,
} from '@/features/hidden-subforums/logic/storage'
import {
	getUserCustomizations,
	saveUserCustomizations,
	type UserCustomizationsData,
} from '@/features/user-customizations/storage'
import { useSettingsStore } from '@/store/settings-store'
import type { Settings } from '@/store/settings-types'

const FILTERS_EXPORT_VERSION = 1
const FILTERS_EXPORT_SCOPE = 'mv-premium-filters'
const DEFAULT_USER_CUSTOMIZATIONS: UserCustomizationsData = {
	users: {},
	globalSettings: {
		adminColor: MV_ROLE_COLORS.ADMIN,
		subadminColor: MV_ROLE_COLORS.SUBADMIN,
		modColor: MV_ROLE_COLORS.MOD,
		userColor: MV_ROLE_COLORS.USER,
	},
}

type FilterSettingsSnapshot = Pick<
	Settings,
	'contentRulesEnabled' | 'mutedWordsEnabled' | 'mutedWords' | 'hideThreadEnabled' | 'hideIgnoredUserThreadsEnabled'
>

interface FiltersSnapshot {
	contentRules: ContentRule[]
	hiddenThreads: HiddenThread[]
	hiddenSubforums: HiddenSubforum[]
	userCustomizations: UserCustomizationsData
	settings: FilterSettingsSnapshot
}

export interface FiltersExportData {
	version: number
	timestamp: number
	scope: typeof FILTERS_EXPORT_SCOPE
	data: FiltersSnapshot
}

export interface FiltersImportStats {
	contentRules: number
	hiddenThreads: number
	hiddenSubforums: number
	users: number
	mutedWords: number
	settingsUpdated: boolean
}

export interface FiltersImportResult {
	success: boolean
	error?: string
	stats?: FiltersImportStats
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function parseSettingsState(value: unknown): Partial<Settings> | null {
	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value) as unknown
			return isRecord(parsed) && isRecord(parsed.state) ? (parsed.state as Partial<Settings>) : null
		} catch {
			return null
		}
	}

	if (isRecord(value) && isRecord(value.state)) return value.state as Partial<Settings>
	return isRecord(value) ? (value as Partial<Settings>) : null
}

function pickFilterSettings(source: Partial<Settings>): FilterSettingsSnapshot {
	const current = useSettingsStore.getState()
	return {
		contentRulesEnabled: source.contentRulesEnabled ?? current.contentRulesEnabled,
		mutedWordsEnabled: source.mutedWordsEnabled ?? current.mutedWordsEnabled,
		mutedWords: Array.isArray(source.mutedWords) ? source.mutedWords : current.mutedWords,
		hideThreadEnabled: source.hideThreadEnabled ?? current.hideThreadEnabled,
		hideIgnoredUserThreadsEnabled: source.hideIgnoredUserThreadsEnabled ?? current.hideIgnoredUserThreadsEnabled,
	}
}

function normalizeSnapshot(input: unknown): FiltersSnapshot | null {
	if (!isRecord(input)) return null

	const data = isRecord(input.data) ? input.data : input
	if ('scope' in input && input.scope === FILTERS_EXPORT_SCOPE) {
		return {
			contentRules: Array.isArray(data.contentRules) ? (data.contentRules as ContentRule[]) : [],
			hiddenThreads: Array.isArray(data.hiddenThreads) ? (data.hiddenThreads as HiddenThread[]) : [],
			hiddenSubforums: Array.isArray(data.hiddenSubforums) ? (data.hiddenSubforums as HiddenSubforum[]) : [],
			userCustomizations: isRecord(data.userCustomizations)
				? (data.userCustomizations as unknown as UserCustomizationsData)
				: DEFAULT_USER_CUSTOMIZATIONS,
			settings: pickFilterSettings(isRecord(data.settings) ? (data.settings as Partial<Settings>) : {}),
		}
	}

	const globalData = isRecord(input.data) ? input.data : null
	if (!globalData) return null

	const settings = pickFilterSettings(parseSettingsState(globalData[STORAGE_KEYS.SETTINGS]) ?? {})
	return {
		contentRules: Array.isArray(globalData[STORAGE_KEYS.CONTENT_RULES])
			? (globalData[STORAGE_KEYS.CONTENT_RULES] as ContentRule[])
			: [],
		hiddenThreads: Array.isArray(globalData[STORAGE_KEYS.HIDDEN_THREADS])
			? (globalData[STORAGE_KEYS.HIDDEN_THREADS] as HiddenThread[])
			: [],
		hiddenSubforums: Array.isArray(globalData[STORAGE_KEYS.HIDDEN_SUBFORUMS])
			? (globalData[STORAGE_KEYS.HIDDEN_SUBFORUMS] as HiddenSubforum[])
			: [],
		userCustomizations: isRecord(globalData[STORAGE_KEYS.USER_CUSTOMIZATIONS])
			? (globalData[STORAGE_KEYS.USER_CUSTOMIZATIONS] as unknown as UserCustomizationsData)
			: DEFAULT_USER_CUSTOMIZATIONS,
		settings,
	}
}

function getStats(snapshot: FiltersSnapshot): FiltersImportStats {
	return {
		contentRules: snapshot.contentRules.length,
		hiddenThreads: snapshot.hiddenThreads.length,
		hiddenSubforums: snapshot.hiddenSubforums.length,
		users: Object.keys(snapshot.userCustomizations.users || {}).length,
		mutedWords: snapshot.settings.mutedWords.length,
		settingsUpdated: true,
	}
}

export async function exportFiltersData(): Promise<FiltersExportData> {
	const settings = useSettingsStore.getState()
	return {
		version: FILTERS_EXPORT_VERSION,
		timestamp: Date.now(),
		scope: FILTERS_EXPORT_SCOPE,
		data: {
			contentRules: await getContentRules(),
			hiddenThreads: await getHiddenThreads(),
			hiddenSubforums: await getHiddenSubforums(),
			userCustomizations: await getUserCustomizations(),
			settings: pickFilterSettings(settings),
		},
	}
}

export function downloadFiltersJSON(data: FiltersExportData, filename = 'mv-premium-filtros.json'): void {
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

export async function importFiltersData(input: unknown): Promise<FiltersImportResult> {
	try {
		const snapshot = normalizeSnapshot(input)
		if (!snapshot) {
			return { success: false, error: 'El archivo no contiene datos de filtros compatibles' }
		}

		await saveContentRules(snapshot.contentRules)
		await saveHiddenThreads(snapshot.hiddenThreads)
		await saveHiddenSubforums(snapshot.hiddenSubforums)
		await saveUserCustomizations(snapshot.userCustomizations)
		useSettingsStore.getState().updateSettings(snapshot.settings)

		return { success: true, stats: getStats(snapshot) }
	} catch (error) {
		logger.error('Filters import error:', error)
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Error desconocido al importar filtros',
		}
	}
}

export function previewFiltersImportData(input: unknown): FiltersImportResult {
	const snapshot = normalizeSnapshot(input)
	if (!snapshot) {
		return { success: false, error: 'El archivo no contiene datos de filtros compatibles' }
	}

	return { success: true, stats: getStats(snapshot) }
}
