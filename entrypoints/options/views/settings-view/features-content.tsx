/**
 * Features Content - Feature toggles
 */
import { useMemo, useState } from 'react'
import Film from 'lucide-react/dist/esm/icons/film'
import HomeIcon from 'lucide-react/dist/esm/icons/home'
import { logger } from '@/lib/logger'
import ImageIcon from 'lucide-react/dist/esm/icons/image-play'
import Pin from 'lucide-react/dist/esm/icons/pin'
import PanelTopOpen from 'lucide-react/dist/esm/icons/panel-top-open'
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
import CalendarClock from 'lucide-react/dist/esm/icons/calendar-clock'
import Check from 'lucide-react/dist/esm/icons/check'
import MousePointerClick from 'lucide-react/dist/esm/icons/mouse-pointer-click'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Wand2 from 'lucide-react/dist/esm/icons/wand-2'
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
import type { ItadCountry, RelatedThreadsDisplay } from '@/store/settings-types'
import { isHighlightedSetting, shouldShowAnySetting, shouldShowSetting, type SettingsContentFilter } from './constants'

const ITAD_COUNTRY_OPTIONS: Array<{ value: ItadCountry; label: string }> = [
	{ value: 'ES', label: 'Europa / España - EUR' },
	{ value: 'GB', label: 'Reino Unido - GBP' },
	{ value: 'US', label: 'Estados Unidos - USD' },
]

const MAX_AGE_MONTHS_LIMIT = 300

/** Digits only, capped at three characters, so the field cannot hold a number we would reject. */
function sanitizeMaxAgeDraft(raw: string): string {
	return raw.replace(/\D/g, '').slice(0, 3)
}

/** An empty field means "no limit", so 0 is never something the user has to type or decode. */
function parseMaxAgeDraft(draft: string): number {
	const months = Number.parseInt(draft, 10)
	return Number.isFinite(months) && months > 0 ? months : 0
}

/** Exact, not approximate: 20 months is 1 año y 8 meses, and saying "unos 1,7 años" just hedges. */
function formatMonthsAsYears(months: number): string {
	const years = Math.floor(months / 12)
	if (years === 0) return ''

	const yearPart = `${years} ${years === 1 ? 'año' : 'años'}`
	const restMonths = months % 12
	if (restMonths === 0) return yearPart
	return `${yearPart} y ${restMonths} ${restMonths === 1 ? 'mes' : 'meses'}`
}

/** Hint beside the months field: what the current draft would actually do. */
function describeMaxAgeDraft(draft: string): string {
	const months = parseMaxAgeDraft(draft)
	if (months === 0) return 'Sin límite: se muestran todos'

	const label = `${months} ${months === 1 ? 'mes' : 'meses'} sin actividad`
	const asYears = formatMonthsAsYears(months)
	return asYears ? `${label} · ${asYears}` : label
}

const NAVIGATION_SETTING_IDS = ['new-homepage', 'navbar-search']
const EDITOR_SETTING_IDS = ['cinema-button', 'game-button', 'gif-picker', 'drafts-button', 'template-button', 'auto-tags']
const CONTENT_SETTING_IDS = [
	'media-hover-cards',
	'steam-bundle-cards',
	'itad-search',
	'game-release-calendar',
	'movie-release-calendar',
	'thread-clipper',
	'content-rules',
	'classic-thread-actions',
	'pinned-posts',
	'thread-preview',
	'related-threads-display',
	'related-threads-max-age',
	'thread-summarizer',
	'post-summary',
	'save-thread',
	'hide-thread',
	'hide-ignored-user-threads',
]

export function FeaturesContent({ settingFilter }: { settingFilter?: SettingsContentFilter }) {
	const {
		setSetting,
		newHomepageEnabled,
		navbarSearchEnabled,
		cinemaButtonEnabled,
		gameButtonEnabled,
		gifPickerEnabled,
		draftsButtonEnabled,
		templateButtonEnabled,
		autoTagsEnabled,
		mediaHoverCardsEnabled,
		steamBundleInlineCardsEnabled,
		itadSubforumSearchJuegosEnabled,
		itadSubforumSearchHuchaEnabled,
		itadCountry,
		gameReleaseCalendarJuegosEnabled,
		gameReleaseCalendarJuegosMovilEnabled,
		movieReleaseCalendarCineEnabled,
		threadClipperSubforums,
		contentRulesEnabled,
		classicThreadActionsEnabled,
		pinnedPostsEnabled,
		threadPreviewEnabled,
		relatedThreadsDisplay,
		relatedThreadsMaxAgeMonths,
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
				| 'gameReleaseCalendarJuegosMovilEnabled'
				| 'movieReleaseCalendarCineEnabled'
				| 'contentRulesEnabled'
				| 'classicThreadActionsEnabled'
				| 'pinnedPostsEnabled'
				| 'threadPreviewEnabled'
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

	const handleRelatedThreadsDisplayChange = async (value: string) => {
		setSetting('relatedThreadsDisplay', value as RelatedThreadsDisplay)
		toast.success('Visualización de hilos relacionados actualizada', {
			description: 'Recargando pestañas de Mediavida...',
		})
		await new Promise(resolve => setTimeout(resolve, 300))
		await reloadMediavidaTabs()
	}

	// Typed into, not saved into: writing "20" would otherwise commit "2" first, with its own
	// toast and tab reload. The value is applied only when the user confirms.
	const [maxAgeDraft, setMaxAgeDraft] = useState(
		relatedThreadsMaxAgeMonths > 0 ? String(relatedThreadsMaxAgeMonths) : ''
	)
	const maxAgeDraftMonths = parseMaxAgeDraft(maxAgeDraft)
	const maxAgeExceedsLimit = maxAgeDraftMonths > MAX_AGE_MONTHS_LIMIT
	const maxAgeDirty = maxAgeDraftMonths !== relatedThreadsMaxAgeMonths && !maxAgeExceedsLimit

	const handleRelatedThreadsMaxAgeCommit = async () => {
		if (!maxAgeDirty) return

		setSetting('relatedThreadsMaxAgeMonths', maxAgeDraftMonths)
		setMaxAgeDraft(maxAgeDraftMonths > 0 ? String(maxAgeDraftMonths) : '')
		toast.success(
			maxAgeDraftMonths === 0
				? 'Se mostrarán todos los hilos relacionados'
				: `Se ocultarán los que lleven más de ${maxAgeDraftMonths} ${maxAgeDraftMonths === 1 ? 'mes' : 'meses'} sin actividad`,
			{ description: 'Recargando pestañas de Mediavida...' }
		)
		await new Promise(resolve => setTimeout(resolve, 300))
		await reloadMediavidaTabs()
	}

	const rowState = (settingId: string) => ({
		settingId,
		hidden: !shouldShowSetting(settingFilter, settingId),
		highlighted: isHighlightedSetting(settingFilter, settingId),
	})
	const showNavigationGroup = shouldShowAnySetting(settingFilter, NAVIGATION_SETTING_IDS)
	const showEditorGroup = shouldShowAnySetting(settingFilter, EDITOR_SETTING_IDS)
	const showContentGroup = shouldShowAnySetting(settingFilter, CONTENT_SETTING_IDS)

	return (
		<SettingsSection title="Funcionalidades" description="Activa o desactiva las características de la extensión.">
			{showNavigationGroup && (
				<>
					{/* Navigation Section */}
					<div className="space-y-1 mb-4">
						<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Navegación</h3>
						<p className="text-xs text-muted-foreground">Estos cambios requieren recargar las pestañas de Mediavida.</p>
					</div>

					<SettingRow
						{...rowState('new-homepage')}
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
						{...rowState('navbar-search')}
						icon={<Search className="h-4 w-4" />}
						label="Super Buscador en Navbar"
						description="Reemplaza el buscador nativo de Mediavida con el Super Buscador. Si lo desactivas, el buscador nativo se mostrará pero Ctrl+K seguirá funcionando."
					>
						<Switch checked={navbarSearchEnabled} onCheckedChange={withToastAndReload('navbarSearchEnabled', true)} />
					</SettingRow>
				</>
			)}

			{showNavigationGroup && showEditorGroup && <Separator className="my-6" />}

			{showEditorGroup && (
				<>
					{/* Editor Section */}
					<div className="space-y-1 mb-4">
						<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Editor</h3>
						<p className="text-xs text-muted-foreground">Estos cambios requieren recargar las pestañas de Mediavida.</p>
					</div>

			<SettingRow
				{...rowState('cinema-button')}
				icon={<Film className="h-4 w-4" />}
				label="Botón de plantillas multimedia"
				description="Añade un botón en el editor para buscar e insertar fichas de películas, series, anime y manga desde TMDB y AniList."
			>
				<Switch checked={cinemaButtonEnabled} onCheckedChange={withToastAndReload('cinemaButtonEnabled', true)} />
			</SettingRow>

			<SettingRow
				{...rowState('game-button')}
				icon={<Gamepad2 className="h-4 w-4" />}
				label="Botón de Videojuegos"
				description="Añade un botón en el editor para buscar e insertar fichas de videojuegos desde IGDB."
			>
				<Switch checked={gameButtonEnabled} onCheckedChange={withToastAndReload('gameButtonEnabled', true)} />
			</SettingRow>

			<SettingRow
				{...rowState('gif-picker')}
				icon={<ImageIcon className="h-4 w-4" />}
				label="Selector de GIFs"
				description="Permite buscar e insertar GIFs animados desde GIPHY directamente en el editor."
			>
				<Switch checked={gifPickerEnabled} onCheckedChange={withToastAndReload('gifPickerEnabled', true)} />
			</SettingRow>

			<SettingRow
				{...rowState('drafts-button')}
				icon={<FileText className="h-4 w-4" />}
				label="Botón de Borradores"
				description="Añade acceso rápido a tus borradores guardados en la barra de herramientas."
			>
				<Switch checked={draftsButtonEnabled} onCheckedChange={withToastAndReload('draftsButtonEnabled', true)} />
			</SettingRow>

			<SettingRow
				{...rowState('template-button')}
				icon={<Layout className="h-4 w-4" />}
				label="Insertar Plantilla"
				description="Añade un botón para insertar plantillas predefinidas o propias."
			>
				<Switch checked={templateButtonEnabled} onCheckedChange={withToastAndReload('templateButtonEnabled', true)} />
			</SettingRow>

			<SettingRow
				{...rowState('auto-tags')}
				icon={<Wand2 className="h-4 w-4" />}
				label="Auto-tags al pegar"
				description="Envuelve automáticamente las URLs de imágenes y vídeos pegadas en el editor con las etiquetas [img]/[media]. También disponible como atajo de teclado."
			>
				<Switch
					checked={autoTagsEnabled}
					onCheckedChange={checked => {
						setSetting('autoTagsEnabled', checked)
						toast.success(checked ? 'Auto-tags activados' : 'Auto-tags desactivados')
					}}
				/>
			</SettingRow>
				</>
			)}

			{(showNavigationGroup || showEditorGroup) && showContentGroup && <Separator className="my-6" />}

			{showContentGroup && (
				<>
					{/* Content Section */}
					<div className="space-y-1 mb-4">
						<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contenido</h3>
						<p className="text-xs text-muted-foreground">Estos cambios requieren recargar las pestañas de Mediavida.</p>
					</div>

			<SettingRow
				{...rowState('media-hover-cards')}
				icon={<Sparkles className="h-4 w-4" />}
				label="Hover Cards de Medios"
				description="Muestra tarjetas informativas al pasar el ratón sobre enlaces de TMDB o IMDb."
			>
				<Switch checked={mediaHoverCardsEnabled} onCheckedChange={withToastAndReload('mediaHoverCardsEnabled', true)} />
			</SettingRow>

			<SettingRow
				{...rowState('steam-bundle-cards')}
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
				{...rowState('itad-search')}
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
				{...rowState('game-release-calendar')}
				icon={<CalendarDays className="h-4 w-4" />}
				label="Próximos lanzamientos"
				description="Muestra próximos lanzamientos de videojuegos en los subforos Juegos y Juegos de móvil, y permite preparar hilos con plantilla IGDB."
			>
				<div className="grid gap-2 min-w-[190px]">
					<label className="flex items-center justify-between gap-3 text-sm font-medium">
						<span>Juegos</span>
						<Switch
							checked={gameReleaseCalendarJuegosEnabled}
							onCheckedChange={withToastAndReload('gameReleaseCalendarJuegosEnabled', true)}
						/>
					</label>
					<label className="flex items-center justify-between gap-3 text-sm font-medium">
						<span>Juegos de móvil</span>
						<Switch
							checked={gameReleaseCalendarJuegosMovilEnabled}
							onCheckedChange={withToastAndReload('gameReleaseCalendarJuegosMovilEnabled', true)}
						/>
					</label>
				</div>
			</SettingRow>

			<SettingRow
				{...rowState('movie-release-calendar')}
				icon={<Film className="h-4 w-4" />}
				label="Próximos estrenos"
				description="Muestra próximos estrenos de películas en España en el subforo Cine usando TMDB."
			>
				<Switch
					checked={movieReleaseCalendarCineEnabled}
					onCheckedChange={withToastAndReload('movieReleaseCalendarCineEnabled', true)}
				/>
			</SettingRow>

			<SettingRow
				{...rowState('thread-clipper')}
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
				{...rowState('content-rules')}
				icon={<List className="h-4 w-4" />}
				label="Reglas de hilos"
				description="Permite ocultar o destacar hilos automaticamente en listados segun titulo, autor y subforo."
			>
				<Switch checked={contentRulesEnabled} onCheckedChange={withToastAndReload('contentRulesEnabled', false)} />
			</SettingRow>

			<SettingRow
				{...rowState('classic-thread-actions')}
				icon={<MousePointerClick className="h-4 w-4" />}
				label="Mostrar acciones rápidas clásicas en los hilos"
				description="Muestra botones visibles de guardar/ocultar en lugar del menú compacto."
			>
				<Switch
					checked={classicThreadActionsEnabled}
					onCheckedChange={withToastAndReload('classicThreadActionsEnabled', true)}
				/>
			</SettingRow>

			<SettingRow
				{...rowState('pinned-posts')}
				icon={<Pin className="h-4 w-4" />}
				label="Posts Anclados"
				description="Permite anclar posts importantes y verlos en un panel lateral."
			>
				<Switch checked={pinnedPostsEnabled} onCheckedChange={withToastAndReload('pinnedPostsEnabled', true)} />
			</SettingRow>

			<SettingRow
				{...rowState('thread-preview')}
				icon={<PanelTopOpen className="h-4 w-4" />}
				label="Vista previa del primer post"
				description="Añade un botón en el Spy y en los listados de subforos para leer el OP sin salir de la página."
			>
				<Switch checked={threadPreviewEnabled} onCheckedChange={withToastAndReload('threadPreviewEnabled', true)} />
			</SettingRow>

			<SettingRow
				{...rowState('related-threads-display')}
				icon={<List className="h-4 w-4" />}
				label="Hilos relacionados"
				description="Elige si la sección del final de los hilos se oculta, aparece plegada o conserva la vista original de Mediavida."
			>
				<Select value={relatedThreadsDisplay} onValueChange={handleRelatedThreadsDisplayChange}>
					<SelectTrigger
						className="w-[220px] max-w-full"
						aria-label="Visualización de hilos relacionados"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="hidden">Ocultos</SelectItem>
						<SelectItem value="collapsible">Desplegable</SelectItem>
						<SelectItem value="original">Vista original de Mediavida</SelectItem>
					</SelectContent>
				</Select>
			</SettingRow>

			<SettingRow
				{...rowState('related-threads-max-age')}
				icon={<CalendarClock className="h-4 w-4" />}
				label="Antigüedad máxima de los hilos relacionados"
				description="Oculta los hilos cuyo último mensaje sea más antiguo. Se mide desde la última respuesta, no desde que se creó el hilo. Déjalo en 0 para no filtrar nada."
			>
				<div className="flex flex-col items-end gap-1.5">
					<div className="flex items-center gap-2">
						<Input
							type="number"
							min={1}
							max={MAX_AGE_MONTHS_LIMIT}
							step={1}
							value={maxAgeDraft}
							placeholder="Sin límite"
							disabled={relatedThreadsDisplay === 'hidden'}
							onChange={event => setMaxAgeDraft(sanitizeMaxAgeDraft(event.target.value))}
							onKeyDown={event => {
								if (event.key === 'Enter') {
									event.preventDefault()
									void handleRelatedThreadsMaxAgeCommit()
								}
							}}
							className="w-[110px]"
							aria-label="Antigüedad máxima en meses de los hilos relacionados. Vacío = sin límite"
						/>
						{/* The unit stays visible: a bare number box does not say months, days or years. */}
						<span className="text-sm text-muted-foreground">meses</span>
						<Button
							size="icon-sm"
							variant={maxAgeDirty ? 'default' : 'ghost'}
							disabled={!maxAgeDirty || relatedThreadsDisplay === 'hidden'}
							onClick={() => void handleRelatedThreadsMaxAgeCommit()}
							title={maxAgeExceedsLimit ? `El máximo es ${MAX_AGE_MONTHS_LIMIT} meses` : maxAgeDirty ? 'Aplicar' : 'Ya aplicado'}
							aria-label="Aplicar la antigüedad máxima"
						>
							<Check className="h-4 w-4" />
						</Button>
					</div>
					{maxAgeExceedsLimit ? (
						<span role="alert" className="text-xs font-medium text-destructive">
							Máximo {MAX_AGE_MONTHS_LIMIT} meses ({formatMonthsAsYears(MAX_AGE_MONTHS_LIMIT)})
						</span>
					) : (
						<span className="text-xs text-muted-foreground/80">
							{describeMaxAgeDraft(maxAgeDraft)}
							{maxAgeDirty && <span className="ml-1 text-primary">· sin aplicar</span>}
						</span>
					)}
				</div>
			</SettingRow>

			<SettingRow
				{...rowState('thread-summarizer')}
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
				{...rowState('post-summary')}
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
				{...rowState('save-thread')}
				icon={<FolderHeart className="h-4 w-4" />}
				label="Guardar Hilo"
				description="Muestra botones de guardar en listados y noticias. El botón de guardar dentro del hilo y el click derecho siempre están activos."
			>
				<Switch checked={saveThreadEnabled} onCheckedChange={withToastAndReload('saveThreadEnabled', true)} />
			</SettingRow>

			<SettingRow
				{...rowState('hide-thread')}
				icon={<EyeOff className="h-4 w-4" />}
				label="Ocultar Hilos"
				description="Muestra botones para ocultar hilos en listados. La opción de ocultar con click derecho siempre está activa."
			>
				<Switch checked={hideThreadEnabled} onCheckedChange={withToastAndReload('hideThreadEnabled', true)} />
			</SettingRow>

			<SettingRow
				{...rowState('hide-ignored-user-threads')}
				icon={<EyeOff className="h-4 w-4" />}
				label="Ocultar Hilos de Ignorados"
				description="Oculta automáticamente hilos creados por usuarios ignorados en modo ocultar solo en los listados clásicos de subforos, porque ahí Mediavida sí muestra quién creó el hilo. No se aplica en Spy ni en la home premium, ya que en esos listados ese dato no aparece."
			>
				<Switch
					checked={hideIgnoredUserThreadsEnabled}
					onCheckedChange={withToastAndReload('hideIgnoredUserThreadsEnabled', true)}
				/>
			</SettingRow>
				</>
			)}
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
