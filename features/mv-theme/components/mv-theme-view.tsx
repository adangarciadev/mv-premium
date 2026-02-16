/**
 * MV Theme View - Dashboard page for Mediavida site theme customization
 *
 * Route: /mv-theme
 *
 * Pure composition component - all business logic lives in useMvThemeEditor.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useMvThemeEditor } from '../hooks/use-mv-theme-editor'
import { MvThemeHeader } from './mv-theme-header'
import { MvThemePresetGallery } from './mv-theme-preset-gallery'
import { MvThemeToolbar } from './mv-theme-toolbar'
import { MvThemeLivePreview } from './mv-theme-live-preview'
import { MvThemeColorEditor } from './mv-theme-color-editor'

export function MvThemeView() {
	const editor = useMvThemeEditor()

	if (!editor.isLoaded) {
		return (
			<div className="space-y-6 animate-pulse">
				<div className="h-8 w-64 bg-muted rounded" />
				<div className="h-48 bg-muted rounded-lg" />
			</div>
		)
	}

	return (
		<div className="space-y-6 pb-10">
			{/* ── Header + Toggle ──────────────────────────────────── */}
			<MvThemeHeader
				enabled={editor.enabled}
				onToggle={editor.setEnabled}
			/>

			{/* ── Preset Gallery ───────────────────────────────────── */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Presets</CardTitle>
					<CardDescription>
						Aplica un preset o genera un tema aleatorio para personalizar Mediavida
					</CardDescription>
				</CardHeader>
				<CardContent>
					<MvThemePresetGallery
						activePresetId={editor.galleryActivePresetId}
						savedPresets={editor.savedPresets}
						onSelect={editor.handleSelectPreset}
						onCopy={editor.handleCopyPreset}
						onExport={editor.handleExportPreset}
						onImport={editor.handleImportPreset}
						onDelete={editor.handleDeletePreset}
					/>
				</CardContent>
			</Card>

			{/* ── Toolbar + Editor (hidden when original MV theme is active) ── */}
			{!editor.isOriginalTheme && (
				<>
					<MvThemeToolbar
						linkedSavedPreset={editor.linkedSavedPreset}
						linkedBuiltInPreset={editor.linkedBuiltInPreset}
						linkedPreset={editor.linkedPreset}
						isDirty={editor.isDirty}
						isDetachedRandom={editor.isDetachedRandom}
						hasOverrides={editor.hasOverrides}
						saveDialogOpen={editor.saveDialogOpen}
						presetName={editor.presetName}
						maxNameLength={editor.PRESET_NAME_MAX_LENGTH}
						onPresetNameChange={editor.setPresetName}
						onOpenSaveDialog={editor.handleOpenSaveDialog}
						onSaveNew={editor.handleSaveNew}
						onCloseSavePanel={editor.closeSavePanel}
						isRenaming={editor.isRenaming}
						renameValue={editor.renameValue}
						onRenameValueChange={editor.setRenameValue}
						onStartRename={editor.handleStartRename}
						onConfirmRename={editor.handleConfirmRename}
						onCancelRename={editor.handleCancelRename}
						onGenerateRandom={editor.handleGenerateRandom}
						onRevertToPreset={editor.handleRevertToPreset}
						onResetToOriginal={editor.handleResetToOriginal}
						onUpdatePreset={editor.handleUpdatePreset}
					/>

					<Card>
						<CardHeader>
							<CardTitle className="text-base">Editor de colores</CardTitle>
							<CardDescription>
								Ajusta cada grupo de color individualmente. La vista previa se actualiza en tiempo real.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-5">
							<MvThemeLivePreview colorOverrides={editor.colorOverrides} />

							<MvThemeColorEditor
								colorOverrides={editor.colorOverrides}
								referenceColors={editor.linkedPreset?.colors}
								onColorChange={editor.handleColorChange}
								onReset={editor.handleRevertToPreset}
								resetLabel={editor.linkedPreset ? 'Deshacer cambios' : 'Restaurar original'}
							/>
						</CardContent>
					</Card>
				</>
			)}
		</div>
	)
}
