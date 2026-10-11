import { MV_URLS } from '@/constants'
import { getSettingById, normalizeSettingsQuery } from '../views/settings-view/constants'

export const FEATURE_CATEGORIES = [
	{ id: 'reading', label: 'Leer y navegar', description: 'Muévete por el foro y sigue las conversaciones.' },
	{ id: 'writing', label: 'Escribir mensajes', description: 'Prepara tus mensajes con menos esfuerzo.' },
	{ id: 'organization', label: 'Organizar y filtrar', description: 'Guarda lo que te interesa y aparta lo que no.' },
	{ id: 'media', label: 'Multimedia y ocio', description: 'Cine, juegos, imágenes y fútbol dentro de Mediavida.' },
	{ id: 'appearance', label: 'Personalizar', description: 'Adapta el foro a tu forma de leer.' },
	{ id: 'tools', label: 'Tu panel y tus datos', description: 'Consulta tu actividad y cuida tu configuración.' },
] as const

export type FeatureCategory = (typeof FEATURE_CATEGORIES)[number]['id']
export type FeaturePlatform = 'desktop' | 'mobile' | 'both'
export type FeaturePlatformFilter = 'all' | 'desktop' | 'mobile'

export interface DiscoverFeature {
	id: string
	category: FeatureCategory
	title: string
	description: string
	location: string
	platform: FeaturePlatform
	/** Instructions can differ between the desktop forum and Mobile Lite. */
	mobileLocation?: string
	requirement?: string
	keywords?: string[]
	settingId?: string
	action?: { label: string; href: string }
}

/**
 * A capability catalogue, rather than one entry per toggle or internal module.
 * Link configurable features to the existing settings index; include tools that
 * have no toggle too. Check Mobile Lite's registry when changing availability.
 */
export const FEATURE_CATALOG: DiscoverFeature[] = [
	{
		id: 'command-menu', category: 'reading', platform: 'desktop',
		title: 'Busca y salta a cualquier sitio',
		description: 'Encuentra subforos, hilos guardados, borradores y acciones desde un mismo buscador.',
		location: 'Pulsa Ctrl+K (⌘+K en Mac) en el foro o en el panel.',
		keywords: ['super buscador', 'buscar', 'atajos', 'command menu'], settingId: 'navbar-search',
	},
	{
		id: 'unread-favorites', category: 'reading', platform: 'desktop',
		title: 'Abre tus favoritos de golpe',
		description: 'Abre los hilos con mensajes nuevos en pestañas distintas, hasta 10 a la vez.',
		location: 'Estrella de favoritos de Mediavida → Abrir no leídos.',
		keywords: ['favoritos', 'novedades', 'notificaciones', 'mensajes nuevos', 'pestañas'],
	},
	{
		id: 'thread-preview', category: 'reading', platform: 'desktop', settingId: 'thread-preview',
		title: 'Lee el primer mensaje sin entrar al hilo',
		description: 'Previsualiza el primer post desde Spy o un listado de subforo.',
		location: 'Botón Previsualizar primer post junto al hilo en Spy o en un subforo.',
	},
	{
		id: 'infinite-scroll', category: 'reading', platform: 'desktop', settingId: 'infinite-scroll',
		title: 'Lee sin cambiar de página',
		description: 'El scroll infinito carga la siguiente página del hilo al llegar al final.',
		location: 'Controles del hilo → Scroll infinito. Puedes activar el inicio automático en ajustes.',
	},
	{
		id: 'live-thread', category: 'reading', platform: 'both', settingId: 'live-thread',
		title: 'Sigue un hilo en directo',
		description: 'El modo Live muestra los mensajes nuevos sin tener que recargar.',
		location: 'Botón Live en los controles del hilo.',
		mobileLocation: 'Botón Live en las acciones al final de la página del hilo.',
	},
	{
		id: 'live-delay', category: 'reading', platform: 'desktop', settingId: 'live-thread-delay',
		title: 'Evita spoilers en los directos',
		description: 'Retrasa la aparición de mensajes para seguir un evento al ritmo de tu emisión.',
		location: 'Control de retraso del Live. También disponible para el Live nativo desde ajustes.',
		keywords: ['delay', 'native live', 'spoilers', 'fútbol'],
	},
	{
		id: 'related-threads', category: 'reading', platform: 'both', settingId: 'related-threads-display',
		title: 'Decide cómo ver los hilos relacionados',
		description: 'Oculta el bloque, déjalo plegado o conserva su aspecto original.',
		location: 'Ajustes → Funcionalidades → Hilos relacionados. En PC también puedes limitar su antigüedad.',
		mobileLocation: 'Panel Mobile Lite → Ajustes → Hilos relacionados.',
	},
	{
		id: 'quote-selection', category: 'reading', platform: 'mobile',
		title: 'Cita un fragmento desde el móvil',
		description: 'El botón de citar queda accesible debajo del texto que seleccionas.',
		location: 'Mantén pulsado un texto de un post, selecciona el fragmento y toca Citar.',
		keywords: ['selección', 'quote', 'citar'],
	},
	{
		id: 'drafts', category: 'writing', platform: 'desktop', settingId: 'drafts-button',
		title: 'Guarda y recupera tus borradores',
		description: 'Prepara mensajes para después y recupera el texto con el autoguardado del editor.',
		location: 'Editor → Mis Borradores, o Panel → Mis Borradores.',
		action: { label: 'Ver mis borradores', href: '/drafts' }, keywords: ['autosave', 'autoguardado'],
	},
	{
		id: 'templates', category: 'writing', platform: 'desktop', settingId: 'template-button',
		title: 'Reutiliza tus mensajes como plantillas',
		description: 'Guarda textos que repites e insértalos sin volver a escribirlos.',
		location: 'Editor → Insertar plantilla, o Panel → Mis Plantillas.',
		action: { label: 'Ver mis plantillas', href: '/templates' }, keywords: ['snippets'],
	},
	{
		id: 'cinema-templates', category: 'writing', platform: 'desktop', settingId: 'cinema-button',
		title: 'Inserta fichas de películas, series y anime',
		description: 'Busca títulos de TMDB o AniList y añade su ficha al mensaje.',
		location: 'Barra del editor → Plantillas multimedia.',
	},
	{
		id: 'game-templates', category: 'writing', platform: 'desktop', settingId: 'game-button',
		title: 'Inserta fichas de videojuegos',
		description: 'Busca un juego en IGDB y añade sus datos al mensaje.',
		location: 'Barra del editor → Videojuegos.',
	},
	{
		id: 'gifs', category: 'writing', platform: 'desktop', settingId: 'gif-picker',
		title: 'Busca GIFs sin salir del editor',
		description: 'Encuentra un GIF de GIPHY e insértalo directamente en tu respuesta.',
		location: 'Barra del editor → Selector de GIFs.',
	},
	{
		id: 'image-upload', category: 'writing', platform: 'both', settingId: 'imgbb-api-key',
		title: 'Sube imágenes desde tu dispositivo',
		description: 'Selecciona una imagen y añade su enlace al mensaje. En móvil puedes recortarla antes de subirla.',
		location: 'Barra del editor → Subir imagen; también puedes arrastrar o pegar imágenes en PC.',
		mobileLocation: 'Botón Subir imagen junto al editor de Mobile Lite.',
		keywords: ['fotos', 'recortar', 'portapapeles'],
	},
	{
		id: 'auto-tags', category: 'writing', platform: 'both', settingId: 'auto-tags',
		title: 'Pega enlaces de imágenes y vídeos',
		description: 'El editor añade las etiquetas necesarias para mostrar el contenido en el mensaje.',
		location: 'Pega el enlace en el editor. En PC puedes activar o desactivar los auto-tags.',
		mobileLocation: 'Pega o escribe el enlace en el editor de Mobile Lite.',
	},
	{
		id: 'tables', category: 'writing', platform: 'desktop',
		title: 'Crea tablas de forma visual',
		description: 'Añade filas y columnas sin escribir todo el BBCode a mano; también puedes editar una tabla existente.',
		location: 'Barra del editor → Insertar tabla.', keywords: ['tabla', 'bbcode'],
	},
	{
		id: 'polls', category: 'writing', platform: 'desktop',
		title: 'Prepara encuestas para tus hilos',
		description: 'Escribe la pregunta y las opciones con el creador de encuestas.',
		location: 'Al crear un hilo → Barra del editor → Crear encuesta.',
	},
	{
		id: 'formatting', category: 'writing', platform: 'desktop',
		title: 'Da formato a tus mensajes',
		description: 'Añade títulos, listas, tareas, spoilers y un índice desde la barra del editor.',
		location: 'Botones de formato del editor, también en el editor de borradores.',
		keywords: ['markdown', 'bbcode', 'encabezados', 'índice', 'listas'],
	},
	{
		id: 'code', category: 'writing', platform: 'desktop',
		title: 'Comparte código con resaltado',
		description: 'Inserta bloques de código y elige el lenguaje para resaltar su sintaxis.',
		location: 'Barra del editor → Insertar código.', keywords: ['programación', 'syntax', 'código'],
	},
	{
		id: 'live-preview', category: 'writing', platform: 'desktop',
		title: 'Ve cómo quedará el mensaje mientras escribes',
		description: 'Abre la previsualización en vivo para revisar el formato antes de enviar.',
		location: 'Botón de previsualización en vivo de la barra del editor.', keywords: ['live preview', 'bbcode'],
	},
	{
		id: 'editor-history', category: 'writing', platform: 'desktop',
		title: 'Deshaz y rehace cambios del editor',
		description: 'Recupera versiones anteriores del texto mientras preparas tu mensaje.',
		location: 'Botones Deshacer y Rehacer de la barra del editor.', keywords: ['undo', 'redo', 'historial'],
	},
	{
		id: 'editor-copy-clear', category: 'writing', platform: 'both',
		title: 'Copia o limpia el contenido del editor',
		description: 'Copia todo el texto para reutilizarlo o vacía el editor con confirmación.',
		location: 'Botones Copiar y Limpiar junto al editor.',
	},
	{
		id: 'thread-clipper', category: 'writing', platform: 'desktop', settingId: 'thread-clipper',
		title: 'Crea un hilo a partir de una noticia',
		description: 'Prepara un hilo de Mediavida a partir de una página externa.',
		location: 'Clic derecho en una web → MV Premium: preparar hilo.',
		requirement: 'Elige los subforos del recortador en ajustes.',
	},
	{
		id: 'saved-threads', category: 'organization', platform: 'desktop', settingId: 'save-thread',
		title: 'Guarda hilos para volver después',
		description: 'Crea una colección de hilos que quieres conservar y búscala desde tu perfil.',
		location: 'Acción Guardar del hilo o del listado. Consulta tu perfil → Temas → Guardados.',
	},
	{
		id: 'pinned-posts', category: 'organization', platform: 'desktop', settingId: 'pinned-posts',
		title: 'Ancla los mensajes importantes',
		description: 'Conserva posts concretos en un panel lateral y consúltalos también desde tu perfil.',
		location: 'Chincheta del post. En tu perfil → Temas → Anclados.',
	},
	{
		id: 'favorite-subforums', category: 'organization', platform: 'desktop',
		title: 'Ten tus subforos favoritos a mano',
		description: 'Marca subforos para acceder a ellos rápidamente desde el foro y el buscador.',
		location: 'Estrella junto a un subforo en el índice del foro.', keywords: ['favoritos', 'subforos'],
	},
	{
		id: 'favorites-manager', category: 'organization', platform: 'desktop',
		title: 'Limpia favoritos y marcadores en bloque',
		description: 'Busca, selecciona y elimina varios elementos de tu colección a la vez.',
		location: 'Páginas Favoritos y Marcadores de Mediavida.',
		action: { label: 'Ver favoritos', href: MV_URLS.FAVORITES }, keywords: ['bookmarks', 'marcadores', 'borrar'],
	},
	{
		id: 'content-rules', category: 'organization', platform: 'desktop', settingId: 'content-rules',
		title: 'Filtra hilos automáticamente',
		description: 'Crea reglas para ocultar o destacar hilos por su título, autor o subforo.',
		location: 'Panel → Filtros → Reglas de hilos.', action: { label: 'Crear una regla', href: '/filters?tab=threads' },
	},
	{
		id: 'muted-words', category: 'organization', platform: 'desktop',
		title: 'Silencia palabras que no quieres leer',
		description: 'Oculta mensajes que contienen las palabras o expresiones que elijas.',
		location: 'Panel → Filtros → Palabras.', action: { label: 'Configurar palabras', href: '/filters?tab=words' },
	},
	{
		id: 'hidden-threads', category: 'organization', platform: 'both', settingId: 'hide-thread',
		title: 'Aparta hilos que no te interesan',
		description: 'Oculta hilos de los listados y recupera los que quieras desde tu lista de ocultos.',
		location: 'Acción Ocultar del hilo. Panel → Filtros → Hilos ocultos.',
		mobileLocation: 'Ocultar en las acciones del hilo o del listado. Panel Mobile Lite → Hilos.',
	},
	{
		id: 'hidden-subforums', category: 'organization', platform: 'desktop',
		title: 'Oculta subforos completos',
		description: 'Aparta un subforo de la navegación y gestiona tu lista de subforos ocultos.',
		location: 'Panel → Filtros → Subforos ocultos.', action: { label: 'Ver subforos ocultos', href: '/filters?tab=hidden-subforums' },
	},
	{
		id: 'ignored-users', category: 'organization', platform: 'both',
		title: 'Silencia u oculta usuarios',
		description: 'Elige cómo tratar sus mensajes y gestiona tus filtros por usuario.',
		location: 'Ficha del usuario → Opciones de MV Premium. Panel → Filtros → Usuarios.',
		mobileLocation: 'Ficha del usuario o Panel Mobile Lite → Usuarios.',
		action: { label: 'Configurar usuarios', href: '/filters?tab=users' }, keywords: ['ignorados', 'ignorar'],
	},
	{
		id: 'ignored-user-threads', category: 'organization', platform: 'both', settingId: 'hide-ignored-user-threads',
		title: 'Oculta también los hilos de ignorados',
		description: 'Aparta del listado los hilos creados por usuarios que tienes ignorados.',
		location: 'Ajustes → Funcionalidades → Ocultar Hilos de Ignorados.',
		mobileLocation: 'Se aplica en los listados de subforos a los usuarios ocultos en Mobile Lite.',
	},
	{
		id: 'post-gestures', category: 'organization', platform: 'mobile',
		title: 'Gestiona usuarios con un gesto',
		description: 'Desliza un post a la izquierda para ocultar a su autor o a la derecha para silenciarlo.',
		location: 'Desliza sobre un post. Activa o desactiva los gestos en Panel Mobile Lite → Ajustes.',
		keywords: ['swipe', 'gestos', 'ignorar'],
	},
	{
		id: 'context-actions', category: 'organization', platform: 'desktop',
		title: 'Usa las acciones del clic derecho',
		description: 'Guarda u oculta un hilo desde su enlace y silencia una palabra seleccionada.',
		location: 'Clic derecho sobre un enlace de hilo o sobre un texto seleccionado en Mediavida.',
		keywords: ['menú contextual', 'ratón', 'guardar', 'ocultar', 'silenciar'],
	},
	{
		id: 'tweets-lite', category: 'media', platform: 'both', settingId: 'twitter-lite',
		title: 'Lee los tweets en formato ligero',
		description: 'Sustituye los embeds de X por tarjetas ligeras; puedes abrir el tweet original cuando quieras.',
		location: 'Tweets de los hilos. Actívalo en Ajustes → Contenido → Tweets Lite.',
		mobileLocation: 'Tweets de los hilos. Panel Mobile Lite → Ajustes → Tweets Lite.',
	},
	{
		id: 'gallery', category: 'media', platform: 'both', settingId: 'gallery-button',
		title: 'Recorre las imágenes de un hilo',
		description: 'Abre una galería con las imágenes de la página del hilo.',
		location: 'Controles del hilo → Galería.', mobileLocation: 'Acciones al final de la página del hilo → Galería.',
	},
	{
		id: 'media-hover-cards', category: 'media', platform: 'desktop', settingId: 'media-hover-cards',
		title: 'Consulta información sin abrir el enlace',
		description: 'Ve tarjetas de películas y series al pasar el ratón por enlaces compatibles.',
		location: 'Enlaces de TMDB e IMDb dentro de los mensajes.',
	},
	{
		id: 'steam-bundles', category: 'media', platform: 'desktop', settingId: 'steam-bundle-cards',
		title: 'Previsualiza bundles de Steam',
		description: 'Consulta tarjetas de packs de juegos al leer o preparar un mensaje.',
		location: 'Enlaces de bundles de Steam dentro de los mensajes y sus vistas previas.',
	},
	{
		id: 'fragrantica', category: 'media', platform: 'desktop', settingId: 'fragrantica-embeds',
		title: 'Consulta fichas de perfumes',
		description: 'Convierte enlaces de Fragrantica en tarjetas con información del perfume.',
		location: 'Enlaces de Fragrantica dentro de los hilos.',
	},
	{
		id: 'game-deals', category: 'media', platform: 'desktop', settingId: 'itad-search',
		title: 'Encuentra ofertas de videojuegos',
		description: 'Compara precios, tiendas, descuentos y mínimos históricos con IsThereAnyDeal.',
		location: 'Buscador de ofertas en los subforos Juegos y La Hucha.',
	},
	{
		id: 'game-releases', category: 'media', platform: 'desktop', settingId: 'game-release-calendar',
		title: 'Mira qué juegos salen próximamente',
		description: 'Consulta próximos lanzamientos y filtra por plataformas.',
		location: 'Calendario de los subforos Juegos y Juegos de móvil.',
	},
	{
		id: 'movie-releases', category: 'media', platform: 'desktop', settingId: 'movie-release-calendar',
		title: 'Consulta los próximos estrenos de cine',
		description: 'Descubre las películas que se estrenan próximamente en España.',
		location: 'Calendario de estrenos del subforo Cine.',
	},
	{
		id: 'football', category: 'media', platform: 'desktop', settingId: 'football-calendar',
		title: 'Sigue La Liga y la Champions',
		description: 'Consulta jornadas, marcadores en directo, clasificación y tus equipos favoritos.',
		location: 'Subforo Deportes → Calendario de fútbol.', requirement: 'Necesita una clave gratuita de football-data.org.',
	},
	{
		id: 'movie-reviews', category: 'media', platform: 'desktop',
		title: 'Publica y guarda tus críticas de cine',
		description: 'Crea críticas con nota y consulta tu colección, diario y resumen para compartir en Mediaffinity.',
		location: 'Editor → Crítica de cine. Tu colección está en Panel → Mediaffinity.',
		action: { label: 'Abrir Mediaffinity', href: '/cine' }, keywords: ['películas', 'reseñas', 'review'],
	},
	{
		id: 'thread-summary', category: 'reading', platform: 'both', settingId: 'thread-summarizer',
		title: 'Ponte al día con un resumen del hilo',
		description: 'Resume una conversación con Gemini para conocer sus ideas principales.',
		location: 'Controles del hilo → Resumir o Resumir+.',
		mobileLocation: 'Acciones del hilo → Resumir. Configura Gemini en Panel Mobile Lite → Ajustes.',
		requirement: 'Necesita tu clave de Google Gemini.', keywords: ['inteligencia artificial'],
	},
	{
		id: 'post-summary', category: 'reading', platform: 'both', settingId: 'post-summary',
		title: 'Resume un mensaje largo',
		description: 'Obtén un resumen de un post concreto con Gemini.',
		location: 'Acción Resumir del post.', requirement: 'Necesita tu clave de Google Gemini.', keywords: ['inteligencia artificial'],
	},
	{
		id: 'user-analysis', category: 'reading', platform: 'both', settingId: 'thread-summarizer',
		title: 'Resume la participación de un usuario',
		description: 'Consulta con Gemini un análisis de sus mensajes en una o varias páginas de un hilo.',
		location: 'Filtra el hilo por un usuario y pulsa Analizar o Analizar+.',
		mobileLocation: 'Filtra el hilo por un usuario y toca Analizar en las acciones del hilo.',
		requirement: 'Necesita tu clave de Google Gemini.', keywords: ['ia', 'inteligencia artificial'],
	},
	{
		id: 'mv-theme', category: 'appearance', platform: 'desktop',
		title: 'Cambia el aspecto de Mediavida',
		description: 'Personaliza el tema del foro con colores y presets.',
		location: 'Panel → Tema de Mediavida.', action: { label: 'Personalizar el tema', href: '/mv-theme' },
	},
	{
		id: 'centered-posts', category: 'appearance', platform: 'desktop', settingId: 'centered-posts',
		title: 'Centra la lectura y coloca los controles',
		description: 'Amplía el contenido al ocultar la barra lateral y elige dónde dejar los controles del hilo.',
		location: 'Ajustes → Navegación → Posts e hilos centrados.',
	},
	{
		id: 'ultrawide', category: 'appearance', platform: 'desktop', settingId: 'ultrawide-mode',
		title: 'Aprovecha tu monitor panorámico',
		description: 'Ajusta el ancho del foro para pantallas grandes con el modo Ultrawide.',
		location: 'Ajustes → Contenido → Modo Ultrawide.',
	},
	{
		id: 'bold-color', category: 'appearance', platform: 'both', settingId: 'bold-color',
		title: 'Destaca las negritas con tu color',
		description: 'Elige un color para que el texto en negrita sea más fácil de distinguir.',
		location: 'Ajustes → Contenido → Personalizar color de negrita.',
		mobileLocation: 'Panel Mobile Lite → Ajustes → Color de negrita.',
	},
	{
		id: 'user-customizations', category: 'appearance', platform: 'desktop',
		title: 'Reconoce usuarios con colores y notas',
		description: 'Personaliza usuarios con alias, colores, etiquetas y notas privadas.',
		location: 'Ficha del usuario → Opciones de MV Premium, o Panel → Filtros → Usuarios.',
		action: { label: 'Personalizar usuarios', href: '/filters?tab=users' },
	},
	{
		id: 'new-homepage', category: 'appearance', platform: 'desktop', settingId: 'new-homepage',
		title: 'Usa una portada personalizada',
		description: 'Sustituye la portada nativa por la homepage de MV Premium.',
		location: 'Ajustes → Funcionalidades → Homepage de MV Premium.',
	},
	{
		id: 'hide-header', category: 'appearance', platform: 'desktop', settingId: 'hide-header',
		title: 'Gana espacio ocultando la cabecera',
		description: 'Retira la cabecera superior de Mediavida para dejar más espacio al contenido.',
		location: 'Ajustes → Contenido → Ocultar cabecera.',
	},
	{
		id: 'work-mode', category: 'appearance', platform: 'desktop', settingId: 'work-mode',
		title: 'Navega de forma más discreta',
		description: 'El modo trabajo puede ocultar imágenes, avatares y vídeos y disimular el título de la pestaña.',
		location: 'Ajustes → Contenido → Modo trabajo.',
	},
	{
		id: 'panel-theme', category: 'appearance', platform: 'desktop',
		title: 'Personaliza los colores y la letra del panel',
		description: 'Elige un tema claro u oscuro, un preset, colores propios y una fuente para la extensión.',
		location: 'Menú de apariencia junto a tu avatar en la parte superior del panel → Personalizar.',
		keywords: ['tema', 'tipografía', 'fuente', 'dark', 'light', 'preset'],
	},
	{
		id: 'post-font-size', category: 'appearance', platform: 'desktop',
		title: 'Ajusta el tamaño del texto de los posts',
		description: 'Haz más grande o más pequeño el texto del foro para leer con comodidad.',
		location: 'Menú de apariencia del panel → Personalizar → Tamaño de texto en posts.',
		keywords: ['fuente', 'letra', 'zoom', 'lectura'],
	},
	{
		id: 'dashboard-icon', category: 'appearance', platform: 'desktop', settingId: 'dashboard-icon',
		title: 'Elige el icono de acceso al panel',
		description: 'Cambia el icono de MV Premium que aparece en la cabecera del foro.',
		location: 'Ajustes → Contenido → Icono del Dashboard.',
	},
	{
		id: 'activity', category: 'tools', platform: 'desktop', settingId: 'rhythm-tracking',
		title: 'Consulta tu actividad en el foro',
		description: 'Revisa tus estadísticas, el tiempo que pasas en Mediavida y tus subforos más visitados.',
		location: 'Panel → Inicio y Ranking Subforos.', action: { label: 'Ver mi actividad', href: '/' },
	},
	{
		id: 'shortcuts', category: 'tools', platform: 'desktop', settingId: 'keyboard-shortcuts',
		title: 'Navega con tus propios atajos',
		description: 'Configura teclas para moverte por Mediavida y abrir herramientas del panel.',
		location: 'Ajustes → Atajos de Teclado.',
	},
	{
		id: 'backups', category: 'tools', platform: 'desktop', settingId: 'backup-data',
		title: 'Haz una copia de tus datos',
		description: 'Exporta tus datos y configuración e impórtalos para recuperarlos o trasladarlos.',
		location: 'Ajustes → Avanzado → Copia de Seguridad.', keywords: ['backup', 'restaurar'],
	},
	{
		id: 'mobile-transfer', category: 'tools', platform: 'both',
		title: 'Lleva tus ignorados del PC al móvil',
		description: 'Genera un QR para importar tus usuarios silenciados u ocultos; puedes incluir tus claves de Gemini e ImgBB.',
		location: 'Panel del PC → QR Mobile Lite. Escanéalo desde el móvil y revisa la importación.',
		action: { label: 'Preparar el QR', href: '/mobile-lite-qr' }, keywords: ['sincronizar', 'transferir', 'android'],
	},
	{
		id: 'mobile-panel', category: 'tools', platform: 'mobile',
		title: 'Gestiona la extensión desde el móvil',
		description: 'Consulta tus usuarios e hilos ocultos y configura las funciones de Mobile Lite.',
		location: 'Icono de MV Premium en la cabecera de Mediavida → Panel Mobile Lite.', keywords: ['android', 'ajustes'],
	},
]

export function getFeatureAction(feature: DiscoverFeature): DiscoverFeature['action'] | undefined {
	if (feature.action) return feature.action
	const setting = getSettingById(feature.settingId ?? null)
	if (!setting) return undefined
	return {
		label: 'Ir al ajuste',
		href: `/settings?tab=${setting.category}&setting=${setting.id}`,
	}
}

export function filterFeatureCatalog(
	query: string,
	category: FeatureCategory | 'all' = 'all',
	platform: FeaturePlatformFilter = 'all'
): DiscoverFeature[] {
	const terms = normalizeSettingsQuery(query).split(/\s+/).filter(Boolean)
	return FEATURE_CATALOG.filter(feature => {
		if (category !== 'all' && feature.category !== category) return false
		if (platform !== 'all' && feature.platform !== 'both' && feature.platform !== platform) return false
		const setting = getSettingById(feature.settingId ?? null)
		const categoryLabel = FEATURE_CATEGORIES.find(item => item.id === feature.category)?.label
		const text = normalizeSettingsQuery([
			feature.title, feature.description, feature.location, feature.mobileLocation,
			feature.requirement, categoryLabel, ...(feature.keywords ?? []), ...(setting?.keywords ?? []),
		].filter(Boolean).join(' '))
		return terms.every(term => text.includes(term))
	})
}
