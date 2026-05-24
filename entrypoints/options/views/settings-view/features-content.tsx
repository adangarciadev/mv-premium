/**
 * Features Content - Feature toggles
 */
import { useMemo, useState } from 'react'
import Film from 'lucide-react/dist/esm/icons/film'
import HomeIcon from 'lucide-react/dist/esm/icons/home'
import { logger } from '@/lib/logger'
import ImageIcon from 'lucide-react/dist/esm/icons/image-play'
import Pin from 'lucide-react/dist/esm/icons/pin'
import Bot from 'lucide-react/dist/esm/icons/bot'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Layout from 'lucide-react/dist/esm/icons/layout'
import List from 'lucide-react/dist/esm/icons/list'
import FolderHeart from 'lucide-react/dist/esm/icons/folder-heart'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import Search from 'lucide-react/dist/esm/icons/search'
import Gamepad2 from 'lucide-react/dist/esm/icons/gamepad-2'
import Package from 'lucide-react/dist/esm/icons/package'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Store from 'lucide-react/dist/esm/icons/store'
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days'
import MousePointerClick from 'lucide-react/dist/esm/icons/mouse-pointer-click'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import { browser } from 'wxt/browser'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NativeFidIcon } from '@/components/native-fid-icon'
import { SettingsSection } from '../../components/settings/settings-section'
import { SettingRow } from '../../components/settings'
import { sendMessage } from '@/lib/messaging'
import { ALL_SUBFORUMS, VALID_SUBFORUM_SLUGS } from '@/lib/subforums'
import { useSettingsStore } from '@/store/settings-store'
import type { ItadCountry } from '@/store/settings-types'

const ITAD_COUNTRY_OPTIONS: Array<{ value: ItadCountry; label: string }> = [
	{ value: 'ES', label: 'Europa / España - EUR' },
	{ value: 'GB', label: 'Reino Unido - GBP' },
	{ value: 'US', label: 'Estados Unidos - USD' },
]

export function FeaturesContent() {
	const {
		setSetting,
		newHomepageEnabled,
		navbarSearchEnabled,
		cinemaButtonEnabled,
		gameButtonEnabled,
		gifPickerEnabled,
		draftsButtonEnabled,
		templateButtonEnabled,
		mediaHoverCardsEnabled,
		steamBundleInlineCardsEnabled,
		itadSubforumSearchJuegosEnabled,
		itadSubforumSearchHuchaEnabled,
		itadCountry,
		gameReleaseCalendarJuegosEnabled,
		threadClipperSubforums,
		pinnedPostsEnabled,
		threadSummarizerEnabled,
		postSummaryEnabled,
		saveThreadEnabled,
		hideThreadEnabled,
		hideIgnoredUserThreadsEnabled,
	} = useSettingsStore()

	const reloadMediavidaTabs = async () => {
		try {
			const tabs = await browser.tabs.query({ url: '*://*.mediavida.com/*' })
			for (const tab of tabs) {
				if (tab.id) {
					browser.tabs.reload(tab.id)
				}
			}
		} catch (error) {
			logger.warn('Could not reload tabs:', error)
		}
	}

	// Helper to show toast on change and reload tabs that require it
	const withToastAndReload =
		(
			key:
				| 'newHomepageEnabled'
				| 'navbarSearchEnabled'
				| 'cinemaButtonEnabled'
				| 'gameButtonEnabled'
				| 'gifPickerEnabled'
				| 'draftsButtonEnabled'
				| 'templateButtonEnabled'
				| 'mediaHoverCardsEnabled'
				| 'steamBundleInlineCardsEnabled'
				| 'itadSubforumSearchJuegosEnabled'
				| 'itadSubforumSearchHuchaEnabled'
				| 'gameReleaseCalendarJuegosEnabled'
				| 'pinnedPostsEnabled'
				| 'threadSummarizerEnabled'
				| 'postSummaryEnabled'
				| 'saveThreadEnabled'
				| 'hideThreadEnabled'
				| 'hideIgnoredUserThreadsEnabled',
			requiresReload: boolean = false
		) =>
		async (val: boolean) => {
			setSetting(key, val)

			if (requiresReload) {
				toast.success(val ? 'Funcionalidad activada' : 'Funcionalidad desactivada', {
					description: 'Recargando pestañas de Mediavida...',
				})
				// Small delay to allow storage to sync
				await new Promise(resolve => setTimeout(resolve, 300))
				await reloadMediavidaTabs()
			} else {
				toast.success(val ? 'Funcionalidad activada' : 'Funcionalidad desactivada')
			}
		}

	const handleThreadClipperSubforumsChange = async (subforums: string[]) => {
		const uniqueSubforums = subforums.filter(
			(slug, index, values) => VALID_SUBFORUM_SLUGS.has(slug) && values.indexOf(slug) === index
		)
		setSetting('threadClipperSubforums', uniqueSubforums)

		try {
			await sendMessage('refreshContextMenus', { threadClipperSubforums: uniqueSubforums })
			toast.success(
				uniqueSubforums.length > 0
					? 'Subforos del recortador actualizados'
					: 'Recortador de hilos desactivado'
			)
		} catch (error) {
			logger.warn('Could not refresh context menus:', error)
			toast.error('No se pudo actualizar el menú contextual')
		}
	}

	const handleItadCountryChange = async (value: string) => {
		setSetting('itadCountry', value as ItadCountry)
		toast.success('Región de precios actualizada', {
			description: 'La moneda final depende de los datos que devuelva IsThereAnyDeal.',
		})
	}

	return (
		<SettingsSection title="Funcionalidades" description="Activa o desactiva las características de la extensión.">
			{/* Navigation Section */}
			<div className="space-y-1 mb-4">
				<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Navegación</h3>
				<p className="text-xs text-muted-foreground">Estos cambios requieren recargar las pestañas de Mediavida.</p>
			</div>

			<SettingRow
				icon={<HomeIcon className="h-4 w-4" />}
				label="Homepage de MV Premium"
				description={
					<div className="space-y-2 pr-1">
						<p className="m-0 leading-relaxed">
							Reemplaza la portada nativa por una homepage personalizada de MV Premium con noticias y actividad del foro.
						</p>
						<div className="rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5">
							<p className="m-0 text-[11px] leading-snug font-medium text-foreground/90">
								Todos los créditos del diseño visual original de esta homepage pertenecen a MV-Ignited.
							</p>
							<a
								href="https://www.mediavida.com/foro/dev/mv-ignited-2024-tampoco-me-dejo-mediavida-extension-709386"
								target="_blank"
								rel="noopener noreferrer"
								className="mt-1 inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15 hover:underline"
							>
								Ver MV-Ignited (diseño original)
								<ExternalLink className="h-3 w-3" />
							</a>
						</div>
					</div>
				}
			>
				<Switch checked={newHomepageEnabled} onCheckedChange={withToastAndReload('newHomepageEnabled', true)} />
			</SettingRow>

			<SettingRow
				icon={<Search className="h-4 w-4" />}
				label="Super Buscador en Navbar"
				description="Reemplaza el buscador nativo de Mediavida con el Super Buscador. Si lo desactivas, el buscador nativo se mostrará pero Ctrl+K seguirá funcionando."
			>
				<Switch checked={navbarSearchEnabled} onCheckedChange={withToastAndReload('navbarSearchEnabled', true)} />
			</SettingRow>

			<Separator className="my-6" />

			{/* Editor Section */}
			<div className="space-y-1 mb-4">
				<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Editor</h3>
				<p className="text-xs text-muted-foreground">Estos cambios requieren recargar las pestañas de Mediavida.</p>
			</div>

			<SettingRow
				icon={<Film className="h-4 w-4" />}
				label="Botón de Cine"
				description="Añade un botón en el editor para buscar e insertar fichas de películas y series desde TMDB."
			>
				<Switch checked={cinemaButtonEnabled} onCheckedChange={withToastAndReload('cinemaButtonEnabled', true)} />
			</SettingRow>

			<SettingRow
				icon={<Gamepad2 className="h-4 w-4" />}
				label="Botón de Videojuegos"
				description="Añade un botón en el editor para buscar e insertar fichas de videojuegos desde IGDB."
			>
				<Switch checked={gameButtonEnabled} onCheckedChange={withToastAndReload('gameButtonEnabled', true)} />
			</SettingRow>

			<SettingRow
				icon={<ImageIcon className="h-4 w-4" />}
				label="Selector de GIFs"
				description="Permite buscar e insertar GIFs animados desde GIPHY directamente en el editor."
			>
				<Switch checked={gifPickerEnabled} onCheckedChange={withToastAndReload('gifPickerEnabled', true)} />
			</SettingRow>

			<SettingRow
				icon={<FileText className="h-4 w-4" />}
				label="Botón de Borradores"
				description="Añade acceso rápido a tus borradores guardados en la barra de herramientas."
			>
				<Switch checked={draftsButtonEnabled} onCheckedChange={withToastAndReload('draftsButtonEnabled', true)} />
			</SettingRow>

			<SettingRow
				icon={<Layout className="h-4 w-4" />}
				label="Insertar Plantilla"
				description="Añade un botón para insertar plantillas predefinidas o propias."
			>
				<Switch checked={templateButtonEnabled} onCheckedChange={withToastAndReload('templateButtonEnabled', true)} />
			</SettingRow>

			<Separator className="my-6" />

			{/* Content Section */}
			<div className="space-y-1 mb-4">
				<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contenido</h3>
				<p className="text-xs text-muted-foreground">Estos cambios requieren recargar las pestañas de Mediavida.</p>
			</div>

			<SettingRow
				icon={<Sparkles className="h-4 w-4" />}
				label="Hover Cards de Medios"
				description="Muestra tarjetas informativas al pasar el ratón sobre enlaces de TMDB o IMDb."
			>
				<Switch checked={mediaHoverCardsEnabled} onCheckedChange={withToastAndReload('mediaHoverCardsEnabled', true)} />
			</SettingRow>

			<SettingRow
				icon={<Package className="h-4 w-4" />}
				label="Cards de Bundles de Steam"
				description="Muestra tarjetas inline para enlaces de bundles de Steam en editores y vistas previas. No afecta a las cards de juegos individuales."
			>
				<Switch
					checked={steamBundleInlineCardsEnabled}
					onCheckedChange={withToastAndReload('steamBundleInlineCardsEnabled', true)}
				/>
			</SettingRow>

			<SettingRow
				icon={<Store className="h-4 w-4" />}
				label="Buscador de ofertas"
				description={
					<div className="space-y-2 pr-1">
						<p className="m-0 leading-relaxed">
							Muestra un buscador premium en Juegos y Club de la hucha para encontrar precios actuales, tiendas disponibles,
							descuentos y mínimos históricos.
						</p>
						<div className="rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5">
							<p className="m-0 text-[11px] leading-snug text-muted-foreground">
								La información sale de IsThereAnyDeal: MV Premium consulta su API desde el background de la extensión,
								pide precios para la región elegida y cachea temporalmente las respuestas para evitar peticiones innecesarias.
							</p>
							<p className="m-0 mt-1 text-[11px] leading-snug text-muted-foreground">
								MV Premium no convierte divisas. La moneda y los importes dependen de la cobertura de ITAD y de cada tienda:
								si no hay precio regional, ITAD puede convertirlo o usar una región de referencia.
							</p>
							<p className="m-0 mt-1 text-[11px] leading-snug text-muted-foreground">
								Para euros usamos España como referencia europea para evitar mostrar varias regiones con la misma moneda.
							</p>
							<a
								href="https://isthereanydeal.com/status/"
								target="_blank"
								rel="noopener noreferrer"
								className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
							>
								Ver cobertura de regiones y monedas en ITAD
								<ExternalLink className="h-3 w-3" />
							</a>
						</div>
					</div>
				}
			>
				<div className="grid gap-2 min-w-[190px]">
					<div className="grid gap-1.5">
						<span className="text-xs font-semibold text-muted-foreground">Región de precios</span>
						<Select value={itadCountry} onValueChange={handleItadCountryChange}>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ITAD_COUNTRY_OPTIONS.map(option => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<label className="flex items-center justify-between gap-3 text-sm font-medium">
						<span>Juegos</span>
						<Switch
							checked={itadSubforumSearchJuegosEnabled}
							onCheckedChange={withToastAndReload('itadSubforumSearchJuegosEnabled', true)}
						/>
					</label>
					<label className="flex items-center justify-between gap-3 text-sm font-medium">
						<span>Club de la hucha</span>
						<Switch
							checked={itadSubforumSearchHuchaEnabled}
							onCheckedChange={withToastAndReload('itadSubforumSearchHuchaEnabled', true)}
						/>
					</label>
				</div>
			</SettingRow>

			<SettingRow
				icon={<CalendarDays className="h-4 w-4" />}
				label="Próximos lanzamientos"
				description="Muestra próximos lanzamientos de videojuegos en el subforo Juegos y permite preparar hilos con plantilla IGDB."
			>
				<Switch
					checked={gameReleaseCalendarJuegosEnabled}
					onCheckedChange={withToastAndReload('gameReleaseCalendarJuegosEnabled', true)}
				/>
			</SettingRow>

			<SettingRow
				icon={<MousePointerClick className="h-4 w-4" />}
				label="Crear hilo desde cualquier web"
				description="Abre un recortador para noticias externas: añade texto seleccionado y embeds de YouTube, tweets o Instagram. No captura imágenes ni usa páginas directas de redes."
			>
				<ThreadClipperSubforumSettings
					value={threadClipperSubforums}
					onChange={handleThreadClipperSubforumsChange}
				/>
			</SettingRow>

			<SettingRow
				icon={<Pin className="h-4 w-4" />}
				label="Posts Anclados"
				description="Permite anclar posts importantes y verlos en un panel lateral."
			>
				<Switch checked={pinnedPostsEnabled} onCheckedChange={withToastAndReload('pinnedPostsEnabled', true)} />
			</SettingRow>

			<SettingRow
				icon={<Bot className="h-4 w-4" />}
				label="Resumidor de Hilos (IA)"
				description={
					<span>
						Permite resúmenes de 1 página con el botón de resumir o hasta 30 páginas con el botón de Resumir+.{' '}
						<span className="text-destructive font-bold block mt-1">
							⚠️ Requiere configurar una API Key de Gemini
						</span>
					</span>
				}
			>
				<Switch
					checked={threadSummarizerEnabled}
					onCheckedChange={withToastAndReload('threadSummarizerEnabled', true)}
				/>
			</SettingRow>

			<SettingRow
				icon={<List className="h-4 w-4" />}
				label="Resumen de Post (IA)"
        				description={
					<span>
						Permite resumir posts individuales muy largos con un solo clic.{' '}
						<span className="text-destructive font-bold block mt-1">
							⚠️ Requiere configurar una API Key de Gemini
						</span>
					</span>
				}
			>
				<Switch checked={postSummaryEnabled} onCheckedChange={withToastAndReload('postSummaryEnabled', true)} />
			</SettingRow>

			<SettingRow
				icon={<FolderHeart className="h-4 w-4" />}
				label="Guardar Hilo"
				description="Muestra botones de guardar en listados y noticias. El botón de guardar dentro del hilo y el click derecho siempre están activos."
			>
				<Switch checked={saveThreadEnabled} onCheckedChange={withToastAndReload('saveThreadEnabled', true)} />
			</SettingRow>

			<SettingRow
				icon={<EyeOff className="h-4 w-4" />}
				label="Ocultar Hilos"
				description="Muestra botones para ocultar hilos en listados. La opción de ocultar con click derecho siempre está activa."
			>
				<Switch checked={hideThreadEnabled} onCheckedChange={withToastAndReload('hideThreadEnabled', true)} />
			</SettingRow>

			<SettingRow
				icon={<EyeOff className="h-4 w-4" />}
				label="Ocultar Hilos de Ignorados"
				description="Oculta automáticamente hilos creados por usuarios ignorados en modo ocultar solo en los listados clásicos de subforos, porque ahí Mediavida sí muestra quién creó el hilo. No se aplica en Spy ni en la home premium, ya que en esos listados ese dato no aparece."
			>
				<Switch
					checked={hideIgnoredUserThreadsEnabled}
					onCheckedChange={withToastAndReload('hideIgnoredUserThreadsEnabled', true)}
				/>
			</SettingRow>
		</SettingsSection>
	)
}

interface ThreadClipperSubforumSettingsProps {
	value: string[]
	onChange: (subforums: string[]) => void | Promise<void>
}

function ThreadClipperSubforumSettings({
	value,
	onChange,
}: ThreadClipperSubforumSettingsProps) {
	const [filter, setFilter] = useState('')
	const selectedSubforums = value.filter((slug, index, values) => VALID_SUBFORUM_SLUGS.has(slug) && values.indexOf(slug) === index)
	const normalizedFilter = filter.trim().toLowerCase()
	const visibleSubforums = useMemo(
		() =>
			normalizedFilter
				? ALL_SUBFORUMS.filter(
						subforum =>
							subforum.name.toLowerCase().includes(normalizedFilter) ||
							subforum.slug.toLowerCase().includes(normalizedFilter)
				  )
				: ALL_SUBFORUMS,
		[normalizedFilter]
	)

	const clearSubforums = () => {
		void onChange([])
	}

	const toggleSubforum = (slug: string, checked: boolean) => {
		if (checked) {
			void onChange([...selectedSubforums, slug])
			return
		}
		void onChange(selectedSubforums.filter(current => current !== slug))
	}

	return (
		<div className="grid w-[590px] max-w-full gap-3 rounded-lg border border-border/70 bg-card/35 p-3">
			<div className="flex items-center justify-between gap-3">
				<Badge variant="outline" className="h-6 rounded-md border-border/70 bg-muted/40">
					{selectedSubforums.length > 0
						? `${selectedSubforums.length} subforo${selectedSubforums.length === 1 ? '' : 's'} activo${selectedSubforums.length === 1 ? '' : 's'}`
						: 'Menú desactivado'}
				</Badge>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-7 gap-1.5 px-2 text-muted-foreground"
					onClick={clearSubforums}
					disabled={selectedSubforums.length === 0}
				>
					<Trash2 className="h-3.5 w-3.5" />
					Quitar todos
				</Button>
			</div>

			<div className="relative">
				<Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
				<Input
					value={filter}
					onChange={event => setFilter(event.target.value)}
					placeholder="Filtrar subforos"
					className="h-8 pl-8 text-sm"
				/>
			</div>

			<div className="scrollbar-thin grid h-[220px] grid-cols-1 content-start gap-1.5 overflow-y-auto rounded-md border border-border/60 bg-muted/15 p-2 sm:grid-cols-2">
				{visibleSubforums.map(subforum => {
					const checked = selectedSubforums.includes(subforum.slug)
					return (
						<label
							key={subforum.slug}
							className="group flex min-w-0 cursor-pointer items-center gap-2 rounded-md border border-transparent px-2.5 py-2 text-sm transition-colors hover:border-border/70 hover:bg-muted/35 has-[[data-state=checked]]:border-primary/35 has-[[data-state=checked]]:bg-primary/10"
						>
							<Checkbox
								checked={checked}
								onCheckedChange={nextChecked => toggleSubforum(subforum.slug, nextChecked === true)}
								aria-label={`Incluir ${subforum.name} en el recortador`}
							/>
							<NativeFidIcon iconId={subforum.iconId} className="h-4 w-4 shrink-0" />
							<span className="truncate font-medium text-foreground">{subforum.name}</span>
						</label>
					)
				})}
				{visibleSubforums.length === 0 && (
					<div className="col-span-full px-2 py-6 text-center text-sm text-muted-foreground">
						No hay subforos que coincidan
					</div>
				)}
			</div>
		</div>
	)
}
