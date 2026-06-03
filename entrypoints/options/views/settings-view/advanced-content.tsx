/**
 * Advanced Content - Debug mode, activity tracking, data management
 */
import { useEffect, useState } from 'react'
import { storage } from '#imports'
import { logger } from '@/lib/logger'
import Activity from 'lucide-react/dist/esm/icons/activity'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Download from 'lucide-react/dist/esm/icons/download'
import Upload from 'lucide-react/dist/esm/icons/upload'
import TriangleAlert from 'lucide-react/dist/esm/icons/triangle-alert'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SettingsSection } from '../../components/settings/settings-section'
import { SettingRow } from '../../components/settings'
import { useSettingsStore } from '@/store/settings-store'
import { resetAllData } from '../../lib/export-import'
import { createBackupData, downloadBackupJSON, importBackupData } from '../../lib/backup-service'
import type { BackupData, BackupImportStats } from '../../lib/backup-service'
import {
	getSettingDomId,
	isHighlightedSetting,
	shouldShowSetting,
	type SettingsContentFilter,
} from './constants'
import { cn } from '@/lib/utils'

const LAST_LOCAL_BACKUP_EXPORT_KEY = 'local:mvp-last-local-backup-export'

interface BackupPreview {
	drafts: number
	templates: number
	savedThreads: number
	pinnedThreads: number
	pinnedPosts: number
	contentRules: number
	savedThemes: number
	settings: number
	mutedWords: number
	userCustomizations: number
	favoriteSubforums: number
	hiddenThreads: number
	hiddenSubforums: number
	delayPreferences: number
	subforumStats: number
	appearanceItems: number
	lastExportedAt: string | null
}

interface BackupPreviewItem {
	label: string
	value: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function countArray(value: unknown): number {
	return Array.isArray(value) ? value.length : 0
}

function countObjectKeys(value: unknown): number {
	return isRecord(value) ? Object.keys(value).length : 0
}

function countDraftsAndTemplates(value: unknown): Pick<BackupPreview, 'drafts' | 'templates'> {
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

function countUserCustomizations(value: unknown): number {
	if (isRecord(value) && isRecord(value.users)) return Object.keys(value.users).length
	return countObjectKeys(value)
}

function countDefinedValues(values: unknown[]): number {
	return values.filter(value => value !== undefined && value !== null).length
}

function createBackupPreview(data: BackupData, lastExportedAt: string | null): BackupPreview {
	const { drafts, templates } = countDraftsAndTemplates(data.data.content.drafts)
	const uiTheme = data.data.themes.ui
	const mvTheme = data.data.themes.mediavida

	return {
		drafts,
		templates,
		savedThreads: countArray(data.data.content.savedThreads),
		pinnedThreads: data.data.content.pinnedPosts.length,
		pinnedPosts: data.data.content.pinnedPosts.reduce((total, entry) => total + entry.posts.length, 0),
		contentRules: countArray(data.data.content.contentRules),
		savedThemes: countArray(uiTheme.savedPresets) + countArray(mvTheme.savedPresets),
		settings: countObjectKeys(data.data.settings),
		mutedWords: countArray(data.data.settings.mutedWords),
		userCustomizations: countUserCustomizations(data.data.content.userCustomizations),
		favoriteSubforums: countArray(data.data.content.favoriteSubforums),
		hiddenThreads: countArray(data.data.content.hiddenThreads),
		hiddenSubforums: countArray(data.data.content.hiddenSubforums),
		delayPreferences: countDefinedValues([data.data.preferences.nativeLiveDelay, data.data.preferences.liveThreadDelay]),
		subforumStats: countObjectKeys(data.data.stats.timeStats),
		appearanceItems: countDefinedValues([
			uiTheme.resolvedTheme,
			uiTheme.rawTheme,
			uiTheme.custom,
			uiTheme.customFont,
			uiTheme.applyFontGlobally,
			uiTheme.postFontSize,
			mvTheme.state,
		]),
		lastExportedAt,
	}
}

function formatLastExportDate(value: string | null): string {
	if (!value) return 'Nunca'

	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return 'Fecha no disponible'

	return new Intl.DateTimeFormat('es-ES', {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(date)
}

function formatCount(value: number, singular: string, plural: string): string {
	return `${value} ${value === 1 ? singular : plural}`
}

export function AdvancedContent({
	settingFilter,
	hasActiveFinder,
}: {
	settingFilter?: SettingsContentFilter
	hasActiveFinder?: boolean
}) {
	const { enableActivityTracking, updateSettings } = useSettingsStore()
	const [showResetDialog, setShowResetDialog] = useState(false)
	const [showClearActivityDialog, setShowClearActivityDialog] = useState(false)
	const [showImportReport, setShowImportReport] = useState(false)
	const [importStats, setImportStats] = useState<BackupImportStats | null>(null)
	const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null)
	const [isBackupPreviewLoading, setIsBackupPreviewLoading] = useState(false)
	const [backupPreviewError, setBackupPreviewError] = useState<string | null>(null)
	const [showBackupDetailsDialog, setShowBackupDetailsDialog] = useState(false)

	const handleExport = async () => {
		try {
			const data = await createBackupData()
			const date = new Date().toISOString().split('T')[0]
			downloadBackupJSON(data, `mv-premium-backup-${date}.json`)
			const exportedAt = new Date().toISOString()
			await storage.setItem(LAST_LOCAL_BACKUP_EXPORT_KEY, exportedAt)
			setBackupPreview(createBackupPreview(data, exportedAt))
			toast.success('Datos exportados correctamente')
		} catch (error) {
			toast.error('Error al exportar datos')
			logger.error('Export error:', error)
		}
	}

	const handleImport = async () => {
		const input = document.createElement('input')
		input.type = 'file'
		input.accept = '.json'
		input.onchange = async e => {
			const file = (e.target as HTMLInputElement).files?.[0]
			if (!file) return

			try {
				const text = await file.text()
				const data = JSON.parse(text)
				const result = await importBackupData(data)

				if (result.success && result.stats) {
					setImportStats(result.stats)
					setShowImportReport(true)
					toast.success('Datos importados correctamente')
				} else {
					toast.error(result.error || 'El backup no es válido')
				}
			} catch (error) {
				toast.error(error instanceof SyntaxError ? 'El archivo no contiene JSON válido' : 'Error al importar datos')
				logger.error('Import error:', error)
			}
		}
		input.click()
	}

	const handleReset = async () => {
		try {
			await resetAllData()
			setShowResetDialog(false)
			toast.success('Todos los datos han sido eliminados')
			// Reload to apply changes
			setTimeout(() => window.location.reload(), 1000)
		} catch (error) {
			toast.error('Error al resetear datos')
			logger.error('Reset error:', error)
		}
	}

	const handleToggleActivityTracking = (enabled: boolean) => {
		updateSettings({ enableActivityTracking: enabled })
		toast.success(enabled ? 'Registro de actividad activado' : 'Registro de actividad desactivado')
	}

	const handleClearActivityHistory = async () => {
		try {
			const { clearActivityData } = await import('@/features/stats/storage')
			await clearActivityData()
			setShowClearActivityDialog(false)
			toast.success('Historial de actividad borrado')
		} catch (error) {
			toast.error('Error al borrar historial')
			logger.error('Clear activity error:', error)
		}
	}

	const rowState = (settingId: string) => ({
		settingId,
		hidden: !shouldShowSetting(settingFilter, settingId),
		highlighted: isHighlightedSetting(settingFilter, settingId),
	})
	const customRowClass = (settingId: string) =>
		cn(
			'scroll-mt-28 rounded-lg border border-transparent transition-colors',
			!shouldShowSetting(settingFilter, settingId) && 'hidden',
			isHighlightedSetting(settingFilter, settingId) && 'border-primary/50 bg-primary/10 shadow-sm ring-1 ring-primary/20'
		)
	const showActivityTracking = shouldShowSetting(settingFilter, 'activity-tracking')
	const showBackupData = shouldShowSetting(settingFilter, 'backup-data')
	const showResetData = shouldShowSetting(settingFilter, 'reset-data')

	useEffect(() => {
		if (!showBackupData) return

		let mounted = true

		async function loadBackupPreview() {
			setIsBackupPreviewLoading(true)
			setBackupPreviewError(null)

			try {
				const [data, lastExportedAt] = await Promise.all([
					createBackupData(),
					storage.getItem<string | null>(LAST_LOCAL_BACKUP_EXPORT_KEY),
				])
				if (!mounted) return

				setBackupPreview(createBackupPreview(data, lastExportedAt ?? null))
			} catch (error) {
				if (!mounted) return

				setBackupPreviewError('No se ha podido calcular el resumen del backup.')
				logger.error('Backup preview error:', error)
			} finally {
				if (mounted) setIsBackupPreviewLoading(false)
			}
		}

		void loadBackupPreview()

		return () => {
			mounted = false
		}
	}, [showBackupData])

	const backupPreviewGroups: BackupPreviewItem[] = backupPreview
		? [
				{
					label: 'Borradores y plantillas',
					value: `${formatCount(backupPreview.drafts, 'borrador', 'borradores')} · ${formatCount(backupPreview.templates, 'plantilla', 'plantillas')}`,
				},
				{
					label: 'Hilos guardados',
					value: `${formatCount(backupPreview.savedThreads, 'hilo', 'hilos')} · incluye la ruta del hilo`,
				},
				{
					label: 'Posts anclados',
					value: `${formatCount(backupPreview.pinnedPosts, 'post', 'posts')} · ${formatCount(backupPreview.pinnedThreads, 'hilo', 'hilos')} con anclajes`,
				},
				{
					label: 'Filtros y contenido oculto',
					value: [
						formatCount(backupPreview.contentRules, 'regla', 'reglas'),
						formatCount(backupPreview.mutedWords, 'palabra', 'palabras'),
						formatCount(backupPreview.hiddenThreads + backupPreview.hiddenSubforums, 'oculto', 'ocultos'),
					].join(' · '),
				},
				{
					label: 'Apariencia y preferencias',
					value: [
						formatCount(backupPreview.savedThemes, 'tema guardado', 'temas guardados'),
						formatCount(backupPreview.appearanceItems, 'valor visual', 'valores visuales'),
						formatCount(backupPreview.delayPreferences, 'delay', 'delays'),
					].join(' · '),
				},
				{
					label: 'Datos personales de uso',
					value: [
						formatCount(backupPreview.userCustomizations, 'personalización', 'personalizaciones'),
						formatCount(backupPreview.favoriteSubforums, 'foro favorito', 'foros favoritos'),
						formatCount(backupPreview.subforumStats, 'subforo con tiempo', 'subforos con tiempo'),
					].join(' · '),
				},
				{
					label: 'Ajustes seguros',
					value: `${formatCount(backupPreview.settings, 'opción', 'opciones')} · claves API excluidas`,
				},
			]
		: []
	const backupPreviewSummary = backupPreview
		? [
				formatCount(backupPreview.drafts, 'borrador', 'borradores'),
				formatCount(backupPreview.templates, 'plantilla', 'plantillas'),
				formatCount(backupPreview.savedThreads, 'hilo guardado', 'hilos guardados'),
				formatCount(backupPreview.pinnedPosts, 'post anclado', 'posts anclados'),
				formatCount(backupPreview.contentRules, 'regla', 'reglas'),
				formatCount(backupPreview.savedThemes, 'tema guardado', 'temas guardados'),
			].join(' · ')
		: 'Preparando resumen...'

	return (
		<>
			{(showActivityTracking || showBackupData) && (
				<SettingsSection title="Avanzado" description="Opciones para usuarios avanzados, depuración y gestión de datos.">
					{/* Activity Tracking */}
					{showActivityTracking && (
						<SettingRow
							{...rowState('activity-tracking')}
							icon={<Activity className="h-4 w-4" />}
							label="Registro de actividad (Heatmap)"
							description="Registra posts creados y editados para el heatmap del dashboard."
						>
							<Switch checked={enableActivityTracking} onCheckedChange={handleToggleActivityTracking} />
						</SettingRow>
					)}

					{showActivityTracking && !hasActiveFinder && (
						<div className="flex items-center justify-between py-2 pl-8">
							<span className="text-sm text-muted-foreground">Borrar todo el historial del heatmap</span>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowClearActivityDialog(true)}
								className="text-destructive hover:text-destructive"
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Borrar historial
							</Button>
						</div>
					)}

					{showActivityTracking && showBackupData && <Separator />}

					{/* Data Management */}
					<div
						id={getSettingDomId('backup-data')}
						data-setting-id="backup-data"
						className={customRowClass('backup-data')}
					>
						<div className="space-y-4 p-2 pt-2">
							<div>
								<h3 className="text-base font-medium">Copia de seguridad local</h3>
								<p className="text-sm text-muted-foreground mt-1">
									Exporta o importa un backup JSON de tus datos seguros de MV Premium.
								</p>
							</div>

							<div className="rounded-md bg-muted/20 p-3">
								{backupPreviewError ? (
									<p className="text-sm text-destructive">{backupPreviewError}</p>
								) : backupPreview ? (
									<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
										<div className="min-w-0 space-y-1">
											<p className="text-sm font-medium">Backup local listo</p>
											<p className="text-xs text-muted-foreground">{backupPreviewSummary}</p>
											<p className="text-xs text-muted-foreground">
												Sin claves API, tokens, cachés ni historial. Incluye rutas de hilos/posts guardados para restaurarlos.
											</p>
										</div>
										<div className="flex shrink-0 flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center lg:flex-col lg:items-end">
											<span>
												Última exportación: {formatLastExportDate(backupPreview.lastExportedAt)}
												{isBackupPreviewLoading && ' · Actualizando...'}
											</span>
											<Button
												type="button"
												variant="link"
												size="sm"
												className="h-auto justify-start p-0 text-xs lg:justify-end"
												onClick={() => setShowBackupDetailsDialog(true)}
											>
												Ver detalle del backup
											</Button>
										</div>
									</div>
								) : (
									<p className="text-sm text-muted-foreground">Preparando resumen...</p>
								)}
							</div>

							<div className="flex flex-wrap gap-3">
								<Button variant="outline" className="gap-2" onClick={handleExport}>
									<Download className="h-4 w-4" />
									Exportar datos
								</Button>
								<Button variant="outline" className="gap-2" onClick={handleImport}>
									<Upload className="h-4 w-4" />
									Importar datos
								</Button>
							</div>
						</div>
					</div>
				</SettingsSection>
			)}

			<AlertDialog open={showBackupDetailsDialog} onOpenChange={setShowBackupDetailsDialog}>
				<AlertDialogContent className="max-w-xl">
					<AlertDialogHeader>
						<AlertDialogTitle>Detalle del backup</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="space-y-3 mt-2">
								<p className="text-sm">
									Se exportarán estos datos seguros para poder restaurarlos más adelante:
								</p>
								{backupPreview && (
									<div className="grid grid-cols-1 gap-x-4 gap-y-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider sm:grid-cols-2">
										{backupPreviewGroups.map(item => (
											<div key={item.label} className="flex items-start gap-2">
												<span className="mt-1 text-primary text-[8px]">●</span>
												<span>
													<span className="block text-foreground">{item.label}</span>
													<span className="normal-case tracking-normal text-muted-foreground">{item.value}</span>
												</span>
											</div>
										))}
									</div>
								)}
								<p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
									Las rutas de hilos guardados y posts anclados se incluyen porque son necesarias para restaurarlos.
									No se exportan claves API, tokens, cachés, datos temporales, historial granular ni URLs visitadas.
								</p>
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogAction onClick={() => setShowBackupDetailsDialog(false)}>Cerrar</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Danger Zone - Separate section for destructive actions */}
			<div
				id={getSettingDomId('reset-data')}
				data-setting-id="reset-data"
				className={cn(
					(showActivityTracking || showBackupData) && 'mt-6 border-t border-destructive/30 pt-6',
					!showResetData && 'hidden',
					isHighlightedSetting(settingFilter, 'reset-data') && 'rounded-lg border border-primary/50 bg-primary/10 p-2 shadow-sm ring-1 ring-primary/20'
				)}
			>
				<div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
					<div className="flex items-start gap-3">
						<div className="p-2 rounded-full bg-destructive/10">
							<TriangleAlert className="h-5 w-5 text-destructive" />
						</div>
						<div className="flex-1">
							<h3 className="text-base font-semibold text-destructive">Zona de Peligro</h3>
							<p className="text-sm text-muted-foreground mt-1">
								Elimina todos los datos de la extensión: borradores, plantillas, hilos guardados, posts anclados,
								configuraciones y palabras silenciadas. Esta acción es irreversible.
							</p>
							<Button variant="destructive" className="mt-4 gap-2" onClick={() => setShowResetDialog(true)}>
								<Trash2 className="h-4 w-4" />
								Eliminar todos mis datos
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Clear Activity Confirmation Dialog */}
			<ConfirmDialog
				open={showClearActivityDialog}
				onOpenChange={setShowClearActivityDialog}
				title="¿Borrar historial de actividad?"
				description={
					<>
						Esto eliminará todo el historial del heatmap de actividad. Los datos de posts creados y editados se perderán
						permanentemente.
						<span className="block mt-3 font-medium text-destructive">Esta acción no se puede deshacer.</span>
					</>
				}
				confirmText="Sí, borrar historial"
				variant="destructive"
				onConfirm={handleClearActivityHistory}
			/>

			{/* Reset Confirmation Dialog */}
			<ConfirmDialog
				open={showResetDialog}
				onOpenChange={setShowResetDialog}
				title="¿Eliminar todos los datos?"
				description={
					<>
						Esta acción eliminará permanentemente todos tus datos almacenados en la extensión:
						<ul className="list-disc list-inside mt-2 space-y-1">
							<li>Borradores y plantillas</li>
							<li>Hilos guardados</li>
							<li>Posts anclados</li>
							<li>Palabras silenciadas</li>
							<li>Todas las configuraciones</li>
						</ul>
						<span className="block mt-3 font-medium text-destructive">Esta acción no se puede deshacer.</span>
					</>
				}
				confirmText="Sí, eliminar todo"
				variant="destructive"
				onConfirm={handleReset}
			/>

			{/* Import Report Dialog */}
			<ConfirmDialog
				open={showImportReport}
				onOpenChange={setShowImportReport}
				title="Importación Completada"
				description={
					importStats &&
					(() => {
						const totalChanges =
							importStats.pinnedPosts +
							importStats.savedThreads +
							importStats.drafts +
							importStats.templates +
							importStats.mutedWords +
							importStats.userCustomizations +
							importStats.favorites +
							importStats.subforumStats +
							importStats.contentRules +
							importStats.hiddenThreads +
							importStats.hiddenSubforums +
							(importStats.themesUpdated ? 1 : 0) +
							(importStats.settingsUpdated ? 1 : 0)

						if (totalChanges === 0) {
							return (
								<div className="space-y-3 mt-2">
									<p className="text-sm text-muted-foreground">
										El archivo analizado no contiene datos nuevos ni diferencias con tu configuración actual.
									</p>
									<p className="text-sm font-medium">Todo está actualizado. No se ha realizado ninguna acción.</p>
								</div>
							)
						}

						return (
							<div className="space-y-3 mt-2">
								<p className="text-sm">Se han restaurado los siguientes datos correctamente:</p>
								<div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
									{importStats.pinnedPosts > 0 && (
										<div className="flex items-center gap-2">
											<span className="text-primary text-[8px]">●</span>
											<span>
												{importStats.pinnedPosts} {importStats.pinnedPosts === 1 ? 'Post Anclado' : 'Posts Anclados'}
											</span>
										</div>
									)}
									{importStats.savedThreads > 0 && (
										<div className="flex items-center gap-2">
											<span className="text-primary text-[8px]">●</span>
											<span>
												{importStats.savedThreads}{' '}
												{importStats.savedThreads === 1 ? 'Hilo Guardado' : 'Hilos Guardados'}
											</span>
										</div>
									)}
									{importStats.drafts > 0 && (
										<div className="flex items-center gap-2">
											<span className="text-primary text-[8px]">●</span>
											<span>
												{importStats.drafts} {importStats.drafts === 1 ? 'Borrador' : 'Borradores'}
											</span>
										</div>
									)}
									{importStats.templates > 0 && (
										<div className="flex items-center gap-2">
											<span className="text-primary text-[8px]">●</span>
											<span>
												{importStats.templates} {importStats.templates === 1 ? 'Plantilla' : 'Plantillas'}
											</span>
										</div>
									)}
									{importStats.mutedWords > 0 && (
										<div className="flex items-center gap-2">
											<span className="text-primary text-[8px]">●</span>
											<span>
												{importStats.mutedWords}{' '}
												{importStats.mutedWords === 1 ? 'Palabra Silenciada' : 'Palabras Silenciadas'}
											</span>
										</div>
									)}
									{importStats.userCustomizations > 0 && (
										<div className="flex items-center gap-2">
											<span className="text-primary text-[8px]">●</span>
											<span>
												{importStats.userCustomizations}{' '}
												{importStats.userCustomizations === 1 ? 'Usuario Personalizado' : 'Usuarios Personalizados'}
											</span>
										</div>
									)}
									{importStats.favorites > 0 && (
										<div className="flex items-center gap-2">
											<span className="text-primary text-[8px]">●</span>
											<span>
												{importStats.favorites} {importStats.favorites === 1 ? 'Foro Favorito' : 'Foros Favoritos'}
											</span>
										</div>
									)}
									{importStats.subforumStats > 0 && (
										<div className="flex items-center gap-2">
											<span className="text-primary text-[8px]">●</span>
											<span>
												{importStats.subforumStats}{' '}
												{importStats.subforumStats === 1 ? 'Stats de Subforo' : 'Stats de Subforos'}
											</span>
										</div>
									)}
									{importStats.contentRules > 0 && (
										<div className="flex items-center gap-2">
											<span className="text-primary text-[8px]">●</span>
											<span>
												{importStats.contentRules}{' '}
												{importStats.contentRules === 1 ? 'Regla de contenido' : 'Reglas de contenido'}
											</span>
										</div>
									)}
									{importStats.hiddenThreads > 0 && (
										<div className="flex items-center gap-2">
											<span className="text-primary text-[8px]">●</span>
											<span>
												{importStats.hiddenThreads}{' '}
												{importStats.hiddenThreads === 1 ? 'Hilo oculto' : 'Hilos ocultos'}
											</span>
										</div>
									)}
									{importStats.hiddenSubforums > 0 && (
										<div className="flex items-center gap-2">
											<span className="text-primary text-[8px]">●</span>
											<span>
												{importStats.hiddenSubforums}{' '}
												{importStats.hiddenSubforums === 1 ? 'Subforo oculto' : 'Subforos ocultos'}
											</span>
										</div>
									)}
									{importStats.themesUpdated && (
										<div className="flex items-center gap-2 col-span-2">
											<span className="text-primary text-[8px]">●</span>
											<span>Temas y apariencia</span>
										</div>
									)}
									{importStats.settingsUpdated && (
										<div className="flex items-center gap-2 col-span-2">
											<span className="text-primary text-[8px]">●</span>
											<span>Ajustes y Configuraciones</span>
										</div>
									)}
								</div>
								<p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
									Es posible que algunos cambios requieran recargar la página para ser visibles.
								</p>
							</div>
						)
					})()
				}
				confirmText="Entendido"
				onConfirm={() => {
					setShowImportReport(false)
					window.location.reload()
				}}
				variant="default"
			/>
		</>
	)
}
