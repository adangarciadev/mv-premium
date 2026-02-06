/**
 * Template System Types
 *
 * A flexible BBCode template system that allows users to customize
 * the format of media templates (movies, TV shows, seasons, games).
 *
 * Templates are composed of blocks that can be:
 * - Field blocks: Display a data field with optional label and wrapper
 * - Section blocks: Create bar separators with titles
 * - Raw blocks: Insert literal text
 *
 * Fields use placeholders like {{value}} that get replaced with actual data.
 */

// =============================================================================
// Template Types
// =============================================================================

/**
 * Types of media that can have templates
 */
export type TemplateType = 'movie' | 'tvshow' | 'season' | 'game'

/**
 * Types of blocks that compose a template
 */
export type TemplateBlockType = 'field' | 'section' | 'raw'

/**
 * A block that displays a data field
 */
export interface FieldBlock {
	id: string
	type: 'field'
	/** Field key to display (e.g., 'director', 'cast', 'posterUrl') */
	field: string
	/** Label template, uses {{value}} placeholder (e.g., "[b]Director:[/b] {{value}}") */
	label?: string
	/** Separator for array fields (default: ", ") */
	separator?: string
	/** Wrapper template, uses {{content}} placeholder (e.g., "[center]{{content}}[/center]") */
	wrapper?: string
	/** Only show if field has value (default: true) */
	conditional?: boolean
	/** Maximum items for array fields (0 = unlimited) */
	maxItems?: number
	/** Add blank line after this block */
	addLineBreak?: boolean
}

/**
 * A block that creates a BBCode bar section
 */
export interface SectionBlock {
	id: string
	type: 'section'
	/** Title for the section bar (e.g., "SINOPSIS") */
	sectionTitle: string
	/** Content field to display under the section */
	contentField?: string
	/** Add blank line after this block */
	addLineBreak?: boolean
}

/**
 * A block that inserts raw BBCode text
 */
export interface RawBlock {
	id: string
	type: 'raw'
	/** Raw BBCode text to insert */
	rawText: string
	/** Add blank line after this block */
	addLineBreak?: boolean
}

/**
 * Union type for all block types
 */
export type TemplateBlock = FieldBlock | SectionBlock | RawBlock

/**
 * A complete media template
 */
export interface MediaTemplate {
	id: string
	type: TemplateType
	name: string
	blocks: TemplateBlock[]
	/** Whether this is a system default template */
	isDefault?: boolean
	/** Template version for migrations */
	version?: number
}

// =============================================================================
// Field Definitions by Media Type
// =============================================================================

/**
 * Field metadata for the template editor
 */
export interface FieldDefinition {
	key: string
	label: string
	description: string
	isArray: boolean
	/** Example value for preview */
	example: string | string[]
	/** Data source indicator for user clarity */
	source?: 'igdb' | 'steam' | 'igdb+steam'
	/** Category for grouping in the sidebar (only used for game fields) */
	category?: string
}

/**
 * Available fields for movie templates
 */
export const MOVIE_FIELDS: FieldDefinition[] = [
	{ key: 'title', label: 'Título', description: 'Título en español', isArray: false, example: 'El Caballero Oscuro' },
	{
		key: 'originalTitle',
		label: 'Título original',
		description: 'Título en idioma original',
		isArray: false,
		example: 'The Dark Knight',
	},
	{ key: 'year', label: 'Año', description: 'Año de estreno', isArray: false, example: '2008' },
	{
		key: 'releaseDate',
		label: 'Fecha de estreno',
		description: 'Fecha completa formateada',
		isArray: false,
		example: '18 de julio de 2008',
	},
	{
		key: 'director',
		label: 'Director',
		description: 'Director de la película',
		isArray: false,
		example: 'Christopher Nolan',
	},
	{
		key: 'screenplay',
		label: 'Guion',
		description: 'Guionistas de la película',
		isArray: true,
		example: ['Jonathan Nolan', 'Christopher Nolan'],
	},
	{
		key: 'cast',
		label: 'Reparto',
		description: 'Actores principales',
		isArray: true,
		example: ['Christian Bale', 'Heath Ledger', 'Aaron Eckhart', 'Michael Caine', 'Gary Oldman'],
	},
	{
		key: 'genres',
		label: 'Géneros',
		description: 'Géneros de la película',
		isArray: true,
		example: ['Acción', 'Crimen', 'Drama'],
	},
	{ key: 'runtime', label: 'Duración', description: 'Duración en minutos', isArray: false, example: '152 min' },
	{
		key: 'overview',
		label: 'Sinopsis',
		description: 'Descripción de la trama',
		isArray: false,
		example:
			'Batman se enfrenta a un nuevo enemigo, el Joker, un criminal que siembra el caos en Gotham City y pone a prueba los límites éticos del héroe.',
	},
	{
		key: 'posterUrl',
		label: 'Póster',
		description: 'URL de la imagen del póster',
		isArray: false,
		example: 'https://image.tmdb.org/t/p/w500/poster.jpg',
	},
	{
		key: 'trailerUrl',
		label: 'Trailer',
		description: 'URL del trailer de YouTube',
		isArray: false,
		example: 'https://www.youtube.com/watch?v=EXeTwQWrcwY',
	},
	{ key: 'voteAverage', label: 'Puntuación', description: 'Puntuación media (0-10)', isArray: false, example: '8.5' },
]

/**
 * Available fields for TV show templates
 */
export const TVSHOW_FIELDS: FieldDefinition[] = [
	{ key: 'title', label: 'Título', description: 'Título en español', isArray: false, example: 'Breaking Bad' },
	{
		key: 'originalTitle',
		label: 'Título original',
		description: 'Título en idioma original',
		isArray: false,
		example: 'Breaking Bad',
	},
	{ key: 'year', label: 'Año', description: 'Año de estreno', isArray: false, example: '2008' },
	{
		key: 'firstAirDate',
		label: 'Fecha de estreno',
		description: 'Fecha del primer episodio',
		isArray: false,
		example: '20 de enero de 2008',
	},
	{
		key: 'creators',
		label: 'Creadores',
		description: 'Creadores de la serie',
		isArray: true,
		example: ['Vince Gilligan'],
	},
	{
		key: 'cast',
		label: 'Reparto',
		description: 'Actores principales',
		isArray: true,
		example: ['Bryan Cranston', 'Aaron Paul', 'Anna Gunn', 'Dean Norris'],
	},
	{ key: 'genres', label: 'Géneros', description: 'Géneros de la serie', isArray: true, example: ['Drama', 'Crimen'] },
	{
		key: 'episodeRunTime',
		label: 'Duración por episodio',
		description: 'Duración media de episodio',
		isArray: false,
		example: '47 min',
	},
	{
		key: 'numberOfSeasons',
		label: 'Temporadas',
		description: 'Número de temporadas',
		isArray: false,
		example: '5',
	},
	{
		key: 'numberOfEpisodes',
		label: 'Episodios',
		description: 'Número total de episodios',
		isArray: false,
		example: '62',
	},
	{ key: 'status', label: 'Estado', description: 'Estado de emisión', isArray: false, example: 'Finalizada' },
	{ key: 'type', label: 'Tipo', description: 'Tipo de serie', isArray: false, example: 'Serie' },
	{
		key: 'networks',
		label: 'Cadenas',
		description: 'Cadenas donde se emite',
		isArray: true,
		example: ['AMC'],
	},
	{
		key: 'overview',
		label: 'Sinopsis',
		description: 'Descripción de la trama',
		isArray: false,
		example:
			'Un profesor de química diagnosticado con cáncer de pulmón se asocia con un exalumno para fabricar y vender metanfetamina.',
	},
	{
		key: 'posterUrl',
		label: 'Póster',
		description: 'URL de la imagen del póster',
		isArray: false,
		example: 'https://image.tmdb.org/t/p/w500/poster.jpg',
	},
	{
		key: 'trailerUrl',
		label: 'Trailer',
		description: 'URL del trailer de YouTube',
		isArray: false,
		example: 'https://www.youtube.com/watch?v=HhesaQXLuRY',
	},
	{ key: 'voteAverage', label: 'Puntuación', description: 'Puntuación media (0-10)', isArray: false, example: '9.5' },
	{
		key: 'seasons',
		label: 'Desglose de temporadas',
		description: 'Lista de temporadas con episodios',
		isArray: true,
		example: ['Temporada 1 (2008): 7 episodios', 'Temporada 2 (2009): 13 episodios'],
	},
]

/**
 * Available fields for season templates
 */
export const SEASON_FIELDS: FieldDefinition[] = [
	{
		key: 'seriesTitle',
		label: 'Título de la serie',
		description: 'Nombre de la serie',
		isArray: false,
		example: 'Breaking Bad',
	},
	{
		key: 'seasonNumber',
		label: 'Número de temporada',
		description: 'Número de la temporada',
		isArray: false,
		example: '5',
	},
	{
		key: 'seasonName',
		label: 'Nombre de temporada',
		description: 'Nombre de la temporada',
		isArray: false,
		example: 'Temporada 5',
	},
	{ key: 'year', label: 'Año', description: 'Año de estreno de la temporada', isArray: false, example: '2012' },
	{
		key: 'episodeCount',
		label: 'Episodios',
		description: 'Número de episodios',
		isArray: false,
		example: '16',
	},
	{
		key: 'averageRuntime',
		label: 'Duración por episodio',
		description: 'Duración media de episodio',
		isArray: false,
		example: '47 min',
	},
	{
		key: 'overview',
		label: 'Sinopsis',
		description: 'Descripción de la temporada',
		isArray: false,
		example:
			'Walter White se ha convertido en Heisenberg. Ahora debe lidiar con las consecuencias de sus acciones mientras construye su imperio.',
	},
	{
		key: 'posterUrl',
		label: 'Póster',
		description: 'URL del póster de temporada',
		isArray: false,
		example: 'https://image.tmdb.org/t/p/w500/poster.jpg',
	},
	{
		key: 'trailerUrl',
		label: 'Trailer',
		description: 'URL del trailer de YouTube',
		isArray: false,
		example: 'https://www.youtube.com/watch?v=HhesaQXLuRY',
	},
	{
		key: 'airDate',
		label: 'Fecha de estreno',
		description: 'Fecha del primer episodio de temporada',
		isArray: false,
		example: '15 de julio de 2012',
	},
	{
		key: 'seriesCreators',
		label: 'Creadores',
		description: 'Creadores de la serie',
		isArray: true,
		example: ['Vince Gilligan'],
	},
	{
		key: 'seriesCast',
		label: 'Reparto',
		description: 'Reparto principal',
		isArray: true,
		example: ['Bryan Cranston', 'Aaron Paul', 'Anna Gunn'],
	},
	{
		key: 'seriesGenres',
		label: 'Géneros',
		description: 'Géneros de la serie',
		isArray: true,
		example: ['Drama', 'Crimen'],
	},
	{
		key: 'networks',
		label: 'Cadenas',
		description: 'Cadenas donde se emite',
		isArray: true,
		example: ['AMC'],
	},
	{
		key: 'episodes',
		label: 'Lista de episodios',
		description: 'Episodios de la temporada',
		isArray: true,
		example: ['1. Live Free or Die', '2. Madrigal', '3. Hazard Pay'],
	},
]

/**
 * Available fields for game templates (IGDB)
 */
export const GAME_FIELDS: FieldDefinition[] = [
	// -- Información --
	{
		key: 'name',
		label: 'Nombre',
		description: 'Nombre del juego (localizado si existe)',
		isArray: false,
		example: 'The Witcher 3: Wild Hunt',
		source: 'igdb',
		category: 'Información',
	},
	{
		key: 'originalName',
		label: 'Nombre original',
		description: 'Nombre original del juego en IGDB (sin localizar)',
		isArray: false,
		example: 'The Witcher 3: Wild Hunt',
		source: 'igdb',
		category: 'Información',
	},
	{
		key: 'releaseDate',
		label: 'Fecha de lanzamiento',
		description: 'Fecha formateada en español (ej: "19 de mayo de 2015")',
		isArray: false,
		example: '19 de mayo de 2015',
		source: 'igdb',
		category: 'Información',
	},
	{
		key: 'releaseYear',
		label: 'Año de lanzamiento',
		description: 'Solo el año de salida',
		isArray: false,
		example: '2015',
		source: 'igdb',
		category: 'Información',
	},
	{
		key: 'releaseDates',
		label: 'Fechas por plataforma',
		description: 'Fechas de salida desglosadas por plataforma',
		isArray: true,
		example: ['PC: 19/05/2015', 'PS4: 19/05/2015', 'Switch: 15/10/2019'],
		source: 'igdb',
		category: 'Información',
	},
	{
		key: 'status',
		label: 'Estado',
		description: 'Estado de lanzamiento (Lanzado, Acceso anticipado, Cancelado...)',
		isArray: false,
		example: 'Lanzado',
		source: 'igdb',
		category: 'Información',
	},
	{
		key: 'collection',
		label: 'Saga',
		description: 'Saga o franquicia a la que pertenece',
		isArray: false,
		example: 'The Witcher',
		source: 'igdb',
		category: 'Información',
	},
	{
		key: 'ageRating',
		label: 'Clasificación por edad',
		description: 'Clasificación PEGI',
		isArray: false,
		example: 'PEGI 18',
		source: 'igdb',
		category: 'Información',
	},

	// -- Compañías --
	{
		key: 'developers',
		label: 'Desarrolladores',
		description: 'Estudios desarrolladores del juego',
		isArray: true,
		example: ['CD Projekt Red'],
		source: 'igdb',
		category: 'Compañías',
	},
	{
		key: 'publishers',
		label: 'Distribuidores',
		description: 'Compañías distribuidoras',
		isArray: true,
		example: ['CD Projekt', 'Bandai Namco'],
		source: 'igdb',
		category: 'Compañías',
	},

	// -- Gameplay --
	{
		key: 'platforms',
		label: 'Plataformas',
		description: 'Plataformas en las que está disponible',
		isArray: true,
		example: ['PC', 'PlayStation 4', 'Xbox One', 'Nintendo Switch'],
		source: 'igdb',
		category: 'Gameplay',
	},
	{
		key: 'genres',
		label: 'Géneros',
		description: 'Géneros traducidos al español',
		isArray: true,
		example: ['RPG', 'Aventura'],
		source: 'igdb',
		category: 'Gameplay',
	},
	{
		key: 'themes',
		label: 'Temáticas',
		description: 'Temáticas del juego traducidas al español',
		isArray: true,
		example: ['Fantasía', 'Mundo abierto'],
		source: 'igdb',
		category: 'Gameplay',
	},
	{
		key: 'gameModes',
		label: 'Modos de juego',
		description: 'Modos disponibles (un jugador, multijugador...)',
		isArray: true,
		example: ['Un jugador'],
		source: 'igdb',
		category: 'Gameplay',
	},
	{
		key: 'playerPerspectives',
		label: 'Perspectiva',
		description: 'Perspectiva del jugador (primera persona, tercera persona...)',
		isArray: true,
		example: ['Tercera persona'],
		source: 'igdb',
		category: 'Gameplay',
	},
	{
		key: 'gameEngines',
		label: 'Motor gráfico',
		description: 'Motor/es gráfico/s utilizados',
		isArray: true,
		example: ['REDengine 3'],
		source: 'igdb',
		category: 'Gameplay',
	},

	// -- Descripción --
	{
		key: 'summary',
		label: 'Acerca de este juego',
		description:
			'Texto de la sección "Acerca de este juego" de Steam en español. Si el juego no está en Steam, se usa el resumen de IGDB (en inglés)',
		isArray: false,
		example:
			'Eres Geralt de Rivia, cazador de monstruos, en busca de tu hija adoptiva en un mundo devastado por la guerra.',
		source: 'igdb+steam',
		category: 'Descripción',
	},
	{
		key: 'storyline',
		label: 'Historia',
		description: 'Breve sinopsis de la trama (en inglés). No todos los juegos la tienen',
		isArray: false,
		example: 'La historia sigue a Geralt mientras busca a Ciri...',
		source: 'igdb',
		category: 'Descripción',
	},

	// -- Multimedia --
	{
		key: 'coverUrl',
		label: 'Carátula',
		description: 'Imagen de portada del juego',
		isArray: false,
		example: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1r76.jpg',
		source: 'igdb',
		category: 'Multimedia',
	},
	{
		key: 'steamLibraryHeaderUrl',
		label: 'Cabecera Steam',
		description: 'Imagen de cabecera ancha de la librería de Steam (alta resolución)',
		isArray: false,
		example: 'https://cdn.akamai.steamstatic.com/steam/apps/292030/library_header_2x.jpg',
		source: 'steam',
		category: 'Multimedia',
	},
	{
		key: 'screenshots',
		label: 'Capturas IGDB',
		description: 'Capturas de pantalla en 1080p',
		isArray: true,
		example: ['https://images.igdb.com/igdb/image/upload/t_1080p/screenshot1.jpg'],
		source: 'igdb',
		category: 'Multimedia',
	},
	{
		key: 'steamScreenshots',
		label: 'Capturas Steam',
		description: 'Capturas de pantalla a resolución completa',
		isArray: true,
		example: ['https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/ss_1.jpg'],
		source: 'steam',
		category: 'Multimedia',
	},
	{
		key: 'artworks',
		label: 'Artworks',
		description: 'Arte promocional y fondos en alta calidad',
		isArray: true,
		example: ['https://images.igdb.com/igdb/image/upload/t_1080p/artwork1.jpg'],
		source: 'igdb',
		category: 'Multimedia',
	},
	{
		key: 'trailerUrl',
		label: 'Trailer',
		description: 'URL del trailer principal de YouTube',
		isArray: false,
		example: 'https://www.youtube.com/watch?v=c0i88t0Kacs',
		source: 'igdb',
		category: 'Multimedia',
	},
	{
		key: 'trailers',
		label: 'Trailers',
		description: 'Todos los trailers disponibles',
		isArray: true,
		example: ['Gameplay Trailer: https://youtube.com/...'],
		source: 'igdb',
		category: 'Multimedia',
	},

	// -- Duración --
	{
		key: 'timeToBeatHastily',
		label: 'Duración (rápido)',
		description: 'Tiempo para completar solo la historia principal',
		isArray: false,
		example: '25h 30min',
		source: 'igdb',
		category: 'Duración',
	},
	{
		key: 'timeToBeatNormally',
		label: 'Duración (normal)',
		description: 'Tiempo para historia principal + extras',
		isArray: false,
		example: '51h 45min',
		source: 'igdb',
		category: 'Duración',
	},
	{
		key: 'timeToBeatCompletely',
		label: 'Duración (completista)',
		description: 'Tiempo para completar al 100%',
		isArray: false,
		example: '103h 20min',
		source: 'igdb',
		category: 'Duración',
	},

	// -- Puntuaciones --
	{
		key: 'rating',
		label: 'Puntuación',
		description: 'Puntuación de usuarios (0-100)',
		isArray: false,
		example: '92',
		source: 'igdb',
		category: 'Puntuaciones',
	},
	{
		key: 'aggregatedRating',
		label: 'Puntuación crítica',
		description: 'Media de críticos (0-100)',
		isArray: false,
		example: '93',
		source: 'igdb',
		category: 'Puntuaciones',
	},
	{
		key: 'totalRating',
		label: 'Puntuación total',
		description: 'Media global (0-100)',
		isArray: false,
		example: '92',
		source: 'igdb',
		category: 'Puntuaciones',
	},

	// -- Tiendas y enlaces --
	{
		key: 'websites',
		label: 'Enlaces',
		description: 'Enlaces oficiales y tiendas del juego',
		isArray: true,
		example: ['https://thewitcher.com', 'https://store.steampowered.com/app/292030'],
		source: 'igdb',
		category: 'Tiendas y enlaces',
	},
	{
		key: 'externalGames',
		label: 'Enlaces externos',
		description: 'Enlaces a tiendas (Steam, GOG, Epic...)',
		isArray: true,
		example: ['Steam: https://store.steampowered.com/app/292030'],
		source: 'igdb',
		category: 'Tiendas y enlaces',
	},
	{
		key: 'steamStoreUrl',
		label: 'Tarjeta de Steam',
		description: 'URL de Steam para incrustar como tarjeta con [media]',
		isArray: false,
		example: 'https://store.steampowered.com/app/292030',
		source: 'steam',
		category: 'Tiendas y enlaces',
	},

	// -- Otros --
	{
		key: 'languageSupports',
		label: 'Idiomas',
		description: 'Idiomas y tipos de soporte (voces, subtítulos, interfaz)',
		isArray: true,
		example: ['Español (Voces)', 'Español (Subtítulos)', 'Inglés (Interfaz)'],
		source: 'igdb',
		category: 'Otros',
	},
	{
		key: 'similarGames',
		label: 'Juegos similares',
		description: 'Juegos similares recomendados por IGDB',
		isArray: true,
		example: ['The Witcher 2', 'Dragon Age: Inquisition'],
		source: 'igdb',
		category: 'Otros',
	},
	{
		key: 'dlcs',
		label: 'DLCs',
		description: 'Contenido descargable disponible',
		isArray: true,
		example: ['Hearts of Stone', 'Blood and Wine'],
		source: 'igdb',
		category: 'Otros',
	},
]

/**
 * Get field definitions for a template type
 */
export function getFieldsForType(type: TemplateType): FieldDefinition[] {
	switch (type) {
		case 'movie':
			return MOVIE_FIELDS
		case 'tvshow':
			return TVSHOW_FIELDS
		case 'season':
			return SEASON_FIELDS
		case 'game':
			return GAME_FIELDS
	}
}

// =============================================================================
// Template Store Types
// =============================================================================

/**
 * User's custom templates stored in settings
 */
export interface UserTemplates {
	movie: MediaTemplate | null
	tvshow: MediaTemplate | null
	season: MediaTemplate | null
	game: MediaTemplate | null
}

/**
 * Default empty templates state
 */
export const DEFAULT_USER_TEMPLATES: UserTemplates = {
	movie: null,
	tvshow: null,
	season: null,
	game: null,
}

// =============================================================================
// Template Data Types (Input to template engine)
// =============================================================================

/**
 * Data structure for movie templates
 * Matches MovieTemplateData from TMDB service
 */
export interface MovieTemplateDataInput {
	title: string
	originalTitle: string
	year: string
	director: string
	screenplay: string[]
	cast: string[]
	genres: string[]
	runtime: number
	overview: string
	posterUrl: string | null
	trailerUrl: string | null
	releaseDate: string | null
	voteAverage: number
}

/**
 * Data structure for TV show templates
 * Matches TVShowTemplateData from TMDB service
 */
export interface TVShowTemplateDataInput {
	title: string
	originalTitle: string
	year: string
	creators: string[]
	cast: string[]
	genres: string[]
	episodeRunTime: number
	numberOfSeasons: number
	numberOfEpisodes: number
	status: string
	type: string
	networks: { name: string; logoUrl: string | null }[]
	overview: string
	posterUrl: string | null
	trailerUrl: string | null
	firstAirDate: string | null
	lastAirDate: string | null
	voteAverage: number
	seasons: {
		number: number
		name: string
		episodeCount: number
		airDate: string | null
	}[]
}

/**
 * Data structure for season templates
 * Matches SeasonTemplateData from TMDB service
 */
export interface SeasonTemplateDataInput {
	seriesTitle: string
	seasonNumber: number
	seasonName: string
	year: string
	overview: string
	episodeCount: number
	averageRuntime: number
	posterUrl: string | null
	trailerUrl: string | null
	airDate: string | null
	voteAverage: number
	networks: { name: string; logoUrl: string | null }[]
	episodes: { number: number; name: string; airDate: string | null }[]
	seriesGenres: string[]
	seriesCreators: string[]
	seriesCast: string[]
	seriesStatus: string
}

/**
 * Data structure for game templates (IGDB)
 */
export interface GameTemplateDataInput {
	name: string
	originalName: string
	releaseDate: string | null
	releaseYear: string | null
	releaseDates: string[]
	status: string | null
	developers: string[]
	publishers: string[]
	platforms: string[]
	genres: string[]
	themes: string[]
	gameModes: string[]
	playerPerspectives: string[]
	gameEngines: string[]
	collection: string | null
	summary: string
	detailedDescription: string | null
	storyline: string | null
	coverUrl: string | null
	steamLibraryHeaderUrl: string | null
	screenshots: string[]
	steamScreenshots: string[]
	artworks: string[]
	trailerUrl: string | null
	trailers: { name: string; url: string }[]
	similarGames: { name: string; coverUrl: string | null }[]
	dlcs: string[]
	timeToBeatHastily: string | null
	timeToBeatNormally: string | null
	timeToBeatCompletely: string | null
	websites: { category: string; url: string }[]
	externalGames: string[]
	steamStoreUrl: string | null
	languageSupports: string[]
	rating: number | null
	aggregatedRating: number | null
	totalRating: number | null
	ageRating: string | null
}

/**
 * Union type for all template data inputs
 */
export type TemplateDataInput =
	| MovieTemplateDataInput
	| TVShowTemplateDataInput
	| SeasonTemplateDataInput
	| GameTemplateDataInput
