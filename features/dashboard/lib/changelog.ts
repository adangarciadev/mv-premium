/**
 * Changelog - Registry of features and fixes per version.
 * This data is used to inform users about updates via the dashboard and badges.
 */

import { browser } from '#imports'

export interface ChangeEntry {
	type: 'feature' | 'fix' | 'improvement'
	description: string
	category?: string
	surface?: 'desktop' | 'mobile-lite' | 'shared' | Array<'desktop' | 'mobile-lite' | 'shared'>
}

export interface ChangelogEntry {
	version: string
	date: string
	title: string
	summary?: string
	changes: ChangeEntry[]
}

export const CHANGELOG: ChangelogEntry[] = [
	{
		version: '3.0.0',
		date: '2026-06-07',
		title: 'Mobile Lite, sincronización QR y recorte de imágenes',
		summary:
			'Mediavida Premium 3.0 estrena una experiencia Mobile Lite para Firefox Android, permite llevar usuarios ignorados al móvil mediante QR y añade herramientas móviles para gestionar filtros, crear hilos y subir imágenes con recorte opcional.',
		changes: [
			{
				type: 'feature',
				description:
					'Mobile Lite para Firefox Android: Nueva experiencia ligera adaptada al móvil para usar Mediavida Premium desde Firefox Android sin permisos nuevos ni backend adicional.',
				category: 'Mobile Lite',
				surface: 'mobile-lite',
			},
			{
				type: 'feature',
				description:
					'Panel móvil de usuarios filtrados: Desde Mobile Lite puedes consultar, buscar, añadir, silenciar, ocultar o quitar usuarios ignorados con una interfaz pensada para pantallas pequeñas.',
				category: 'Mobile Lite',
				surface: ['mobile-lite', 'shared'],
			},
			{
				type: 'feature',
				description:
					'Usuarios ocultos y silenciados en móvil: Los posts se ocultan por completo o se colapsan según el modo elegido, manteniendo la misma lógica de filtros que en escritorio.',
				category: 'Mobile Lite',
				surface: ['mobile-lite', 'shared'],
			},
			{
				type: 'feature',
				description:
					'Ocultación de hilos por autor en subforos móviles: Si tienes a un usuario en modo Ocultar, sus hilos dejan de aparecer también en listados normales de subforo en Mobile Lite.',
				category: 'Mobile Lite',
				surface: ['mobile-lite', 'shared'],
			},
			{
				type: 'feature',
				description:
					'Crear hilos desde Mobile Lite: El menú móvil incorpora acceso rápido a Nuevo hilo con selección de subforo en una vista compacta adaptada al viewport.',
				category: 'Mobile Lite',
				surface: ['mobile-lite', 'shared'],
			},
			{
				type: 'feature',
				description:
					'Editor móvil mejorado: Mobile Lite reconoce enlaces de imagen y media al pegar texto, conserva mejor el contenido al cambiar de editor e incorpora subida directa de imágenes.',
				category: 'Mobile Lite',
				surface: ['mobile-lite', 'shared'],
			},
			{
				type: 'feature',
				description:
					'Recorte opcional antes de subir imágenes desde móvil: Antes de enviar una imagen puedes recortarla en formato cuadrado o libre, hacer zoom, arrastrar el encuadre o subir el original.',
				category: 'Mobile Lite',
				surface: 'mobile-lite',
			},
			{
				type: 'feature',
				description:
					'Exportar ignorados a móvil: La gestión de usuarios ignorados en escritorio añade una acción para generar un QR o copiar un enlace de importación.',
				category: 'Escritorio',
				surface: ['desktop', 'shared'],
			},
			{
				type: 'feature',
				description:
					'Backup seguro local: Nueva zona avanzada para crear copias de seguridad completas desde el dashboard, con selección de datos, resumen previo y restauración controlada.',
				category: 'Copias de seguridad',
				surface: 'desktop',
			},
			{
				type: 'feature',
				description:
					'Backup opcional de claves personales: Las claves de API personales pueden incluirse en la copia de seguridad solo si el usuario lo activa expresamente.',
				category: 'Copias de seguridad',
				surface: 'desktop',
			},
			{
				type: 'feature',
				description:
					'Importación manual por QR: Mobile Lite puede leer un enlace especial de Mediavida, mostrar resumen de usuarios ocultos y silenciados, pedir confirmación y fusionarlos con los existentes.',
				category: 'Mobile Lite',
				surface: ['mobile-lite', 'shared'],
			},
			{
				type: 'improvement',
				description:
					'Sincronización sin cuenta ni servidor: La transferencia escritorio -> móvil se hace con un payload comprimido y versionado en la URL, con validación de nicks, límite de tamaño y limpieza del enlace tras procesarlo.',
				category: 'Sincronización',
				surface: ['desktop', 'mobile-lite', 'shared'],
			},
			{
				type: 'improvement',
				description:
					'La importación de ignorados no borra filtros existentes: Los datos se fusionan, se evitan duplicados por nick y Ocultar gana sobre Silenciar cuando hay conflicto.',
				category: 'Sincronización',
				surface: ['desktop', 'mobile-lite', 'shared'],
			},
			{
				type: 'improvement',
				description:
					'El panel móvil se adapta mejor a distintos viewports y teclados en pantalla, recolocándose para que el input y los estados vacíos queden más cómodos.',
				category: 'Mobile Lite',
				surface: 'mobile-lite',
			},
			{
				type: 'improvement',
				description:
					'El importador móvil muestra confirmación, conteos de usuarios y un mensaje claro de importación completada antes de cerrar el panel.',
				category: 'Mobile Lite',
				surface: 'mobile-lite',
			},
			{
				type: 'fix',
				description:
					'Perfiles de usuario: Corregidos los separadores visuales de las filas de hilos cuando se muestran acciones Premium en listados de perfil.',
				category: 'Perfiles',
				surface: 'desktop',
			},
		],
	},
	{
		version: '2.0.0',
		date: '2026-06-01',
		title: 'Filtros 2.0, reglas de hilos y AniList',
		summary:
			'Mediavida Premium 2.0 reorganiza por completo la zona de Filtros, estrena reglas de hilos y añade AniList al editor para buscar anime y manga junto a las fichas de cine.',
		changes: [
			{
				type: 'feature',
				description:
					'Reglas de hilos: Nuevo sistema para destacar u ocultar hilos automáticamente cuando coinciden con un título, un autor real de Mediavida y uno o varios subforos.',
				category: 'Filtros',
			},
			{
				type: 'feature',
				description:
					'Centro de filtros: Palabras silenciadas, usuarios, hilos ocultos, subforos ocultos y reglas de hilos viven ahora en una misma pantalla con pestañas, para que todo lo relacionado con ocultar, silenciar o destacar contenido esté junto.',
				category: 'Ajustes',
			},
			{
				type: 'feature',
				description:
					'Creación rápida desde Mediavida: En los listados de hilos se puede crear una regla directamente desde el menú de acciones, usando el título o el autor del hilo como punto de partida.',
				category: 'Filtros',
			},
			{
				type: 'feature',
				description:
					'Importar y exportar filtros: La pantalla de Filtros permite guardar o restaurar solo reglas, palabras silenciadas, usuarios, hilos ocultos y subforos ocultos, sin tocar temas, borradores, plantillas ni el resto del dashboard.',
				category: 'Copia de seguridad',
			},
			{
				type: 'feature',
				description:
					'Borrado masivo de reglas: Las reglas creadas por ti pueden eliminarse de golpe respetando la búsqueda y la pestaña activa, con confirmación clara de cuántas reglas se van a borrar y de qué filtro salen.',
				category: 'Filtros',
			},
			{
				type: 'feature',
				description:
					'Gestión completa de reglas: Cada regla puede pausarse, duplicarse, editarse o eliminarse desde el dashboard, con confirmaciones para las acciones destructivas.',
				category: 'Filtros',
			},
			{
				type: 'feature',
				description:
					'Reglas activas o pausadas: Se puede pausar el sistema completo de reglas de hilos. Al hacerlo, las zonas de creación y edición quedan bloqueadas visualmente para evitar cambios accidentales.',
				category: 'Filtros',
			},
			{
				type: 'feature',
				description:
					'AniList en el editor: El botón de Cine del editor ahora también permite buscar anime y manga con AniList para insertar fichas enriquecidas en tus mensajes.',
				category: 'Editor',
			},
			{
				type: 'improvement',
				description:
					'Editor más cómodo: Añadido un botón para limpiar el contenido del editor rápidamente, útil cuando se quiere rehacer un borrador o empezar de cero sin seleccionar todo a mano.',
				category: 'Editor',
			},
			{
				type: 'improvement',
				description:
					'Nuevo diseño de Reglas de hilos: La pantalla muestra contadores de activas, destacadas y ocultas, tarjetas más expresivas, estados de pausa, chips de condición y tintes suaves que se adaptan al tema.',
				category: 'Diseño',
			},
			{
				type: 'improvement',
				description:
					'Las cards de reglas y subforos seleccionados usan colores derivados del preset activo, sin colores fijos, para que el diseño cambie correctamente al personalizar el dashboard.',
				category: 'Diseño',
			},
			{
				type: 'improvement',
				description:
					'Las insignias de estado como Destacado, Ocultado o Pausada respetan el radio de borde configurado en el tema, igual que el resto de componentes del dashboard.',
				category: 'Temas',
			},
			{
				type: 'improvement',
				description:
					'Acciones de hilo más limpias: Guardar, ocultar y crear reglas se agrupan en un menú Premium compacto de tres puntos para reducir ruido visual en los listados.',
				category: 'Mediavida',
			},
			{
				type: 'improvement',
				description:
					'El menú de tres puntos usa las variables visuales del tema del dashboard para que sus colores acompañen los presets y no quede desconectado del resto de la interfaz.',
				category: 'Temas',
			},
			{
				type: 'improvement',
				description:
					'El sidebar de Filtros abre por defecto Reglas de hilos cuando se entra desde otra zona, pero conserva la pestaña actual si ya se estaba navegando dentro de Filtros.',
				category: 'Navegación',
			},
			{
				type: 'improvement',
				description:
					'El grupo Filtros del sidebar vuelve a poder colapsarse aunque esté activo, manteniendo una navegación más predecible.',
				category: 'Navegación',
			},
			{
				type: 'improvement',
				description:
					'Mejoradas las validaciones al crear reglas: el título tiene límite de 100 caracteres y el autor debe tener entre 3 y 12 caracteres, alineado con la búsqueda de usuarios reales de Mediavida.',
				category: 'Filtros',
			},
			{
				type: 'improvement',
				description:
					'La búsqueda de autor en reglas explica que funciona como el directorio de usuarios y se limita a usuarios reales de Mediavida.',
				category: 'Filtros',
			},
			{
				type: 'improvement',
				description:
					'El selector de subforos en reglas marca cada subforo seleccionado con check y un coloreado suave derivado del tema, para distinguir mejor qué ámbito tendrá la regla.',
				category: 'Filtros',
			},
			{
				type: 'improvement',
				description:
					'Las reglas destacadas permiten elegir tinte de resaltado, y los listados de hilos aplican ese color de forma suave para diferenciar el contenido sin romper la lectura.',
				category: 'Mediavida',
			},
			{
				type: 'improvement',
				description:
					'Las reglas son reversibles y dinámicas: destacar u ocultar por regla no añade hilos a la lista manual de hilos ocultos, salvo que el usuario pulse explícitamente ocultar hilo.',
				category: 'Privacidad',
			},
			{
				type: 'improvement',
				description:
					'El menú compacto de hilos ya no mantiene colores fijos cuando se cambia de preset, y se integra mejor con el tema activo.',
				category: 'Temas',
			},
			{
				type: 'improvement',
				description:
					'El formulario de reglas evita duplicar información innecesaria del título y muestra las condiciones de forma más compacta y legible.',
				category: 'Diseño',
			},
			{
				type: 'improvement',
				description:
					'Los estados vacíos, filtros internos y paginación de reglas se comportan mejor cuando hay muchas reglas, búsquedas activas o pestañas sin resultados.',
				category: 'Filtros',
			},
			{
				type: 'improvement',
				description:
					'El importador manual de filtros también puede leer un backup global y extraer únicamente los datos de Filtros, evitando restaurar partes no deseadas del dashboard.',
				category: 'Copia de seguridad',
			},
			{
				type: 'fix',
				description:
					'Twitter Lite: Corregida la integración de embeds ligeros de Twitter/X, que podía dejar de funcionar y no mostrar correctamente algunos tweets.',
				category: 'Embeds',
			},
			{
				type: 'fix',
				description:
					'Calendario de juegos: Corregido un problema de overflow que podía hacer que el calendario se saliera de su contenedor o rompiera el layout en algunos tamaños de pantalla.',
				category: 'Juegos',
			},
			{
				type: 'improvement',
				description:
					'La copia de seguridad global sigue incluyendo todos los datos de filtros, y ahora se complementa con una exportación específica para quien solo quiera mover o compartir esa parte.',
				category: 'Copia de seguridad',
			},
			{
				type: 'improvement',
				description:
					'El diseño de Filtros se prepara mejor para futuros presets y cambios de tema usando variables del sistema visual en lugar de valores hardcodeados.',
				category: 'Temas',
			},
		],
	},
	{
		version: '1.9.0',
		date: '2026-05-29',
		title: 'Estrenos de cine, previews de hilos y ajustes más cómodos',
		summary:
			'Nuevo calendario de estrenos para Cine, previews del primer post en listados, mejoras importantes en ajustes y nuevas opciones para juegos, Steam e IsThereAnyDeal.',
		changes: [
			{
				type: 'feature',
				description:
					'Calendario de estrenos de Cine: Añadido un carrusel de próximos estrenos de películas en España con datos de TMDB, filtros por rango, vistas configurables y creación rápida de hilos con plantilla.',
				category: 'Cine',
			},
			{
				type: 'feature',
				description:
					'Previews de hilos: Los threads en subforos y Spy muestran una vista previa del primer post con texto, enlaces, embeds y controles para expandir o compartir el contenido.',
				category: 'Comunidad',
			},
			{
				type: 'feature',
				description:
					'Editor de juegos: Las fichas de juegos pueden insertar enlaces de Steam cuando están disponibles, usando datos enriquecidos de IGDB y Steam.',
				category: 'Editor',
			},
			{
				type: 'improvement',
				description:
					'Buscador de ofertas: Añadida selección de región para precios de IsThereAnyDeal, permitiendo ajustar las ofertas de juegos al mercado preferido.',
				category: 'Juegos',
			},
			{
				type: 'improvement',
				description:
					'Dashboard de ajustes: Reorganizada la navegación, mejorados los filtros y resultados de búsqueda, y refinado el resaltado de ajustes seleccionados.',
				category: 'Ajustes',
			},
			{
				type: 'improvement',
				description:
					'Calendarios de lanzamientos: Compartidos los controles de diseño entre juegos y cine, con mejoras visuales en tarjetas, carruseles y creación de hilos.',
				category: 'Diseño',
			},
			{
				type: 'fix',
				description:
					'Corregidos detalles de estado y tipado en las previews de hilos para mantener estable el comportamiento de contenido oculto y spoilers.',
				category: 'Comunidad',
			},
		],
	},
	{
		version: '1.8.0',
		date: '2026-05-24',
		title: 'Calendario de lanzamientos y creador rápido de hilos',
		summary:
			'Nuevo calendario de lanzamientos de juegos, creación rápida de hilos desde páginas externas y mejoras en ofertas, búsqueda, marcadores y subforos ocultos.',
		changes: [
			{
				type: 'feature',
				description:
					'Calendario de lanzamientos: Añadido un calendario de próximos juegos con filtros por plataforma, controles de vista, datos de IGDB y acceso desde el subforo Juegos.',
				category: 'Juegos',
			},
			{
				type: 'feature',
				description:
					'Crear hilo desde lanzamientos: Los juegos del calendario permiten preparar un hilo con plantilla y rellenar el editor de Mediavida automáticamente, también en la vista mínima.',
				category: 'Juegos',
			},
			{
				type: 'feature',
				description:
					'Creador rápido de hilos: Nueva herramienta para iniciar hilos desde páginas externas con subforos configurables, bandeja visual de edición, generación de BBCode y soporte para textos, enlaces y embeds multimedia.',
				category: 'Editor',
			},
			{
				type: 'improvement',
				description:
					'El buscador personalizado de Mediavida se adapta mejor al tema oscuro, con campo de búsqueda más cómodo, resultados más claros y una zona de clic del icono más precisa.',
				category: 'Búsqueda',
			},
			{
				type: 'improvement',
				description:
					'El buscador de ofertas de videojuegos también está disponible en Club de la hucha, con controles independientes para Juegos y Hucha desde ajustes y nuevos atajos para activar cada subforo por separado.',
				category: 'Juegos',
			},
			{
				type: 'improvement',
				description:
					'Mejorado el contraste de los checkboxes en el gestor de marcadores para que sean más legibles en distintos temas.',
				category: 'Accesibilidad',
			},
			{
				type: 'fix',
				description:
					'Los subforos ocultos también se respetan en la página de Spy, evitando que vuelvan a aparecer en esa vista.',
				category: 'Comunidad',
			},
		],
	},
	{
		version: '1.7.1',
		date: '2026-05-11',
		title: 'Buscador de ofertas más pulido',
		summary: 'Corrección de apertura del modal de juegos y pequeñas mejoras de interfaz en el buscador de ofertas.',
		changes: [
			{
				type: 'fix',
				description:
					'Corregido un problema en producción donde seleccionar un juego podía cerrar el desplegable en lugar de abrir el modal de detalle.',
				category: 'Juegos',
			},
			{
				type: 'improvement',
				description:
					'Mejorada la experiencia del buscador de ofertas con un modal más claro, botón para limpiar la búsqueda y estados de carga más estables.',
				category: 'Diseño',
			},
		],
	},
	{
		version: '1.7.0',
		date: '2026-05-09',
		title: 'Subforos ocultos y ofertas de juegos',
		summary:
			'Nueva gestión para ocultar subforos completos y un buscador premium de ofertas en el subforo Juegos con precios de IsThereAnyDeal.',
		changes: [
			{
				type: 'feature',
				description:
					'Ocultar subforos: Nuevo sistema para ocultar subforos desde la interfaz de Mediavida y gestionarlos cómodamente desde el dashboard.',
				category: 'Comunidad',
			},
			{
				type: 'feature',
				description:
					'Hilos de usuarios ignorados: Los hilos creados por usuarios que tienes ignorados de forma total dejan de mostrarse automáticamente en los listados de subforos donde Mediavida permite conocer el autor del hilo.',
				category: 'Comunidad',
			},
			{
				type: 'feature',
				description:
					'Buscador de ofertas en Juegos: Añadido un buscador en el subforo Juegos con resultados de IsThereAnyDeal, precios actuales, mínimos históricos, tiendas, descuentos y detalle por plataforma.',
				category: 'Juegos',
			},
			{
				type: 'improvement',
				description:
					'El buscador de ofertas puede activarse o desactivarse desde el dashboard y también mediante un atajo de teclado configurable.',
				category: 'Ajustes',
			},
			{
				type: 'improvement',
				description:
					'Mejorado el diseño de los resultados y del modal de detalle de juegos para mostrar la información de precios con más claridad.',
				category: 'Diseño',
			},
		],
	},
	{
		version: '1.6.1',
		date: '2026-04-12',
		title: 'Subforo de IA y Gemini',
		summary:
			'Soporte para el nuevo subforo de Inteligencia Artificial y simplificación de la integración de IA para usar Gemini como único proveedor.',
		changes: [
			{
				type: 'feature',
				description:
					'Nuevo subforo de Inteligencia Artificial: La extensión reconoce el subforo de IA en categorías, iconos, favoritos y detección de páginas.',
				category: 'Comunidad',
			},
			{
				type: 'improvement',
				description:
					'Gemini como único proveedor de IA: Eliminada la integración de Groq/Kimi de ajustes, permisos, privacidad y flujos de resumen.',
				category: 'Inteligencia Artificial',
			},
		],
	},
	{
		version: '1.6.0',
		date: '2026-03-23',
		title: 'Modo Trabajo y Personalización',
		summary:
			'Nuevo modo trabajo para navegar el foro discretamente, ocultar la cabecera de Mediavida, tamaño de fuente configurable en los posts y correcciones de estabilidad.',
		changes: [
			// NEW FEATURES
			{
				type: 'feature',
				description:
					'Modo Trabajo: Oculta avatares, imágenes, vídeos, embeds sociales, tarjetas de Steam e iconos de subforo para navegar el foro discretamente. Camufla la pestaña con título e icono neutros. Cada opción es configurable por separado.',
				category: 'Privacidad',
			},
			{
				type: 'feature',
				description:
					'Ocultar cabecera: Esconde la barra de navegación superior de Mediavida con un toggle en el dashboard o un atajo de teclado configurable. Se aplica al instante sin flash.',
				category: 'Diseño',
			},
			{
				type: 'feature',
				description:
					'Tamaño de fuente en posts: Ajusta el tamaño del texto de los posts entre 80% y 200% desde los ajustes.',
				category: 'Accesibilidad',
			},

			// FIXES
			{
				type: 'fix',
				description:
					'Corregido un problema donde las respuestas de usuarios ignorados hacían desaparecer el post del usuario no ignorado al que respondían.',
				category: 'Comunidad',
			},
		],
	},
	{
		version: '1.5.1',
		date: '2026-03-16',
		title: 'Editor en Perfil y Correcciones',
		summary:
			'La toolbar del editor ahora aparece en el campo de información del perfil, y corregido un problema visual con los tooltips de usuario.',
		changes: [
			{
				type: 'feature',
				description:
					'Toolbar del editor en el perfil: El campo de información personal en la configuración ahora incluye la barra de herramientas del editor.',
				category: 'Editor',
			},
			{
				type: 'fix',
				description:
					'Corregido en Edge un problema donde los tooltips nativos de Mediavida quedaban ocultos detrás de la tarjeta de usuario.',
				category: 'Diseño',
			},
		],
	},
	{
		version: '1.5.0',
		date: '2026-03-02',
		title: 'Análisis de Usuarios por IA',
		summary:
			'Nuevo modo de análisis por usuario con IA, tarjetas de Twitter adaptadas al tema claro nativo y correcciones de estabilidad.',
		changes: [
			// NEW FEATURES
			{
				type: 'feature',
				description:
					'Análisis de usuarios por IA: Filtra un hilo por usuario y pulsa los botones de análisis (una página o varias) para obtener un análisis detallado de su participación, tono, argumentos y postura.',
				category: 'Inteligencia Artificial',
			},

			// IMPROVEMENTS
			{
				type: 'improvement',
				description:
					'Las tarjetas de Twitter Lite ahora se muestran en modo claro cuando Mediavida usa el tema claro nativo, con mejor contraste en las métricas de engagement.',
				category: 'Multimedia',
			},

			// FIXES
			{
				type: 'fix',
				description:
					'Corregido un problema en Firefox donde tener Twitter Lite activo impedía dar manitas y pulsar el botón de marcadores.',
				category: 'Multimedia',
			},
			{
				type: 'fix',
				description:
					'La tarjeta de usuario (hover card) ya no queda oculta detrás de la barra de control en el modo de posts centrados.',
				category: 'Diseño',
			},
		],
	},
	{
		version: '1.4.1',
		date: '2026-02-24',
		title: 'Twitter Lite y Estabilidad',
		summary:
			'Embeds ligeros de Twitter/X con métricas de engagement, error boundaries en todas las funcionalidades, mejoras de accesibilidad y correcciones varias.',
		changes: [
			// NEW FEATURES
			{
				type: 'feature',
				description:
					'Embeds ligeros de Twitter/X: Los enlaces a tweets se renderizan como tarjetas compactas con avatar, texto, media e interacciones sin cargar el widget oficial.',
				category: 'Multimedia',
			},
			{
				type: 'feature',
				description:
					'Métricas de engagement en Twitter Lite: Las tarjetas muestran likes, respuestas y retweets con iconos estilo Twitter y colores distintivos.',
				category: 'Multimedia',
			},

			// IMPROVEMENTS
			{
				type: 'improvement',
				description:
					'Mayor estabilidad: Si una funcionalidad falla, se captura y registra sin afectar al resto de la extensión.',
				category: 'Estabilidad',
			},
			{
				type: 'improvement',
				description:
					'Accesibilidad mejorada: Atributos aria en componentes del dashboard, toast al copiar resumen de hilo, y colores de esqueleto adaptados al tema.',
				category: 'Accesibilidad',
			},

			// FIXES
			{
				type: 'fix',
				description: 'Corregido el renderizado de citas [quote=] en el dashboard y la vista previa en vivo.',
				category: 'Editor',
			},
			{
				type: 'fix',
				description:
					'El video flotante de YouTube se mantiene visible en el viewport tras hacer zoom en posts centrados.',
				category: 'Multimedia',
			},
			{
				type: 'fix',
				description:
					'Los botones de ocultar y guardar hilo ahora aparecen correctamente en nuevos mensajes del spy, y los hilos ocultos ya no reaparecen al recibir actividad.',
				category: 'Navegación',
			},
			{
				type: 'fix',
				description: 'El contador de caracteres ya no aparece al escribir mensajes privados.',
				category: 'Editor',
			},
		],
	},
	{
		version: '1.4.0',
		date: '2026-02-16',
		title: 'Tema de Mediavida y Homepage Rediseñada',
		summary:
			'Personaliza los colores de Mediavida con presets y temas propios, nueva homepage rediseñada, ocultar hilos, bundles de Steam, editor en MPs y respuestas inline, y muchas correcciones.',
		changes: [
			// NEW FEATURES
			{
				type: 'feature',
				description:
					'Tema de Mediavida: Cambia los colores del sitio a tu gusto con presets incluidos, temas personalizados, importar/exportar y aplicación en tiempo real.',
				category: 'Diseño',
			},
			{
				type: 'feature',
				description: 'Homepage rediseñada.',
				category: 'Diseño',
			},
			{
				type: 'feature',
				description:
					'Ocultar hilos: Esconde hilos desde el menú contextual o al pasar el ratón. Panel de gestión con búsqueda, acciones por lotes y desocultar.',
				category: 'Navegación',
			},
			{
				type: 'feature',
				description:
					'Tarjetas de bundles de Steam: Los enlaces a bundles muestran automáticamente una tarjeta con juegos incluidos, precio y descuento.',
				category: 'Multimedia',
			},
			{
				type: 'feature',
				description:
					'Toolbar del editor en respuestas inline y mensajes privados: Las mismas herramientas disponibles en la caja de respuesta rápida y en MPs.',
				category: 'Editor',
			},
			{
				type: 'feature',
				description:
					'Código inline [c]: Nuevo tag para escribir código en línea dentro de los posts, insertable desde la toolbar.',
				category: 'Editor',
			},
			{
				type: 'feature',
				description: 'Video flotante mejorado: Arrastrar, redimensionar y controles en todas las páginas de hilos.',
				category: 'Multimedia',
			},
			{
				type: 'feature',
				description:
					'Delay personalizable en modo Live (no nativo): Configura cada cuántos segundos se comprueban posts nuevos.',
				category: 'Navegación',
			},

			// IMPROVEMENTS
			{
				type: 'improvement',
				description:
					'Botones de guardar y ocultar hilo visibles al pasar el ratón en listados, spy, subforos y homepage.',
				category: 'Navegación',
			},
			{
				type: 'improvement',
				description:
					'Vista de hilos ocultos renovada: Selección múltiple, acciones por lotes, buscador y mejor organización.',
				category: 'Experiencia',
			},
			{
				type: 'improvement',
				description: 'Posts centrados ahora funcionan en spy y listados de subforos.',
				category: 'Diseño',
			},
			{
				type: 'improvement',
				description: 'Noticias de la homepage muestran autor y número de respuestas.',
				category: 'Diseño',
			},

			// FIXES
			{
				type: 'fix',
				description: 'Corregido aviso falso de "cambios sin guardar" al editar un post desde vista previa.',
				category: 'Editor',
			},
			{
				type: 'fix',
				description: 'La galería ahora sincroniza correctamente el contador en modo live.',
				category: 'Multimedia',
			},
			{
				type: 'fix',
				description: 'Ahora en modo live funciona correctamente el botón de responder citando.',
				category: 'Editor.',
			},
			{
				type: 'fix',
				description: 'Los likes en posts cargados por el modo live vuelven a ser clicables.',
				category: 'Navegación',
			},
			{
				type: 'fix',
				description: 'Subida de imágenes: Fallback si ImgBB falla.',
				category: 'Editor',
			},
			{
				type: 'fix',
				description: 'Los borradores se reinician correctamente al limpiar el editor.',
				category: 'Productividad',
			},
			{
				type: 'fix',
				description: 'Corregido bug visual del dashboard al entrar desde la homepage en Firefox.',
				category: 'Experiencia',
			},
		],
	},
	{
		version: '1.3.0',
		date: '2026-02-09',
		title: 'IA y Media Templates',
		summary:
			'Nuevo modo de Posts Centrados, integración con IGDB, sistema de Media Templates y resúmenes de hilo multi-página.',
		changes: [
			// NEW FEATURES
			{
				type: 'feature',
				description:
					'Modo Posts Centrados: Nuevo modo de visualización que centra los posts con una barra de control sticky.',
				category: 'Diseño',
			},
			{
				type: 'feature',
				description:
					'Integración con IGDB: Busca juegos y genera plantillas automáticas con toda la información (nombre, fecha, géneros, plataformas).',
				category: 'Multimedia',
			},
			{
				type: 'feature',
				description:
					'Sistema de Media Templates: Motor de plantillas completo para crear templates personalizados de medios (juegos, películas, series).',
				category: 'Productividad',
			},
			{
				type: 'feature',
				description:
					'Resumen multi-página: El resumidor de hilos ahora maneja hilos largos con múltiples páginas, generando resúmenes globales coherentes.',
				category: 'Inteligencia Artificial',
			},
			{
				type: 'feature',
				description: 'Nombres localizados en IGDB: Los juegos muestran su nombre en español cuando está disponible.',
				category: 'Multimedia',
			},

			// IMPROVEMENTS
			{
				type: 'improvement',
				description:
					'Resúmenes de posts más detallados: La IA genera resúmenes proporcionales al contenido, con detección de ironía y sarcasmo.',
				category: 'Inteligencia Artificial',
			},
			{
				type: 'improvement',
				description:
					'Editor mejorado: Smart center wrapping para encabezados y mejor detección de contenido multimedia.',
				category: 'Editor',
			},
			{
				type: 'improvement',
				description:
					'Arquitectura de IA refactorizada: Mejor separación entre providers para facilitar añadir nuevos modelos.',
				category: 'Inteligencia Artificial',
			},
			{
				type: 'improvement',
				description: 'Interfaz de gestión de Media Templates mejorada con documentación clara de variables y tipos.',
				category: 'Productividad',
			},

			// FIXES
			{
				type: 'fix',
				description: 'Tracking de edición de posts: Corregida la captura del título del hilo al editar desde post.php.',
				category: 'Experiencia',
			},
			{
				type: 'fix',
				description: 'Tracking de creación de hilos: Mejor detección y tracking diferido para respuestas.',
				category: 'Experiencia',
			},
			{
				type: 'fix',
				description: 'Solucionado race condition al eliminar o mover múltiples borradores a la vez.',
				category: 'Productividad',
			},
			{
				type: 'fix',
				description: 'Los ajustes ahora se sincronizan correctamente entre pestañas abiertas.',
				category: 'Experiencia',
			},
			{
				type: 'fix',
				description: 'Los campos de tipo lista en templates ahora se muestran correctamente en líneas separadas.',
				category: 'Productividad',
			},
		],
	},
	{
		version: '1.2.1',
		date: '2026-02-02',
		title: 'Mejoras de Estabilidad',
		summary:
			'Correcciones importantes para postits con video, scroll infinito y gestión de imágenes, además de mejoras en el dashboard.',
		changes: [
			{
				type: 'fix',
				description:
					'El botón de ocultar/mostrar del Post-it ahora es accesible aunque haya videos de YouTube/Twitch incrustados.',
				category: 'Navegación',
			},
			{
				type: 'feature',
				description: 'Nueva tarjeta de "Tiempo Total" en el Dashboard y mejoras en la rejilla.',
				category: 'Dashboard',
			},
			{
				type: 'feature',
				description: 'Cambiado servidor de imágenes por defecto a freeimage.host para mayor fiabilidad y velocidad.',
				category: 'Multimedia',
			},
			{
				type: 'fix',
				description:
					'El filtro de usuario (?u=...) y el botón de "Manita" ahora funcionan correctamente con el Scroll Infinito.',
				category: 'Navegación',
			},
			{
				type: 'feature',
				description: 'Pegado inteligente: Las URLs de Reddit ahora se etiquetan automáticamente en el editor.',
				category: 'Editor',
			},
			{
				type: 'fix',
				description:
					'Los botones de la extensión (Resumir, Guardar hilo) ahora aparecen correctamente para moderadores.',
				category: 'Comunidad',
			},
			{
				type: 'fix',
				description: 'Solucionado el parpadeo visual (flash) al cargar páginas con el modo Ultrawide activado.',
				category: 'Diseño',
			},
			{
				type: 'feature',
				description:
					'Opción para mantener la búsqueda nativa en lugar de reemplazarla por el Menú de Comandos (Ctrl+K).',
				category: 'Accesibilidad',
			},
			{
				type: 'improvement',
				description: 'Optimización de caché interna para evitar límites de almacenamiento en el navegador.',
				category: 'Rendimiento',
			},
		],
	},
	{
		version: '1.2.0',
		date: '2025-01-26',
		title: 'Mejoras en el Editor',
		summary: 'Nuevas formas de subir imágenes, mejoras en el scroll infinito y más opciones de personalización.',
		changes: [
			{
				type: 'feature',
				description:
					'Copia cualquier imagen de tu ordenador o haz una captura de pantalla y pégala directamente en el editor (Ctrl+V) para subirla.',
				category: 'Editor',
			},
			{
				type: 'feature',
				description: 'El scroll infinito ahora puede activarse automáticamente al entrar en un hilo.',
				category: 'Navegación',
			},
			{
				type: 'feature',
				description:
					'Los enlaces de YouTube Shorts se convierten automáticamente al formato estándar y se insertan con el auto-tag de media.',
				category: 'Editor',
			},
			{
				type: 'feature',
				description: 'Personaliza el icono del dashboard en la barra de navegación.',
				category: 'Diseño',
			},
			{
				type: 'fix',
				description: 'El color del texto en negrita ahora se aplica correctamente.',
				category: 'Diseño',
			},
			{
				type: 'fix',
				description: 'Giphy y TMDB vuelven a funcionar correctamente (solucionado problema con las API keys).',
				category: 'Multimedia',
			},
			{
				type: 'fix',
				description: 'Mejorada la compatibilidad del scroll infinito con Firefox.',
				category: 'Navegación',
			},
		],
	},
	{
		version: '1.1.0',
		date: '2025-01-09',
		title: 'Lanzamiento Oficial',
		summary:
			'La extensión definitiva para potenciar tu experiencia en Mediavida. Diseño moderno, herramientas avanzadas y personalización total.',
		changes: [
			// EXPERIENCE & DASHBOARD
			{
				type: 'feature',
				description: 'Dashboard personal integrado con estadísticas de uso y navegación en tiempo real.',
				category: 'Experiencia',
			},
			{
				type: 'feature',
				description: 'Heatmap de actividad anual interactivo estilo Github.',
				category: 'Experiencia',
			},
			{
				type: 'feature',
				description: 'Seguimiento preciso de tiempo de lectura por subforo.',
				category: 'Experiencia',
			},
			{
				type: 'feature',
				description: 'Panel de gestión de almacenamiento y configuración centralizada.',
				category: 'Experiencia',
			},
			{
				type: 'feature',
				description: 'Gestión masiva de favoritos y marcadores: Limpia y organiza tu contenido en segundos.',
				category: 'Experiencia',
			},

			// EDITOR & PRODUCTIVITY
			{
				type: 'feature',
				description: 'Live Editor: Ahora podrás ver en tiempo real lo que escribas.',
				category: 'Productividad',
			},
			{
				type: 'feature',
				description: 'Sistema de borradores inteligente: Guardado automático y gestor de versiones locales.',
				category: 'Productividad',
			},
			{
				type: 'feature',
				description: 'Sistema de plantillas: Ahora podrás crear plantillas para ahorrar tiempo y reutilizar contenido.',
				category: 'Productividad',
			},
			{
				type: 'feature',
				description: 'Barra de herramientas extendida con tablas, formato avanzado y atajos de teclado.',
				category: 'Productividad',
			},
			{
				type: 'feature',
				description: 'Carga de archivos multimedia mediante Drag & Drop directo al editor.',
				category: 'Productividad',
			},
			{
				type: 'feature',
				description: 'Posts Anclados: Fija contenido valioso en la parte superior del hilo para no perderlo nunca.',
				category: 'Productividad',
			},
			{
				type: 'feature',
				description: 'Marcadores de hilos: Guarda discusiones interesantes para leerlas más tarde.',
				category: 'Productividad',
			},

			// VISUAL & CUSTOMIZATION
			{
				type: 'feature',
				description:
					'Motor de temas: Personalización completa de interfaz (colores, bordes, tipografía). Solamente funciona con componentes React.',
				category: 'Diseño',
			},
			{
				type: 'feature',
				description: 'Podrás cambiar de tema con un solo clic (light, dark, system).',
				category: 'Diseño',
			},
			{
				type: 'feature',
				description: 'Inyección de componentes UI modernos usando Shadow DOM para aislamiento total.',
				category: 'Diseño',
			},
			{ type: 'feature', description: 'Generador de paletas de color armoniosas aleatorias.', category: 'Diseño' },

			// AI & INTELLIGENCE
			{
				type: 'feature',
				description:
					'Resumen de página con IA (Gemini): Entérate de qué se está hablando en la página actual al instante.',
				category: 'Inteligencia Artificial',
			},
			{
				type: 'feature',
				description: 'Resumen de Posts largos: ¿Mucho texto? Deja que la IA te haga un TL;DR instantáneo.',
				category: 'Inteligencia Artificial',
			},

			// NAVIGATION & DISCOVERY
			{
				type: 'feature',
				description: 'Scroll infinito: Navegación continua entre páginas de hilos sin recargas.',
				category: 'Navegación',
			},
			{
				type: 'feature',
				description: 'Live Thread: Actualización en tiempo real de nuevos posts sin refrescar.',
				category: 'Navegación',
			},
			{
				type: 'feature',
				description: 'Command Menu (Cmd+K): Navegación rápida global por teclado.',
				category: 'Navegación',
			},
			{
				type: 'feature',
				description:
					'Delay en LIVE nativos: Control de retraso configurable para evitar spoilers en hilos LIVE de Mediavida.',
				category: 'Navegación',
			},

			// MEDIA & ENRICHMENT
			{
				type: 'feature',
				description:
					'Botón de búsqueda TMDB en el editor: Crea fichas de películas y series perfectas automáticamente.',
				category: 'Multimedia',
			},
			{
				type: 'feature',
				description:
					'Cine & series: Hover cards con metadatos de TMDB/IMDb en enlaces que se encuentren en /cine o /tv.',
				category: 'Multimedia',
			},
			{
				type: 'feature',
				description: 'Galería inmersiva: Visualización de todas las imágenes de cada página de un hilo en grid.',
				category: 'Multimedia',
			},
			{ type: 'feature', description: 'Integración nativa de Giphy para inserción directa.', category: 'Multimedia' },
			{
				type: 'feature',
				description: 'Embeds automáticos optimizados para redes sociales (X, Instagram, TikTok).',
				category: 'Multimedia',
			},

			// COMMUNITY & PRIVACY
			{
				type: 'feature',
				description: 'Sistema de notas: Anotaciones privadas sobre usuarios visibles solo para ti.',
				category: 'Comunidad',
			},
			{ type: 'feature', description: 'Etiquetado avanzado de usuarios (tags personalizados).', category: 'Comunidad' },
			{
				type: 'feature',
				description: 'Bloqueo estricto de contenido: Silencia usuarios, firmas o palabras clave.',
				category: 'Comunidad',
			},
		],
	},
]

/**
 * Retrieves the most recent version string from the changelog.
 */
export function getLatestVersion(): string {
	return CHANGELOG[0]?.version ?? '0.0.0'
}

/**
 * Returns all updates released after a specific version.
 * @param version - The baseline version string
 */
export function getChangesSince(version: string): ChangelogEntry[] {
	const index = CHANGELOG.findIndex(entry => entry.version === version)
	if (index === -1) {
		// Version not found, return all
		return CHANGELOG
	}
	// Return only newer versions
	return CHANGELOG.slice(0, index)
}

/**
 * Calculates the total number of individual changes since a specific version.
 * @param version - The baseline version string
 */
export function countChangesSince(version: string): number {
	const entries = getChangesSince(version)
	return entries.reduce((count, entry) => count + entry.changes.length, 0)
}

/**
 * Aggregates unique category labels from a provided list of changes.
 * @param changes - Array of change entries
 */
export function getCategories(changes: ChangeEntry[]): string[] {
	const categories = new Set<string>()
	changes.forEach(change => {
		if (change.category) {
			categories.add(change.category)
		}
	})
	return Array.from(categories)
}
