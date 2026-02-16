/**
 * useMvThemeEditor - Custom hook that manages all MV Theme editor state.
 *
 * Extracts business logic (linked preset tracking, dirty detection,
 * save/rename flows) from the view so components stay purely presentational.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import { type ImportedMvThemePresetData, useMvThemeStore } from '../mv-theme-store'
import { getBuiltInPreset, type MvThemePreset } from '../presets'

const PRESET_NAME_MAX_LENGTH = 20
const PRESET_NAME_ALLOWED_RE = /^[A-Za-z0-9_-]+$/
const MV_THEME_PRESET_EXPORT_FORMAT = 'mv-premium-theme-preset'
const MV_THEME_PRESET_EXPORT_VERSION = 1

// ── Granular selectors ─────────────────────────────────────────────────────

const selectIsLoaded = (s: ReturnType<typeof useMvThemeStore.getState>) => s.isLoaded
const selectEnabled = (s: ReturnType<typeof useMvThemeStore.getState>) => s.enabled
const selectActivePresetId = (s: ReturnType<typeof useMvThemeStore.getState>) => s.activePresetId
const selectColorOverrides = (s: ReturnType<typeof useMvThemeStore.getState>) => s.colorOverrides
const selectSavedPresets = (s: ReturnType<typeof useMvThemeStore.getState>) => s.savedPresets

// ── Hook ───────────────────────────────────────────────────────────────────

export function useMvThemeEditor() {
	// Granular store subscriptions
	const isLoaded = useMvThemeStore(selectIsLoaded)
	const enabled = useMvThemeStore(selectEnabled)
	const activePresetId = useMvThemeStore(selectActivePresetId)
	const colorOverrides = useMvThemeStore(selectColorOverrides)
	const savedPresets = useMvThemeStore(selectSavedPresets)

	// Store actions (stable refs from zustand)
	const loadFromStorage = useMvThemeStore(s => s.loadFromStorage)
	const setEnabled = useMvThemeStore(s => s.setEnabled)
	const setGroupColor = useMvThemeStore(s => s.setGroupColor)
	const applyPreset = useMvThemeStore(s => s.applyPreset)
	const generateRandomWcag = useMvThemeStore(s => s.generateRandomWcag)
	const resetToDefaults = useMvThemeStore(s => s.resetToDefaults)
	const saveCurrentAsPreset = useMvThemeStore(s => s.saveCurrentAsPreset)
	const duplicatePreset = useMvThemeStore(s => s.duplicatePreset)
	const importPresetFromExternal = useMvThemeStore(s => s.importPresetFromExternal)
	const updateSavedPreset = useMvThemeStore(s => s.updateSavedPreset)
	const renameSavedPreset = useMvThemeStore(s => s.renameSavedPreset)
	const deletePreset = useMvThemeStore(s => s.deletePreset)

	// ── Local UI state ───────────────────────────────────────────────────

	const [linkedPresetId, setLinkedPresetId] = useState<string | null>(null)
	const [detachedThemeSource, setDetachedThemeSource] = useState<'manual' | 'random'>('manual')

	// Save flow
	const [saveDialogOpen, setSaveDialogOpen] = useState(false)
	const [presetName, setPresetName] = useState('')

	// Rename flow
	const [isRenaming, setIsRenaming] = useState(false)
	const [renameValue, setRenameValue] = useState('')

	const handlePresetNameInput = useCallback((value: string) => {
		setPresetName(sanitizePresetName(value))
	}, [])

	const handleRenameValueInput = useCallback((value: string) => {
		setRenameValue(sanitizePresetName(value))
	}, [])

	// ── Hydration ────────────────────────────────────────────────────────

	useEffect(() => {
		if (isLoaded) return
		void loadFromStorage().catch(error => {
			logger.error('Failed to load MV theme editor state from storage:', error)
		})
	}, [isLoaded, loadFromStorage])

	// Sync linked preset when store's activePresetId changes externally
	useEffect(() => {
		if (!isLoaded) return
		if (activePresetId === 'custom') return
		setLinkedPresetId(activePresetId === 'original' ? null : activePresetId)
	}, [isLoaded, activePresetId])

	// ── Derived state ────────────────────────────────────────────────────

	const hasOverrides = Object.keys(colorOverrides).length > 0

	const linkedSavedPreset = useMemo(
		() => (linkedPresetId ? savedPresets.find(p => p.id === linkedPresetId) ?? null : null),
		[linkedPresetId, savedPresets],
	)

	const linkedBuiltInPreset = useMemo(
		() => (linkedPresetId ? getBuiltInPreset(linkedPresetId) ?? null : null),
		[linkedPresetId],
	)

	const linkedPreset: MvThemePreset | null = linkedSavedPreset ?? linkedBuiltInPreset

	const isDetachedCustom = activePresetId === 'custom' && !linkedPresetId
	const isDetachedRandom = isDetachedCustom && detachedThemeSource === 'random'
	const isOriginalTheme = activePresetId === 'original' && !hasOverrides

	const galleryActivePresetId = linkedPresetId ?? activePresetId

	const isDirty = useMemo(() => {
		if (!linkedPreset) return false
		const presetColors = linkedPreset.colors
		for (const [key, value] of Object.entries(colorOverrides)) {
			if (presetColors[key] !== value) return true
		}
		return Object.keys(presetColors).length !== Object.keys(colorOverrides).length
	}, [linkedPreset, colorOverrides])

	// ── Handlers ─────────────────────────────────────────────────────────

	const closeSavePanel = useCallback(() => {
		setSaveDialogOpen(false)
		setPresetName('')
	}, [])

	const handleSelectPreset = useCallback((presetId: string) => {
		applyPreset(presetId)
		setLinkedPresetId(presetId === 'original' ? null : presetId)
		setDetachedThemeSource('manual')
		setSaveDialogOpen(false)
		setPresetName('')
		setIsRenaming(false)
	}, [applyPreset])

	const handleDeletePreset = useCallback((presetId: string) => {
		deletePreset(presetId)
		if (linkedPresetId === presetId) setLinkedPresetId(null)
		closeSavePanel()
	}, [deletePreset, linkedPresetId, closeSavePanel])

	const handleCopyPreset = useCallback((presetId: string) => {
		const newPresetId = duplicatePreset(presetId)
		if (newPresetId) {
			const nextActivePresetId = useMvThemeStore.getState().activePresetId
			setLinkedPresetId(nextActivePresetId === 'original' ? null : newPresetId)
			setDetachedThemeSource('manual')
			closeSavePanel()
			toast.success('Preset copiado')
		}
	}, [duplicatePreset, closeSavePanel])

	const handleExportPreset = useCallback((presetId: string) => {
		const preset = savedPresets.find(item => item.id === presetId)
		if (!preset) {
			toast.error('Solo se pueden exportar presets personalizados')
			return
		}
		if (Object.keys(preset.colors).length === 0) {
			toast.error('Este preset no tiene colores para exportar')
			return
		}

		const payload: ExportedMvThemePresetFile = {
			format: MV_THEME_PRESET_EXPORT_FORMAT,
			version: MV_THEME_PRESET_EXPORT_VERSION,
			exportedAt: new Date().toISOString(),
			preset: {
				name: preset.name,
				description: preset.description,
				colors: preset.colors,
			},
		}

		downloadThemePresetFile(payload, preset.name)
		toast.success('Theme exportado')
	}, [savedPresets])

	const handleImportPreset = useCallback(() => {
		const input = document.createElement('input')
		input.type = 'file'
		input.accept = '.json,application/json'

		input.onchange = async event => {
			const file = (event.target as HTMLInputElement).files?.[0]
			if (!file) return

			try {
				const text = await file.text()
				const parsedJson: unknown = JSON.parse(text)
				const importedPresetData = extractImportedPresetData(parsedJson)
				if (!importedPresetData) {
					toast.error('Archivo de theme inválido')
					return
				}

				const newPresetId = importPresetFromExternal(importedPresetData)
				if (!newPresetId) {
					toast.error('No se pudo importar el theme (sin colores válidos)')
					return
				}

				setLinkedPresetId(newPresetId)
				setDetachedThemeSource('manual')
				closeSavePanel()
				toast.success('Theme importado')
			} catch (error) {
				toast.error('Error al importar theme')
				logger.error('Failed to import MV theme preset:', error)
			}
		}

		input.click()
	}, [importPresetFromExternal, closeSavePanel])

	const handleGenerateRandom = useCallback(() => {
		generateRandomWcag()
		setLinkedPresetId(null)
		setDetachedThemeSource('random')
		closeSavePanel()
	}, [generateRandomWcag, closeSavePanel])

	const handleColorChange = useCallback((groupId: string, hex: string) => {
		setGroupColor(groupId, hex)
		if (!linkedPresetId) setDetachedThemeSource('manual')
	}, [setGroupColor, linkedPresetId])

	const handleRevertToPreset = useCallback(() => {
		if (linkedPresetId) {
			applyPreset(linkedPresetId)
		} else {
			resetToDefaults()
			setLinkedPresetId(null)
		}
		setDetachedThemeSource('manual')
		closeSavePanel()
	}, [linkedPresetId, applyPreset, resetToDefaults, closeSavePanel])

	const handleResetToOriginal = useCallback(() => {
		resetToDefaults()
		setLinkedPresetId(null)
		setDetachedThemeSource('manual')
		closeSavePanel()
	}, [resetToDefaults, closeSavePanel])

	const handleSaveNew = useCallback(() => {
		const safeName = sanitizePresetName(presetName)
		if (!safeName || !PRESET_NAME_ALLOWED_RE.test(safeName)) {
			toast.error('Nombre inválido. Usa solo letras, números, guion (-) o guion bajo (_).')
			return
		}
		saveCurrentAsPreset(safeName)
		setDetachedThemeSource('manual')
		setPresetName('')
		setSaveDialogOpen(false)
	}, [presetName, saveCurrentAsPreset])

	const handleUpdatePreset = useCallback(() => {
		if (!linkedSavedPreset) return
		updateSavedPreset(linkedSavedPreset.id)
		setDetachedThemeSource('manual')
		closeSavePanel()
	}, [linkedSavedPreset, updateSavedPreset, closeSavePanel])

	const handleStartRename = useCallback(() => {
		if (!linkedSavedPreset) return
		setRenameValue(linkedSavedPreset.name)
		setIsRenaming(true)
	}, [linkedSavedPreset])

	const handleConfirmRename = useCallback(() => {
		if (!linkedSavedPreset) return
		const safeName = sanitizePresetName(renameValue)
		if (!safeName || !PRESET_NAME_ALLOWED_RE.test(safeName)) {
			toast.error('Nombre inválido. Usa solo letras, números, guion (-) o guion bajo (_).')
			return
		}
		renameSavedPreset(linkedSavedPreset.id, safeName)
		setIsRenaming(false)
		setRenameValue('')
	}, [linkedSavedPreset, renameValue, renameSavedPreset])

	const handleCancelRename = useCallback(() => {
		setIsRenaming(false)
		setRenameValue('')
	}, [])

	const handleOpenSaveDialog = useCallback(() => {
		setPresetName('')
		setSaveDialogOpen(true)
	}, [])

	return {
		// State
		isLoaded,
		enabled,
		colorOverrides,
		savedPresets,
		hasOverrides,
		galleryActivePresetId,

		// Linked preset
		linkedPreset,
		linkedSavedPreset,
		linkedBuiltInPreset,
		isDirty,
		isDetachedRandom,
		isOriginalTheme,

		// Save flow
		saveDialogOpen,
		presetName,
		setPresetName: handlePresetNameInput,
		PRESET_NAME_MAX_LENGTH,

		// Rename flow
		isRenaming,
		renameValue,
		setRenameValue: handleRenameValueInput,

		// Actions
		setEnabled,
		handleSelectPreset,
		handleCopyPreset,
		handleExportPreset,
		handleImportPreset,
		handleDeletePreset,
		handleGenerateRandom,
		handleColorChange,
		handleRevertToPreset,
		handleResetToOriginal,
		handleSaveNew,
		handleUpdatePreset,
		handleStartRename,
		handleConfirmRename,
		handleCancelRename,
		handleOpenSaveDialog,
		closeSavePanel,
	} as const
}

interface ExportedMvThemePresetFile {
	format: typeof MV_THEME_PRESET_EXPORT_FORMAT
	version: typeof MV_THEME_PRESET_EXPORT_VERSION
	exportedAt: string
	preset: {
		name: string
		description?: string
		colors: Record<string, string>
	}
}

function downloadThemePresetFile(payload: ExportedMvThemePresetFile, presetName: string): void {
	const fileName = buildThemePresetFilename(presetName)
	const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = fileName
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
	window.setTimeout(() => URL.revokeObjectURL(url), 100)
}

function buildThemePresetFilename(presetName: string): string {
	const safeName = presetName
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9_-]/g, '')
		.slice(0, 40)
	const date = new Date().toISOString().slice(0, 10)
	return `mv-theme-${safeName || 'preset'}-${date}.json`
}

function extractImportedPresetData(payload: unknown): ImportedMvThemePresetData | null {
	if (!isRecord(payload)) return null

	const candidate =
		payload.format === MV_THEME_PRESET_EXPORT_FORMAT && isRecord(payload.preset)
			? payload.preset
			: payload

	const name = typeof candidate.name === 'string' ? sanitizePresetName(candidate.name) : ''
	if (!name || !PRESET_NAME_ALLOWED_RE.test(name)) return null

	if (!isRecord(candidate.colors)) return null
	const colors: Record<string, string> = {}
	for (const [groupId, value] of Object.entries(candidate.colors)) {
		if (typeof value === 'string') {
			colors[groupId] = value
		}
	}
	if (Object.keys(colors).length === 0) return null

	const description = typeof candidate.description === 'string' ? candidate.description : undefined

	return { name, description, colors }
}

function sanitizePresetName(value: string): string {
	return value
		.trim()
		.replace(/[^A-Za-z0-9_-]/g, '')
		.slice(0, PRESET_NAME_MAX_LENGTH)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}
