import { useNavigate, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import Download from 'lucide-react/dist/esm/icons/download'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import ListFilter from 'lucide-react/dist/esm/icons/list-filter'
import MessageSquareOff from 'lucide-react/dist/esm/icons/message-square-off'
import Upload from 'lucide-react/dist/esm/icons/upload'
import Users from 'lucide-react/dist/esm/icons/users'
import VolumeX from 'lucide-react/dist/esm/icons/volume-x'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserFinder } from '@/components/users/user-finder'
import { logger } from '@/lib/logger'
import {
	downloadFiltersJSON,
	exportFiltersData,
	importFiltersData,
	previewFiltersImportData,
	type FiltersImportStats,
} from '../lib/filters-import-export'
import { ContentRulesView } from './content-rules-view'
import { normalizeFilterTab } from './filters-tabs'
import { HiddenSubforumsView } from './hidden-subforums-view'
import { HiddenThreadsView } from './hidden-threads-view'
import MutedPostsView from './muted-posts-view'

export function FiltersView() {
	const [searchParams] = useSearchParams()
	const navigate = useNavigate()
	const activeTab = normalizeFilterTab(searchParams.get('tab'))
	const [pendingImport, setPendingImport] = useState<{ data: unknown; stats: FiltersImportStats } | null>(null)

	const handleExportFilters = async () => {
		try {
			const data = await exportFiltersData()
			const date = new Date().toISOString().split('T')[0]
			downloadFiltersJSON(data, `mv-premium-filtros-${date}.json`)
			toast.success('Filtros exportados correctamente')
		} catch (error) {
			toast.error('Error al exportar filtros')
			logger.error('Filters export error:', error)
		}
	}

	const handleImportFilters = () => {
		const input = document.createElement('input')
		input.type = 'file'
		input.accept = '.json'
		input.onchange = async event => {
			const file = (event.target as HTMLInputElement).files?.[0]
			if (!file) return

			try {
				const data = JSON.parse(await file.text()) as unknown
				const preview = previewFiltersImportData(data)
				if (!preview.success || !preview.stats) {
					toast.error(preview.error || 'El archivo no contiene filtros compatibles')
					return
				}

				setPendingImport({ data, stats: preview.stats })
			} catch (error) {
				toast.error('Error al leer el archivo de filtros')
				logger.error('Filters import read error:', error)
			}
		}
		input.click()
	}

	const confirmImportFilters = async () => {
		if (!pendingImport) return

		const result = await importFiltersData(pendingImport.data)
		if (result.success) {
			setPendingImport(null)
			toast.success('Filtros importados correctamente')
			return
		}

		toast.error(result.error || 'Error al importar filtros')
	}

	return (
		<div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 animate-in fade-in duration-300">
			<header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-primary/10 text-primary">
						<ListFilter className="h-5 w-5" />
					</div>
					<div>
						<h1 className="text-3xl font-bold tracking-tight">Filtros</h1>
						<p className="text-sm text-muted-foreground">
							Controla lo que MV Premium oculta, silencia o destaca en Mediavida.
						</p>
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button type="button" variant="outline" className="gap-2" onClick={handleExportFilters}>
						<Download className="h-4 w-4" />
						Exportar filtros
					</Button>
					<Button type="button" variant="outline" className="gap-2" onClick={handleImportFilters}>
						<Upload className="h-4 w-4" />
						Importar filtros
					</Button>
				</div>
			</header>

			<Tabs
				value={activeTab}
				onValueChange={value => navigate(`/filters?tab=${value}`)}
				className="w-full gap-5"
			>
				<TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-3 lg:grid-cols-5">
					<TabsTrigger value="threads" className="gap-2">
						<ListFilter className="h-4 w-4" />
						Reglas de hilos
					</TabsTrigger>
					<TabsTrigger value="words" className="gap-2">
						<VolumeX className="h-4 w-4" />
						Palabras
					</TabsTrigger>
					<TabsTrigger value="users" className="gap-2">
						<Users className="h-4 w-4" />
						Usuarios
					</TabsTrigger>
					<TabsTrigger value="hidden-threads" className="gap-2">
						<MessageSquareOff className="h-4 w-4" />
						Hilos ocultos
					</TabsTrigger>
					<TabsTrigger value="hidden-subforums" className="gap-2">
						<EyeOff className="h-4 w-4" />
						Subforos ocultos
					</TabsTrigger>
				</TabsList>

				<TabsContent value="threads" className="mt-0">
					<ContentRulesView embedded />
				</TabsContent>
				<TabsContent value="words" className="mt-0">
					<MutedPostsView embedded />
				</TabsContent>
				<TabsContent value="users" className="mt-0">
					<UserFinder embedded />
				</TabsContent>
				<TabsContent value="hidden-threads" className="mt-0">
					<HiddenThreadsView embedded />
				</TabsContent>
				<TabsContent value="hidden-subforums" className="mt-0">
					<HiddenSubforumsView embedded />
				</TabsContent>
			</Tabs>

			<ConfirmDialog
				open={Boolean(pendingImport)}
				onOpenChange={open => {
					if (!open) setPendingImport(null)
				}}
				title="Importar filtros"
				description={
					pendingImport ? (
						<div className="space-y-2">
							<p>Se reemplazará solo la configuración de Filtros con este contenido:</p>
							<ul className="list-inside list-disc space-y-1">
								<li>{pendingImport.stats.contentRules} reglas de hilos</li>
								<li>{pendingImport.stats.mutedWords} palabras silenciadas</li>
								<li>{pendingImport.stats.users} usuarios personalizados/ignorados</li>
								<li>{pendingImport.stats.hiddenThreads} hilos ocultos</li>
								<li>{pendingImport.stats.hiddenSubforums} subforos ocultos</li>
							</ul>
							<p>No se tocarán borradores, plantillas, temas, favoritos ni el resto del dashboard.</p>
						</div>
					) : (
						'Se importarán los filtros del archivo seleccionado.'
					)
				}
				cancelText="Cancelar"
				confirmText="Importar filtros"
				variant="destructive"
				onConfirm={() => {
					void confirmImportFilters()
				}}
			/>
		</div>
	)
}
