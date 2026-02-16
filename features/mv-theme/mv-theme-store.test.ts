import { beforeEach, describe, expect, it, vi } from 'vitest'
import { storage } from '#imports'
import { getCompressed } from '@/lib/storage/compressed-storage'
import { useMvThemeStore } from './mv-theme-store'

vi.mock('@/lib/storage/compressed-storage', () => ({
	getCompressed: vi.fn(() => Promise.resolve(null)),
	setCompressed: vi.fn(() => Promise.resolve()),
	removeCompressed: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/logger', () => ({
	logger: {
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
	},
}))

const VALID_OVERRIDES = { 'page-bg': '#223344' }
const NAME_RE = /^[A-Za-z0-9_-]+$/

function resetMvThemeState(): void {
	useMvThemeStore.setState({
		isLoaded: false,
		enabled: false,
		activePresetId: 'original',
		colorOverrides: {},
		savedPresets: [],
	})
}

function resolveMvThemeStorageItem() {
	const defineItemMock = storage.defineItem as unknown as { mock?: { results?: Array<{ value: unknown }> } }
	const storageItem = defineItemMock.mock?.results?.[0]?.value as
		| {
				getValue: ReturnType<typeof vi.fn>
				setValue: ReturnType<typeof vi.fn>
		  }
		| undefined
	if (!storageItem) {
		throw new Error('MV theme storage item mock not initialized')
	}
	return storageItem
}

const mvThemeStorageItem = resolveMvThemeStorageItem()

describe('mv-theme-store naming constraints', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		resetMvThemeState()

		mvThemeStorageItem.getValue.mockResolvedValue({
			enabled: false,
			activePresetId: 'original',
			colorOverrides: {},
		})
		mvThemeStorageItem.setValue.mockResolvedValue(undefined)

		;(getCompressed as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([])
	})

	it('sanitizes and de-duplicates names when saving presets', () => {
		useMvThemeStore.setState({
			colorOverrides: VALID_OVERRIDES,
			savedPresets: [
				{
					id: 'mv-custom-existing',
					name: 'MiTema2026',
					description: 'existing',
					colors: VALID_OVERRIDES,
				},
			],
		})

		useMvThemeStore.getState().saveCurrentAsPreset('Mi Tema 2026!!!')

		const names = useMvThemeStore.getState().savedPresets.map(preset => preset.name)
		expect(names).toContain('MiTema2026_2')
		expect(names.every(name => NAME_RE.test(name))).toBe(true)
	})

	it('sanitizes and de-duplicates names when renaming presets', () => {
		useMvThemeStore.setState({
			savedPresets: [
				{ id: 'preset-1', name: 'Alpha', description: 'a', colors: VALID_OVERRIDES },
				{ id: 'preset-2', name: 'Beta', description: 'b', colors: VALID_OVERRIDES },
			],
		})

		useMvThemeStore.getState().renameSavedPreset('preset-2', 'Alpha!!!')

		const renamed = useMvThemeStore.getState().savedPresets.find(preset => preset.id === 'preset-2')
		expect(renamed?.name).toBe('Alpha_2')
	})

	it('uses safe naming when duplicating presets', () => {
		useMvThemeStore.setState({
			savedPresets: [
				{
					id: 'preset-source',
					name: 'Mi tema raro!!',
					description: 'source',
					colors: VALID_OVERRIDES,
				},
			],
		})

		const duplicatedId = useMvThemeStore.getState().duplicatePreset('preset-source')

		expect(duplicatedId).toBeTruthy()
		const duplicated = useMvThemeStore.getState().savedPresets.find(preset => preset.id === duplicatedId)
		expect(duplicated?.name).toBe('Mitemararo_copy')
		expect(duplicated?.name).toMatch(NAME_RE)
	})

	it('rejects imports with invalid names and accepts sanitized valid names', () => {
		const rejected = useMvThemeStore.getState().importPresetFromExternal({
			name: '%%%%',
			colors: VALID_OVERRIDES,
		})
		expect(rejected).toBeNull()

		const importedId = useMvThemeStore.getState().importPresetFromExternal({
			name: 'mi-theme_2026',
			colors: VALID_OVERRIDES,
		})
		expect(importedId).toBeTruthy()

		const imported = useMvThemeStore.getState().savedPresets.find(preset => preset.id === importedId)
		expect(imported?.name).toBe('mi-theme_2026')
		expect(imported?.name).toMatch(NAME_RE)
	})

	it('loads current presets as-is and keeps valid names', async () => {
		;(getCompressed as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
			{
				id: 'saved-1',
				name: 'mi_theme_2026',
				description: 'current',
				colors: VALID_OVERRIDES,
			},
		])

		await useMvThemeStore.getState().loadFromStorage()

		const loaded = useMvThemeStore.getState().savedPresets
		expect(loaded).toHaveLength(1)
		expect(loaded[0]?.name).toBe('mi_theme_2026')
		expect(loaded[0]?.name).toMatch(NAME_RE)
	})
})
