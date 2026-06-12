/**
 * Settings View - Constants and helpers
 */
import Plug from 'lucide-react/dist/esm/icons/plug'
import ScrollText from 'lucide-react/dist/esm/icons/scroll-text'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square'
import Wrench from 'lucide-react/dist/esm/icons/wrench'
import ToggleRight from 'lucide-react/dist/esm/icons/toggle-right'
import Keyboard from 'lucide-react/dist/esm/icons/keyboard'
import type { Settings, SettingsKey } from '@/store/settings-types'

export const SETTINGS_CATEGORIES = [
	{ id: 'integrations', label: 'Integraciones', icon: Plug },
	{ id: 'features', label: 'Funcionalidades', icon: ToggleRight },
	{ id: 'navigation', label: 'Navegación', icon: ScrollText },
	{ id: 'content', label: 'Contenido', icon: MessageSquare },
	{ id: 'shortcuts', label: 'Atajos de Teclado', icon: Keyboard },
	{ id: 'advanced', label: 'Avanzado', icon: Wrench },
] as const

export type CategoryId = (typeof SETTINGS_CATEGORIES)[number]['id']

export type SettingsQuickFilter = 'all' | 'enabled' | 'disabled' | 'reload' | 'needs-setup'

export interface SettingSearchItem {
	id: string
	category: CategoryId
	section?: string
	label: string
	description: string
	keywords: string[]
	settingKeys?: SettingsKey[]
	requiresReload?: boolean
	setupKey?: SettingsKey
	setupLabel?: string
	isEnabled?: (settings: Settings) => boolean | null
}

export interface SettingsContentFilter {
	visibleSettingIds: Set<string> | null
	highlightedSettingId: string | null
}

export const SETTINGS_SEARCH_INDEX: SettingSearchItem[] = [
	{
		id: 'imgbb-api-key',
		category: 'integrations',
		section: 'Servicios externos',
		label: 'Alojamiento de Imágenes',
		description: 'Configura ImgBB o usa freeimage.host como servicio base para subir imágenes.',
		keywords: ['imagenes', 'imgbb', 'freeimage', 'upload', 'hosting', 'api key'],
		settingKeys: ['imgbbApiKey'],
		isEnabled: settings => Boolean(settings.imgbbApiKey),
	},
	{
		id: 'gemini-api-key',
		category: 'integrations',
		section: 'Inteligencia Artificial',
		label: 'Google Gemini API',
		description: 'Configura la API key de Gemini para usar resumen de hilos y posts con IA.',
		keywords: ['gemini', 'google', 'ia', 'api key', 'resumen', 'resumidor'],
		settingKeys: ['geminiApiKey'],
		isEnabled: settings => Boolean(settings.geminiApiKey),
	},
	{
		id: 'gemini-model',
		category: 'integrations',
		section: 'Inteligencia Artificial',
		label: 'Modelo Gemini',
		description: 'Elige el modelo de Google que usa MV Premium para resumir e IA.',
		keywords: ['modelo', 'gemini', 'google', 'ia', 'flash'],
		settingKeys: ['aiModel'],
	},
	{
		id: 'new-homepage',
		category: 'features',
		section: 'Navegación',
		label: 'Homepage de MV Premium',
		description: 'Reemplaza la portada nativa por una homepage personalizada de MV Premium.',
		keywords: ['home', 'homepage', 'portada', 'inicio', 'mv ignited'],
		settingKeys: ['newHomepageEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.newHomepageEnabled,
	},
	{
		id: 'navbar-search',
		category: 'features',
		section: 'Navegación',
		label: 'Super Buscador en Navbar',
		description: 'Reemplaza el buscador nativo de Mediavida con el Super Buscador.',
		keywords: ['buscador', 'navbar', 'buscar', 'ctrl k', 'super buscador'],
		settingKeys: ['navbarSearchEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.navbarSearchEnabled,
	},
	{
		id: 'cinema-button',
		category: 'features',
		section: 'Editor',
		label: 'Botón de plantillas multimedia',
		description: 'Añade un botón en el editor para buscar e insertar fichas de películas, series, anime y manga.',
		keywords: ['cine', 'peliculas', 'series', 'anime', 'manga', 'tmdb', 'anilist', 'editor'],
		settingKeys: ['cinemaButtonEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.cinemaButtonEnabled,
	},
	{
		id: 'game-button',
		category: 'features',
		section: 'Editor',
		label: 'Botón de Videojuegos',
		description: 'Añade un botón en el editor para buscar e insertar fichas de videojuegos desde IGDB.',
		keywords: ['videojuegos', 'juegos', 'igdb', 'editor'],
		settingKeys: ['gameButtonEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.gameButtonEnabled,
	},
	{
		id: 'gif-picker',
		category: 'features',
		section: 'Editor',
		label: 'Selector de GIFs',
		description: 'Permite buscar e insertar GIFs animados desde GIPHY directamente en el editor.',
		keywords: ['gif', 'giphy', 'animado', 'editor'],
		settingKeys: ['gifPickerEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.gifPickerEnabled,
	},
	{
		id: 'drafts-button',
		category: 'features',
		section: 'Editor',
		label: 'Botón de Borradores',
		description: 'Añade acceso rápido a tus borradores guardados en la barra de herramientas.',
		keywords: ['borradores', 'drafts', 'editor', 'toolbar'],
		settingKeys: ['draftsButtonEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.draftsButtonEnabled,
	},
	{
		id: 'template-button',
		category: 'features',
		section: 'Editor',
		label: 'Insertar Plantilla',
		description: 'Añade un botón para insertar plantillas predefinidas o propias.',
		keywords: ['plantillas', 'templates', 'editor'],
		settingKeys: ['templateButtonEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.templateButtonEnabled,
	},
	{
		id: 'media-hover-cards',
		category: 'features',
		section: 'Contenido',
		label: 'Hover Cards de Medios',
		description: 'Muestra tarjetas informativas al pasar el ratón sobre enlaces de TMDB o IMDb.',
		keywords: ['hover cards', 'tmdb', 'imdb', 'medios', 'peliculas', 'series'],
		settingKeys: ['mediaHoverCardsEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.mediaHoverCardsEnabled,
	},
	{
		id: 'steam-bundle-cards',
		category: 'features',
		section: 'Contenido',
		label: 'Cards de Bundles de Steam',
		description: 'Muestra tarjetas inline para enlaces de bundles de Steam en editores y vistas previas.',
		keywords: ['steam', 'bundle', 'bundles', 'cards', 'juegos'],
		settingKeys: ['steamBundleInlineCardsEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.steamBundleInlineCardsEnabled,
	},
	{
		id: 'itad-search',
		category: 'features',
		section: 'Juegos',
		label: 'Buscador de ofertas',
		description: 'Busca precios, tiendas, descuentos y mínimos históricos con IsThereAnyDeal.',
		keywords: ['itad', 'isthereanydeal', 'ofertas', 'precios', 'hucha', 'juegos', 'tiendas'],
		settingKeys: ['itadSubforumSearchJuegosEnabled', 'itadSubforumSearchHuchaEnabled', 'itadCountry'],
		requiresReload: true,
		isEnabled: settings => settings.itadSubforumSearchJuegosEnabled || settings.itadSubforumSearchHuchaEnabled,
	},
	{
		id: 'game-release-calendar',
		category: 'features',
		section: 'Juegos',
		label: 'Próximos lanzamientos',
		description: 'Muestra próximos lanzamientos de videojuegos en los subforos Juegos y Juegos de móvil.',
		keywords: ['lanzamientos', 'calendario', 'juegos', 'igdb', 'videojuegos', 'movil', 'android', 'ios'],
		settingKeys: ['gameReleaseCalendarJuegosEnabled', 'gameReleaseCalendarJuegosMovilEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.gameReleaseCalendarJuegosEnabled || settings.gameReleaseCalendarJuegosMovilEnabled,
	},
	{
		id: 'movie-release-calendar',
		category: 'features',
		section: 'Cine',
		label: 'Próximos estrenos',
		description: 'Muestra próximos estrenos de películas en España en el subforo Cine.',
		keywords: ['estrenos', 'calendario', 'cine', 'tmdb', 'peliculas', 'españa'],
		settingKeys: ['movieReleaseCalendarCineEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.movieReleaseCalendarCineEnabled,
	},
	{
		id: 'thread-clipper',
		category: 'features',
		section: 'Hilos',
		label: 'Crear hilo desde cualquier web',
		description: 'Abre un recortador para noticias externas desde el menú contextual.',
		keywords: ['recortador', 'clipper', 'hilo', 'contextual', 'noticias', 'youtube', 'tweets'],
		settingKeys: ['threadClipperSubforums'],
		isEnabled: settings => settings.threadClipperSubforums.length > 0,
	},
	{
		id: 'pinned-posts',
		category: 'features',
		section: 'Hilos',
		label: 'Posts Anclados',
		description: 'Permite anclar posts importantes y verlos en un panel lateral.',
		keywords: ['posts', 'anclados', 'pin', 'panel'],
		settingKeys: ['pinnedPostsEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.pinnedPostsEnabled,
	},
	{
		id: 'thread-preview',
		category: 'features',
		section: 'Hilos',
		label: 'Vista previa del primer post',
		description: 'Lee el primer post desde Spy y listados de subforos sin salir de la página.',
		keywords: ['vista previa', 'preview', 'op', 'primer post', 'spy', 'subforos'],
		settingKeys: ['threadPreviewEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.threadPreviewEnabled,
	},
	{
		id: 'content-rules',
		category: 'features',
		section: 'Hilos',
		label: 'Reglas de hilos',
		description: 'Oculta o destaca hilos automáticamente según título, autor y subforo.',
		keywords: ['reglas', 'filtros', 'ocultar', 'destacar', 'hilos'],
		settingKeys: ['contentRulesEnabled'],
		isEnabled: settings => settings.contentRulesEnabled,
	},
	{
		id: 'classic-thread-actions',
		category: 'features',
		section: 'Hilos',
		label: 'Acciones rápidas clásicas',
		description: 'Muestra botones visibles de guardar/ocultar en lugar del menú compacto.',
		keywords: ['acciones', 'clasicas', 'botones', 'guardar', 'ocultar', 'menu compacto'],
		settingKeys: ['classicThreadActionsEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.classicThreadActionsEnabled,
	},
	{
		id: 'thread-summarizer',
		category: 'features',
		section: 'IA',
		label: 'Resumidor de Hilos',
		description: 'Resume hilos con Gemini desde el botón de resumir o Resumir+.',
		keywords: ['resumen', 'resumidor', 'hilos', 'ia', 'gemini'],
		settingKeys: ['threadSummarizerEnabled'],
		requiresReload: true,
		setupKey: 'geminiApiKey',
		setupLabel: 'Gemini',
		isEnabled: settings => settings.threadSummarizerEnabled,
	},
	{
		id: 'post-summary',
		category: 'features',
		section: 'IA',
		label: 'Resumen de Post',
		description: 'Permite resumir posts individuales muy largos con un solo clic.',
		keywords: ['resumen', 'post', 'ia', 'gemini'],
		settingKeys: ['postSummaryEnabled'],
		requiresReload: true,
		setupKey: 'geminiApiKey',
		setupLabel: 'Gemini',
		isEnabled: settings => settings.postSummaryEnabled,
	},
	{
		id: 'save-thread',
		category: 'features',
		section: 'Hilos',
		label: 'Guardar Hilo',
		description: 'Muestra botones de guardar en listados y noticias.',
		keywords: ['guardar', 'hilo', 'guardados', 'favoritos'],
		settingKeys: ['saveThreadEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.saveThreadEnabled,
	},
	{
		id: 'hide-thread',
		category: 'features',
		section: 'Ocultación',
		label: 'Ocultar Hilos',
		description: 'Muestra botones para ocultar hilos en listados.',
		keywords: ['ocultar', 'hilos', 'listados'],
		settingKeys: ['hideThreadEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.hideThreadEnabled,
	},
	{
		id: 'hide-ignored-user-threads',
		category: 'features',
		section: 'Ocultación',
		label: 'Ocultar Hilos de Ignorados',
		description: 'Oculta automáticamente hilos creados por usuarios ignorados en listados clásicos.',
		keywords: ['ocultar', 'ignorados', 'usuarios', 'hilos'],
		settingKeys: ['hideIgnoredUserThreadsEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.hideIgnoredUserThreadsEnabled,
	},
	{
		id: 'infinite-scroll',
		category: 'navigation',
		section: 'Carga de hilos',
		label: 'Scroll infinito',
		description: 'Carga automáticamente más posts al llegar al final de la página.',
		keywords: ['scroll', 'infinito', 'hilos', 'posts'],
		settingKeys: ['infiniteScrollEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.infiniteScrollEnabled,
	},
	{
		id: 'auto-infinite-scroll',
		category: 'navigation',
		section: 'Carga de hilos',
		label: 'Activar automáticamente',
		description: 'El scroll infinito se activa automáticamente al entrar en un hilo.',
		keywords: ['scroll', 'auto', 'automatico', 'hilos'],
		settingKeys: ['autoInfiniteScrollEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.autoInfiniteScrollEnabled,
	},
	{
		id: 'live-thread',
		category: 'navigation',
		section: 'Live',
		label: 'Modo Live',
		description: 'Muestra nuevos posts en tiempo real sin recargar la página.',
		keywords: ['live', 'tiempo real', 'posts'],
		settingKeys: ['liveThreadEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.liveThreadEnabled,
	},
	{
		id: 'gallery-button',
		category: 'navigation',
		section: 'Hilos',
		label: 'Botón de galería',
		description: 'Muestra el botón para ver todas las imágenes de cada página del hilo en una galería.',
		keywords: ['galeria', 'imagenes', 'hilos'],
		settingKeys: ['galleryButtonEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.galleryButtonEnabled,
	},
	{
		id: 'live-thread-delay',
		category: 'navigation',
		section: 'Live',
		label: 'Delay en Live de MV Premium',
		description: 'Añade un control de delay en el live propio de MV Premium para evitar spoilers.',
		keywords: ['delay', 'live', 'spoilers'],
		settingKeys: ['liveThreadDelayEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.liveThreadDelayEnabled,
	},
	{
		id: 'native-live-delay',
		category: 'navigation',
		section: 'Live',
		label: 'Delay en Live nativo de Mediavida',
		description: 'Añade un control de delay en los hilos live nativos de Mediavida.',
		keywords: ['delay', 'live', 'nativo', 'spoilers'],
		settingKeys: ['nativeLiveDelayEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.nativeLiveDelayEnabled,
	},
	{
		id: 'centered-posts',
		category: 'navigation',
		section: 'Diseño',
		label: 'Posts e hilos centrados',
		description: 'Oculta el sidebar y expande el contenido en hilos, Spy y subforos.',
		keywords: ['centrados', 'sidebar', 'hilos', 'spy', 'subforos'],
		settingKeys: ['centeredPostsEnabled'],
		requiresReload: true,
		isEnabled: settings => settings.centeredPostsEnabled,
	},
	{
		id: 'centered-controls-position',
		category: 'navigation',
		section: 'Diseño',
		label: 'Posición de controles',
		description: 'Configura los controles centrados arriba o en lateral flotante.',
		keywords: ['controles', 'centrados', 'lateral', 'arriba'],
		settingKeys: ['centeredControlsPosition'],
		requiresReload: true,
	},
	{
		id: 'centered-controls-sticky',
		category: 'navigation',
		section: 'Diseño',
		label: 'Barra de controles fija',
		description: 'La barra de controles permanece visible al hacer scroll.',
		keywords: ['controles', 'sticky', 'fija', 'scroll'],
		settingKeys: ['centeredControlsSticky'],
		requiresReload: true,
		isEnabled: settings => settings.centeredControlsSticky,
	},
	{
		id: 'bold-color',
		category: 'content',
		section: 'Lectura',
		label: 'Personalizar color de negrita',
		description: 'Usa un color personalizado para el texto en negrita.',
		keywords: ['negrita', 'color', 'bold', 'texto'],
		settingKeys: ['boldColorEnabled', 'boldColor'],
		isEnabled: settings => settings.boldColorEnabled,
	},
	{
		id: 'twitter-lite',
		category: 'content',
		section: 'Embeds',
		label: 'Tweets Lite',
		description: 'Reemplaza los iframes de X/Twitter por tarjetas ligeras.',
		keywords: ['twitter', 'x', 'tweets', 'embeds', 'lite'],
		settingKeys: ['twitterLiteEmbedsEnabled'],
		isEnabled: settings => settings.twitterLiteEmbedsEnabled,
	},
	{
		id: 'dashboard-icon',
		category: 'content',
		section: 'Dashboard',
		label: 'Icono del Dashboard',
		description: 'Elige el icono que aparece en el navbar de Mediavida para acceder al panel.',
		keywords: ['dashboard', 'icono', 'navbar', 'logo'],
		settingKeys: ['dashboardIcon'],
		requiresReload: true,
	},
	{
		id: 'hide-header',
		category: 'content',
		section: 'Diseño',
		label: 'Ocultar cabecera',
		description: 'Oculta el header/navbar superior de Mediavida para ganar espacio vertical.',
		keywords: ['cabecera', 'header', 'navbar', 'ocultar'],
		settingKeys: ['hideHeaderEnabled'],
		isEnabled: settings => settings.hideHeaderEnabled,
	},
	{
		id: 'work-mode',
		category: 'content',
		section: 'Modo trabajo',
		label: 'Modo trabajo',
		description: 'Oculta contenido visual del foro para navegar discretamente.',
		keywords: ['trabajo', 'discreto', 'ocultar', 'imagenes', 'avatares'],
		settingKeys: ['workModeEnabled', 'workModeOptions', 'workModeTabTitle'],
		isEnabled: settings => settings.workModeEnabled,
	},
	{
		id: 'ultrawide-mode',
		category: 'content',
		section: 'Diseño',
		label: 'Modo Ultrawide',
		description: 'Ajusta el ancho del contenido para monitores grandes.',
		keywords: ['ultrawide', 'ancho', 'wide', 'layout', 'monitor'],
		settingKeys: ['ultrawideMode'],
		isEnabled: settings => settings.ultrawideMode !== 'off',
	},
	{
		id: 'activity-tracking',
		category: 'advanced',
		section: 'Actividad',
		label: 'Registro de actividad',
		description: 'Registra posts creados y editados para el heatmap del dashboard.',
		keywords: ['actividad', 'heatmap', 'estadisticas', 'posts'],
		settingKeys: ['enableActivityTracking'],
		isEnabled: settings => settings.enableActivityTracking,
	},
	{
		id: 'backup-data',
		category: 'advanced',
		section: 'Datos',
		label: 'Copia de Seguridad',
		description: 'Exporta o importa tus datos y configuraciones.',
		keywords: ['backup', 'copia', 'seguridad', 'exportar', 'importar', 'datos'],
	},
	{
		id: 'reset-data',
		category: 'advanced',
		section: 'Datos',
		label: 'Eliminar todos mis datos',
		description: 'Borra todos los datos almacenados por la extensión.',
		keywords: ['eliminar', 'borrar', 'reset', 'datos', 'peligro'],
	},
	{
		id: 'keyboard-shortcuts',
		category: 'shortcuts',
		section: 'Atajos',
		label: 'Atajos de Teclado',
		description: 'Configura accesos rápidos para navegar por Mediavida y el panel.',
		keywords: ['atajos', 'teclado', 'shortcuts', 'hotkeys', 'acciones'],
	},
]

export function isValidCategory(id: string): id is CategoryId {
	return SETTINGS_CATEGORIES.some(cat => cat.id === id)
}

export function getSettingById(settingId: string | null): SettingSearchItem | null {
	if (!settingId) return null
	return SETTINGS_SEARCH_INDEX.find(setting => setting.id === settingId) ?? null
}

function getSettingsUrlParams() {
	const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : ''
	return new URLSearchParams(hashQuery || window.location.search)
}

export function getTabFromUrl(): CategoryId | null {
	const urlParams = getSettingsUrlParams()
	const urlTab = urlParams.get('tab')
	if (urlTab && isValidCategory(urlTab)) return urlTab
	return null
}

export function getSettingFromUrl(): string | null {
	const urlParams = getSettingsUrlParams()
	const settingId = urlParams.get('setting')
	return getSettingById(settingId)?.id ?? null
}

export function updateUrlParam(tabId: CategoryId, settingId?: string | null) {
	const url = new URL(window.location.href)

	const writeParams = (params: URLSearchParams) => {
		params.set('tab', tabId)
		if (settingId) {
			params.set('setting', settingId)
		} else {
			params.delete('setting')
		}
	}

	if (url.hash.startsWith('#/settings')) {
		const [hashPath, hashQuery = ''] = url.hash.split('?')
		const params = new URLSearchParams(hashQuery)
		writeParams(params)
		url.hash = `${hashPath}?${params.toString()}`
		window.history.replaceState({}, '', url.toString())
		return
	}

	writeParams(url.searchParams)
	window.history.replaceState({}, '', url.toString())
}

export function getSettingDomId(settingId: string) {
	return `setting-${settingId}`
}

export function normalizeSettingsQuery(value: string) {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.trim()
}

export function settingMatchesQuery(setting: SettingSearchItem, query: string) {
	if (!query) return true
	const searchableText = [setting.label, setting.description, setting.section, setting.category, ...setting.keywords]
		.filter(Boolean)
		.join(' ')
	return normalizeSettingsQuery(searchableText).includes(query)
}

export function settingMatchesQuickFilter(setting: SettingSearchItem, filter: SettingsQuickFilter, settings: Settings) {
	if (filter === 'all') return true
	if (filter === 'reload') return setting.requiresReload === true

	const enabled = setting.isEnabled?.(settings)
	if (filter === 'enabled') return enabled === true
	if (filter === 'disabled') return enabled === false
	if (filter === 'needs-setup') {
		return enabled === true && Boolean(setting.setupKey && !settings[setting.setupKey])
	}

	return true
}

export function getVisibleSettingIds(settings: Settings, query: string, filter: SettingsQuickFilter) {
	const normalizedQuery = normalizeSettingsQuery(query)
	if (!normalizedQuery && filter === 'all') return null

	return new Set(
		SETTINGS_SEARCH_INDEX.filter(setting => settingMatchesQuery(setting, normalizedQuery))
			.filter(setting => settingMatchesQuickFilter(setting, filter, settings))
			.map(setting => setting.id)
	)
}

export function shouldShowSetting(filter: SettingsContentFilter | undefined, settingId: string) {
	return !filter?.visibleSettingIds || filter.visibleSettingIds.has(settingId)
}

export function shouldShowAnySetting(filter: SettingsContentFilter | undefined, settingIds: string[]) {
	return settingIds.some(settingId => shouldShowSetting(filter, settingId))
}

export function isHighlightedSetting(filter: SettingsContentFilter | undefined, settingId: string) {
	return filter?.highlightedSettingId === settingId
}
