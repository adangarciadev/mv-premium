/**
 * MV Theme Store - State and persistence for Mediavida site theme customization.
 *
 * Follows the same manual-persist pattern as theme-store.ts.
 * Also manages localStorage cache for the early content script (zero flash).
 */
import { create } from 'zustand'
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'
import { RUNTIME_CACHE_KEYS } from '@/constants/runtime-cache'
import { logger } from '@/lib/logger'
import { getCompressed, removeCompressed, setCompressed } from '@/lib/storage/compressed-storage'
import { generateRandomMvThemeOverrides } from './logic/random-wcag-generator'
import { MV_COLOR_GROUPS } from './logic/color-groups'
import { MV_BUILTIN_PRESETS, getBuiltInPreset, type MvThemePreset } from './presets'

// ============================================================================
// STORAGE ITEMS (WXT storage)
// ============================================================================

interface MvThemePersisted {
	enabled: boolean
	activePresetId: string
	colorOverrides: Record<string, string>
}

const mvThemeStorage = storage.defineItem<MvThemePersisted>(`local:${STORAGE_KEYS.MV_THEME}`, {
	defaultValue: {
		enabled: false,
		activePresetId: 'original',
		colorOverrides: {},
	},
})
const MV_THEME_CSS_KEY = `local:${STORAGE_KEYS.MV_THEME_CSS}` as const
const MV_THEME_PRESETS_KEY = `local:${STORAGE_KEYS.MV_THEME_SAVED_PRESETS}` as const

const BASE_COLOR_BY_GROUP = new Map(MV_COLOR_GROUPS.map(group => [group.id, group.baseColor.toLowerCase()]))
const PRESET_NAME_MAX_LENGTH = 20
const PRESET_NAME_FALLBACK = 'preset'
type GenerateMvThemeCSS = (colorOverrides: Record<string, string>) => string

let cachedGenerateMvThemeCSS: GenerateMvThemeCSS | null = null

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface MvThemeState {
	isLoaded: boolean
	enabled: boolean
	activePresetId: string
	colorOverrides: Record<string, string>
	savedPresets: MvThemePreset[]
}

interface MvThemeActions {
	loadFromStorage: () => Promise<void>
	setEnabled: (enabled: boolean) => void
	setGroupColor: (groupId: string, hex: string) => void
	generateRandomWcag: () => void
	resetToDefaults: () => void
	applyPreset: (presetId: string) => void
	saveCurrentAsPreset: (name: string) => void
	duplicatePreset: (sourcePresetId: string) => string | null
	importPresetFromExternal: (presetData: ImportedMvThemePresetData) => string | null
	updateSavedPreset: (id: string) => void
	renameSavedPreset: (id: string, newName: string) => void
	deletePreset: (id: string) => void
	regenerateAndCacheCSS: () => void
}

type MvThemeStore = MvThemeState & MvThemeActions

export interface ImportedMvThemePresetData {
	name: string
	description?: string
	colors: Record<string, string>
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useMvThemeStore = create<MvThemeStore>((set, get) => ({
	// Initial state
	isLoaded: false,
	enabled: false,
	activePresetId: 'original',
	colorOverrides: {},
	savedPresets: [],

	// Load from WXT storage
	loadFromStorage: async () => {
		const [persisted, savedPresetsRaw] = await Promise.all([
			mvThemeStorage.getValue(),
			getCompressed<MvThemePreset[]>(MV_THEME_PRESETS_KEY),
		])
		const savedPresets = savedPresetsRaw ?? []
		const sanitizedOverrides = sanitizeColorOverrides(persisted.colorOverrides)
		const effectivePresetId =
			Object.keys(sanitizedOverrides).length === 0 && persisted.activePresetId === 'custom'
				? 'original'
				: persisted.activePresetId
		const sanitizedPresets = savedPresets.map(preset => ({
			id: preset.id,
			name: preset.name,
			description: preset.description,
			colors: sanitizeColorOverrides(preset.colors),
		}))

		set({
			isLoaded: true,
			enabled: persisted.enabled,
			activePresetId: effectivePresetId,
			colorOverrides: sanitizedOverrides,
			savedPresets: sanitizedPresets,
		})

		if (
			!areOverrideMapsEqual(persisted.colorOverrides, sanitizedOverrides) ||
			persisted.activePresetId !== effectivePresetId
		) {
			mvThemeStorage.setValue({
				enabled: persisted.enabled,
				activePresetId: effectivePresetId,
				colorOverrides: sanitizedOverrides,
			})
		}

		if (
			savedPresets.some((preset, index) => !areOverrideMapsEqual(preset.colors, sanitizedPresets[index]?.colors ?? {}))
		) {
			void setCompressed(MV_THEME_PRESETS_KEY, sanitizedPresets).catch(error => {
				logger.error('Failed to persist sanitized MV theme presets:', error)
			})
		}

		// Warm the generator in the background when there is active theme data.
		if (persisted.enabled || Object.keys(sanitizedOverrides).length > 0) {
			void getGenerateMvThemeCSS().catch(error => {
				logger.error('Failed to warm MV theme CSS generator:', error)
			})
		}

		// One-time migration for existing uncompressed MV theme keys.
		void migrateMvThemeStorageCompression().catch(error => {
			logger.error('Failed to migrate MV theme storage compression:', error)
		})
	},

	// Toggle feature on/off
	setEnabled: (enabled: boolean) => {
		const state = get()
		set({ enabled })

		mvThemeStorage.setValue({
			enabled,
			activePresetId: state.activePresetId,
			colorOverrides: state.colorOverrides,
		})

		// Update caches
		if (enabled) {
			get().regenerateAndCacheCSS()
		} else {
			// Clear caches
			void removeCompressed(MV_THEME_CSS_KEY)
			updateLocalStorageCache(false, '')
		}
	},

	// Set a single group color
	setGroupColor: (groupId: string, hex: string) => {
		const state = get()
		const normalizedHex = normalizeHex(hex)
		const baseColor = BASE_COLOR_BY_GROUP.get(groupId)
		if (!normalizedHex || !baseColor) return

		const newOverrides = { ...state.colorOverrides }
		if (normalizedHex === baseColor) {
			delete newOverrides[groupId]
		} else {
			newOverrides[groupId] = normalizedHex
		}

		const nextPresetId = Object.keys(newOverrides).length > 0 ? 'custom' : 'original'
		set({ colorOverrides: newOverrides, activePresetId: nextPresetId })

		mvThemeStorage.setValue({
			enabled: state.enabled,
			activePresetId: nextPresetId,
			colorOverrides: newOverrides,
		})

		if (state.enabled) {
			get().regenerateAndCacheCSS()
		}
	},

	// Generate random color overrides with WCAG-aware contrast and apply them
	generateRandomWcag: () => {
		const state = get()
		const overrides = sanitizeColorOverrides(generateRandomMvThemeOverrides())

		set({
			activePresetId: 'custom',
			colorOverrides: overrides,
		})

		mvThemeStorage.setValue({
			enabled: state.enabled,
			activePresetId: 'custom',
			colorOverrides: overrides,
		})

		if (state.enabled) {
			get().regenerateAndCacheCSS()
		}
	},

	// Reset all colors to MV defaults
	resetToDefaults: () => {
		const state = get()
		set({
			activePresetId: 'original',
			colorOverrides: {},
		})

		mvThemeStorage.setValue({
			enabled: state.enabled,
			activePresetId: 'original',
			colorOverrides: {},
		})

		if (state.enabled) {
			// No overrides → clear CSS
			void removeCompressed(MV_THEME_CSS_KEY)
			updateLocalStorageCache(state.enabled, '')
		}
	},

	// Apply a built-in or saved preset
	applyPreset: (presetId: string) => {
		const state = get()
		const preset =
			getBuiltInPreset(presetId) ||
			state.savedPresets.find(p => p.id === presetId)

		const overrides = sanitizeColorOverrides(preset?.colors ?? {})
		const nextPresetId = Object.keys(overrides).length === 0 ? 'original' : presetId

		set({
			activePresetId: nextPresetId,
			colorOverrides: overrides,
		})

		mvThemeStorage.setValue({
			enabled: state.enabled,
			activePresetId: nextPresetId,
			colorOverrides: overrides,
		})

		if (state.enabled) {
			get().regenerateAndCacheCSS()
		}
	},

	// Save current overrides as a user preset
	saveCurrentAsPreset: (name: string) => {
		const state = get()
		const safeName = sanitizePresetName(name)
		if (!safeName) return
		const sanitizedOverrides = sanitizeColorOverrides(state.colorOverrides)
		if (Object.keys(sanitizedOverrides).length === 0) return
		const uniqueName = buildUniquePresetName(safeName, state.savedPresets)

		const newPreset: MvThemePreset = {
			id: createCustomPresetId(),
			name: uniqueName,
			description: 'Preset personalizado',
			colors: sanitizedOverrides,
		}

		const newSaved = [...state.savedPresets, newPreset]
		set({
			savedPresets: newSaved,
			activePresetId: newPreset.id,
			colorOverrides: sanitizedOverrides,
		})

		void setCompressed(MV_THEME_PRESETS_KEY, newSaved)
		mvThemeStorage.setValue({
			enabled: state.enabled,
			activePresetId: newPreset.id,
			colorOverrides: sanitizedOverrides,
		})
	},

	// Duplicate a preset (built-in or saved) into "saved presets"
	duplicatePreset: (sourcePresetId: string) => {
		const state = get()
		const sourcePreset = getBuiltInPreset(sourcePresetId) ?? state.savedPresets.find(p => p.id === sourcePresetId)
		if (!sourcePreset) return null

		const copiedOverrides = sanitizeColorOverrides(sourcePreset.colors)
		const hasCopiedOverrides = Object.keys(copiedOverrides).length > 0
		const copyName = buildCopyPresetName(sourcePreset.name, state.savedPresets)

		const copiedPreset: MvThemePreset = {
			id: createCustomPresetId(),
			name: copyName,
			description: 'Copia de preset',
			colors: copiedOverrides,
		}

		const newSaved = [...state.savedPresets, copiedPreset]
		set({
			savedPresets: newSaved,
			activePresetId: hasCopiedOverrides ? copiedPreset.id : 'original',
			colorOverrides: copiedOverrides,
		})

		void setCompressed(MV_THEME_PRESETS_KEY, newSaved).catch(error => {
			logger.error('Failed to persist duplicated MV theme preset:', error)
		})

		mvThemeStorage.setValue({
			enabled: state.enabled,
			activePresetId: hasCopiedOverrides ? copiedPreset.id : 'original',
			colorOverrides: copiedOverrides,
		})

		if (state.enabled) {
			get().regenerateAndCacheCSS()
		}

		return copiedPreset.id
	},

	// Import a single external preset and persist it as a saved preset
	importPresetFromExternal: (presetData: ImportedMvThemePresetData) => {
		const state = get()
		const safeName = sanitizePresetName(presetData.name)
		if (!safeName) return null

		const sanitizedOverrides = sanitizeColorOverrides(presetData.colors)
		if (Object.keys(sanitizedOverrides).length === 0) return null

		const safeDescription = (presetData.description?.trim() || 'Preset importado').slice(0, 120)
		const uniqueName = buildUniquePresetName(safeName, state.savedPresets)

		const importedPreset: MvThemePreset = {
			id: createCustomPresetId(),
			name: uniqueName,
			description: safeDescription,
			colors: sanitizedOverrides,
		}

		const newSaved = [...state.savedPresets, importedPreset]
		set({
			savedPresets: newSaved,
			activePresetId: importedPreset.id,
			colorOverrides: sanitizedOverrides,
		})

		void setCompressed(MV_THEME_PRESETS_KEY, newSaved).catch(error => {
			logger.error('Failed to persist imported MV theme preset:', error)
		})

		mvThemeStorage.setValue({
			enabled: state.enabled,
			activePresetId: importedPreset.id,
			colorOverrides: sanitizedOverrides,
		})

		if (state.enabled) {
			get().regenerateAndCacheCSS()
		}

		return importedPreset.id
	},

	// Update an existing saved preset with current overrides
	updateSavedPreset: (id: string) => {
		const state = get()
		const presetIndex = state.savedPresets.findIndex(p => p.id === id)
		if (presetIndex === -1) return

		const sanitizedOverrides = sanitizeColorOverrides(state.colorOverrides)
		if (Object.keys(sanitizedOverrides).length === 0) return

		const updatedPreset: MvThemePreset = {
			...state.savedPresets[presetIndex],
			colors: sanitizedOverrides,
		}

		const newSaved = [...state.savedPresets]
		newSaved[presetIndex] = updatedPreset

		set({
			savedPresets: newSaved,
			activePresetId: id,
			colorOverrides: sanitizedOverrides,
		})

		void setCompressed(MV_THEME_PRESETS_KEY, newSaved)
		mvThemeStorage.setValue({
			enabled: state.enabled,
			activePresetId: id,
			colorOverrides: sanitizedOverrides,
		})

		if (state.enabled) {
			get().regenerateAndCacheCSS()
		}
	},

	// Rename a saved preset
	renameSavedPreset: (id: string, newName: string) => {
		const state = get()
		const safeName = sanitizePresetName(newName)
		if (!safeName) return

		const presetIndex = state.savedPresets.findIndex(p => p.id === id)
		if (presetIndex === -1) return

		const otherPresets = state.savedPresets.filter(preset => preset.id !== id)
		const uniqueName = buildUniquePresetName(safeName, otherPresets)

		const newSaved = [...state.savedPresets]
		newSaved[presetIndex] = { ...newSaved[presetIndex], name: uniqueName }
		set({ savedPresets: newSaved })
		void setCompressed(MV_THEME_PRESETS_KEY, newSaved)
	},

	// Delete a saved preset
	deletePreset: (id: string) => {
		const state = get()
		const newSaved = state.savedPresets.filter(p => p.id !== id)
		set({ savedPresets: newSaved })
		void setCompressed(MV_THEME_PRESETS_KEY, newSaved)

		// If active was deleted, revert to original
		if (state.activePresetId === id) {
			set({ activePresetId: 'original', colorOverrides: {} })
			mvThemeStorage.setValue({
				enabled: state.enabled,
				activePresetId: 'original',
				colorOverrides: {},
			})
			if (state.enabled) {
				void removeCompressed(MV_THEME_CSS_KEY)
				updateLocalStorageCache(state.enabled, '')
			}
		}
	},

	// Generate CSS and sync to both storages
	regenerateAndCacheCSS: () => {
		void regenerateAndCacheCSSInternal(get)
	},
}))

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Update localStorage cache for the early content script.
 * Uses sync writes so the early script can read immediately on next page load.
 */
function updateLocalStorageCache(enabled: boolean, css: string): void {
	try {
		if (enabled && css) {
			localStorage.setItem(RUNTIME_CACHE_KEYS.MV_THEME_ENABLED, 'true')
			localStorage.setItem(RUNTIME_CACHE_KEYS.MV_THEME_CSS, css)
		} else {
			localStorage.removeItem(RUNTIME_CACHE_KEYS.MV_THEME_ENABLED)
			localStorage.removeItem(RUNTIME_CACHE_KEYS.MV_THEME_CSS)
		}
	} catch {
		// localStorage may be unavailable
	}
}

async function migrateMvThemeStorageCompression(): Promise<void> {
	const [rawCSS, rawPresets] = await Promise.all([
		storage.getItem<string | null>(MV_THEME_CSS_KEY),
		storage.getItem<MvThemePreset[] | string | null>(MV_THEME_PRESETS_KEY),
	])

	if (typeof rawCSS === 'string' && rawCSS && !isCompressedStorageValue(rawCSS)) {
		await setCompressed(MV_THEME_CSS_KEY, rawCSS)
	}

	if (Array.isArray(rawPresets)) {
		await setCompressed(MV_THEME_PRESETS_KEY, rawPresets as MvThemePreset[])
	}
}

function isCompressedStorageValue(value: unknown): boolean {
	return typeof value === 'string' && (value.startsWith('__LZB64__') || value.startsWith('__LZ__'))
}

async function getGenerateMvThemeCSS(): Promise<GenerateMvThemeCSS> {
	if (cachedGenerateMvThemeCSS) {
		return cachedGenerateMvThemeCSS
	}

	const module = await import('./logic/css-override-generator')
	cachedGenerateMvThemeCSS = module.generateMvThemeCSS
	return cachedGenerateMvThemeCSS
}

async function regenerateAndCacheCSSInternal(getState: () => MvThemeStore): Promise<void> {
	const generateMvThemeCSS = await getGenerateMvThemeCSS()
	const state = getState()

	if (!state.enabled) {
		await removeCompressed(MV_THEME_CSS_KEY)
		updateLocalStorageCache(false, '')
		return
	}

	const css = generateMvThemeCSS(state.colorOverrides)
	await setCompressed(MV_THEME_CSS_KEY, css)
	updateLocalStorageCache(true, css)
}

function sanitizeColorOverrides(overrides: Record<string, string>): Record<string, string> {
	const sanitized: Record<string, string> = {}

	for (const [groupId, value] of Object.entries(overrides)) {
		const normalized = normalizeHex(value)
		if (!normalized) continue

		const baseColor = BASE_COLOR_BY_GROUP.get(groupId)
		if (!baseColor) continue

		if (normalized !== baseColor) {
			sanitized[groupId] = normalized
		}
	}

	return sanitized
}

function normalizeHex(value: string): string | null {
	const normalized = value.trim().toLowerCase()
	if (!/^#[0-9a-f]{3,8}$/i.test(normalized)) return null
	return normalized
}

function areOverrideMapsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
	const keysA = Object.keys(a)
	const keysB = Object.keys(b)
	if (keysA.length !== keysB.length) return false

	for (const key of keysA) {
		if (a[key] !== b[key]) return false
	}

	return true
}

function buildCopyPresetName(sourceName: string, savedPresets: MvThemePreset[]): string {
	const normalizedSource = sanitizePresetName(sourceName) || PRESET_NAME_FALLBACK
	const baseName = `${normalizedSource}_copy`
	return buildUniquePresetName(baseName, savedPresets)
}

function buildUniquePresetName(baseName: string, savedPresets: MvThemePreset[]): string {
	const safeBaseName = sanitizePresetName(baseName) || PRESET_NAME_FALLBACK
	const existingNames = new Set(savedPresets.map(preset => sanitizePresetName(preset.name).toLowerCase()))
	if (!existingNames.has(safeBaseName.toLowerCase())) {
		return safeBaseName
	}

	let suffix = 2
	while (existingNames.has(`${safeBaseName}_${suffix}`.toLowerCase())) {
		suffix++
	}

	return `${safeBaseName}_${suffix}`
}

function sanitizePresetName(value: string): string {
	return value
		.trim()
		.replace(/[^A-Za-z0-9_-]/g, '')
		.slice(0, PRESET_NAME_MAX_LENGTH)
}

function createCustomPresetId(): string {
	return `mv-custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Get all presets (built-in + saved) for UI display
 */
export function getAllMvPresets(): MvThemePreset[] {
	const state = useMvThemeStore.getState()
	return [...MV_BUILTIN_PRESETS, ...state.savedPresets]
}
