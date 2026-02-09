/**
 * Changelog - Registry of features and fixes per version.
 * This data is used to inform users about updates via the dashboard and badges.
 */

import { browser } from "#imports"

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
		version: '1.2.2',
		date: '2026-02-09',
		title: 'Nueva Homepage y Fuente Monoespaciada',
		summary:
			'Reemplazo completo de la página de inicio con un dashboard personalizado y opción de fuente monoespaciada para todo el sitio. Portado desde mv-ignited.',
		changes: [
			{
				type: 'feature',
				description:
					'Nueva Homepage: Dashboard personalizado con noticias, últimos hilos del foro, tus últimos posts y favoritos. Se actualiza automáticamente.',
				category: 'Experiencia',
			},
			{
				type: 'feature',
				description:
					'Foros visitados recientemente: Accesos directos a tus subforos más visitados desde la homepage.',
				category: 'Experiencia',
			},
			{
				type: 'feature',
				description:
					'Fuente Monoespaciada: Opción para aplicar tipografía monospace a todo el sitio desde los ajustes.',
				category: 'Diseño',
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
				description: 'El filtro de usuario (?u=...) y el botón de "Manita" ahora funcionan correctamente con el Scroll Infinito.',
				category: 'Navegación',
			},
			{
				type: 'feature',
				description: 'Pegado inteligente: Las URLs de Reddit ahora se etiquetan automáticamente en el editor.',
				category: 'Editor',
			},
			{
				type: 'fix',
				description: 'Los botones de la extensión (Resumir, Guardar hilo) ahora aparecen correctamente para moderadores.',
				category: 'Comunidad',
			},
			{
				type: 'fix',
				description: 'Solucionado el parpadeo visual (flash) al cargar páginas con el modo Ultrawide activado.',
				category: 'Diseño',
			},
			{
				type: 'feature',
				description: 'Opción para mantener la búsqueda nativa en lugar de reemplazarla por el Menú de Comandos (Ctrl+K).',
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
		summary:
			'Nuevas formas de subir imágenes, mejoras en el scroll infinito y más opciones de personalización.',
		changes: [
			{
				type: 'feature',
				description: 'Copia cualquier imagen de tu ordenador o haz una captura de pantalla y pégala directamente en el editor (Ctrl+V) para subirla.',
				category: 'Editor',
			},
			{
				type: 'feature',
				description: 'El scroll infinito ahora puede activarse automáticamente al entrar en un hilo.',
				category: 'Navegación',
			},
			{
				type: 'feature',
				description: 'Los enlaces de YouTube Shorts se convierten automáticamente al formato estándar y se insertan con el auto-tag de media.',
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
				description: 'Delay en LIVE nativos: Control de retraso configurable para evitar spoilers en hilos LIVE de Mediavida.',
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
