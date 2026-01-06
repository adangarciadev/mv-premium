/**
 * Advanced Content - Debug mode, activity tracking, data management
 */
import { useState } from 'react'
import { logger } from '@/lib/logger'
import Code from 'lucide-react/dist/esm/icons/code'
import Activity from 'lucide-react/dist/esm/icons/activity'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Download from 'lucide-react/dist/esm/icons/download'
import Upload from 'lucide-react/dist/esm/icons/upload'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SettingsSection } from '../../components/settings/settings-section'
import { SettingRow } from '../../components/settings'
import { useSettingsStore } from '@/store/settings-store'
import { exportAllData, importAllData, resetAllData, downloadJSON } from '../../lib/export-import'

export function AdvancedContent() {
	const { debugMode, setDebugMode, enableActivityTracking, updateSettings } = useSettingsStore()
	const [showResetDialog, setShowResetDialog] = useState(false)
	const [showClearActivityDialog, setShowClearActivityDialog] = useState(false)
	const [showImportReport, setShowImportReport] = useState(false)
	const [importStats, setImportStats] = useState<any>(null)

	const handleExport = async () => {
		try {
			const data = await exportAllData()
			const date = new Date().toISOString().split('T')[0]
			downloadJSON(data, `mv-premium-backup-${date}.json`)
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
				const result = await importAllData(data)

				if (result.success && result.stats) {
					setImportStats(result.stats)
					setShowImportReport(true)
					toast.success('Datos importados correctamente')
				} else {
					toast.error(result.error || 'Error desconocido')
				}
			} catch (error) {
				toast.error('Error al importar datos')
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

	return (
		<>
			<SettingsSection title="Avanzado" description="Opciones para usuarios avanzados, depuración y gestión de datos.">
				<SettingRow
					icon={<Code className="h-4 w-4" />}
					label="Modo depuración"
					description="Muestra mensajes detallados en la consola del navegador."
				>
					<Switch checked={debugMode} onCheckedChange={setDebugMode} />
				</SettingRow>

				<Separator />

				{/* Activity Tracking */}
				<SettingRow
					icon={<Activity className="h-4 w-4" />}
					label="Registro de actividad (Heatmap)"
					description="Registra posts creados y editados para el heatmap del dashboard."
				>
					<Switch checked={enableActivityTracking} onCheckedChange={handleToggleActivityTracking} />
				</SettingRow>

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

				<Separator />

				{/* Data Management */}
				<div className="space-y-4 pt-2">
					<div>
						<h3 className="text-base font-medium">Copia de Seguridad</h3>
						<p className="text-sm text-muted-foreground mt-1">Exporta o importa tus datos y configuraciones.</p>
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
					<p className="text-xs text-muted-foreground">
						La exportación incluye: palabras silenciadas, posts anclados, borradores, plantillas y preferencias.
					</p>
				</div>
			</SettingsSection>

			{/* Danger Zone - Separate section for destructive actions */}
			<div className="mt-6 pt-6 border-t border-destructive/30">
				<div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
					<div className="flex items-start gap-3">
						<div className="p-2 rounded-full bg-destructive/10">
							<RotateCcw className="h-5 w-5 text-destructive" />
						</div>
						<div className="flex-1">
							<h3 className="text-base font-semibold text-destructive">Zona de Peligro</h3>
							<p className="text-sm text-muted-foreground mt-1">
								Elimina todos los datos de la extensión: borradores, plantillas, hilos guardados, posts anclados,
								configuraciones y palabras silenciadas. Esta acción es irreversible.
							</p>
							<Button variant="destructive" className="mt-4 gap-2" onClick={() => setShowResetDialog(true)}>
								<RotateCcw className="h-4 w-4" />
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
							importStats.activityDays +
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
									{importStats.activityDays > 0 && (
										<div className="flex items-center gap-2">
											<span className="text-primary text-[8px]">●</span>
											<span>
												{importStats.activityDays}{' '}
												{importStats.activityDays === 1 ? 'Día de Actividad' : 'Días de Actividad'}
											</span>
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
