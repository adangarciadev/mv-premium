/**
 * Changelog - Registry of features and fixes per version.
 * This data is used to inform users about updates via the dashboard and badges.
 */

import { browser } from '#imports'

export interface ChangeEntry {
	type: 'feature' | 'fix' | 'improvement'
	description: string
	category?: string
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
		title: 'IA Multiprovider y Media Templates',
		summary:
			'Nuevo modo de Posts Centrados, integración con IGDB, sistema de Media Templates, soporte para Groq como proveedor de IA y resúmenes de hilo multi-página.',
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
				description: 'Soporte para Groq (Kimi K2): Nuevo proveedor de IA alternativo a Gemini, totalmente gratuito.',
				category: 'Inteligencia Artificial',
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
