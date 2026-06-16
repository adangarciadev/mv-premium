/**
 * Default Templates
 *
 * These templates replicate the hardcoded BBCode templates that were
 * previously in the TMDB service. They serve as the default templates
 * that users can customize.
 */

import type { MediaTemplate, TemplateType } from '@/types/templates'

// =============================================================================
// Movie Template (Default)
// =============================================================================

export const DEFAULT_MOVIE_TEMPLATE: MediaTemplate = {
	id: 'default-movie-template',
	type: 'movie',
	name: 'Plantilla de Película',
	isDefault: true,
	version: 1,
	blocks: [
		// Poster centered
		{
			id: 'movie-poster',
			type: 'field',
			field: 'posterUrl',
			wrapper: '[center]\n[img]{{content}}[/img]\n[/center]',
			conditional: true,
			addLineBreak: true,
		},
		// Director
		{
			id: 'movie-director',
			type: 'field',
			field: 'director',
			label: '[b]Director:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		// Screenplay
		{
			id: 'movie-screenplay',
			type: 'field',
			field: 'screenplay',
			label: '[b]Guion:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		// Cast
		{
			id: 'movie-cast',
			type: 'field',
			field: 'cast',
			label: '[b]Reparto:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		// Runtime
		{
			id: 'movie-runtime',
			type: 'field',
			field: 'runtime',
			label: '[b]Duración:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		// Genres - with dynamic label singular/plural
		{
			id: 'movie-genres',
			type: 'field',
			field: 'genres',
			label: '[b]Géneros:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: true,
		},
		// Synopsis section
		{
			id: 'movie-synopsis',
			type: 'field',
			field: 'overview',
			wrapper: '[bar]SINOPSIS[/bar]\n{{content}}',
			conditional: true,
			addLineBreak: true,
		},
		// Trailer section
		{
			id: 'movie-trailer',
			type: 'field',
			field: 'trailerUrl',
			wrapper: '[bar]TRAILER[/bar]\n[media]{{content}}[/media]',
			conditional: true,
			addLineBreak: true,
		},
		// Release date section
		{
			id: 'movie-release',
			type: 'field',
			field: 'releaseDate',
			wrapper: '[bar]ESTRENO[/bar]\n{{content}}',
			conditional: true,
			addLineBreak: false,
		},
	],
}

// =============================================================================
// TV Show Template (Default)
// =============================================================================

export const DEFAULT_TVSHOW_TEMPLATE: MediaTemplate = {
	id: 'default-tvshow-template',
	type: 'tvshow',
	name: 'Plantilla de Serie',
	isDefault: true,
	version: 1,
	blocks: [
		// Poster centered
		{
			id: 'tv-poster',
			type: 'field',
			field: 'posterUrl',
			wrapper: '[center]\n[img]{{content}}[/img]\n[/center]',
			conditional: true,
			addLineBreak: true,
		},
		// Creators
		{
			id: 'tv-creators',
			type: 'field',
			field: 'creators',
			label: '[b]Creadores:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		// Cast
		{
			id: 'tv-cast',
			type: 'field',
			field: 'cast',
			label: '[b]Reparto:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		// Genres
		{
			id: 'tv-genres',
			type: 'field',
			field: 'genres',
			label: '[b]Géneros:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		// Status
		{
			id: 'tv-status',
			type: 'field',
			field: 'status',
			label: '[b]Estado:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		// Episode runtime
		{
			id: 'tv-runtime',
			type: 'field',
			field: 'episodeRunTime',
			label: '[b]Duración por episodio:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		// Number of seasons
		{
			id: 'tv-seasons',
			type: 'field',
			field: 'numberOfSeasons',
			label: '[b]Temporadas:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		// Number of episodes
		{
			id: 'tv-episodes',
			type: 'field',
			field: 'numberOfEpisodes',
			label: '[b]Episodios:[/b] {{value}}',
			conditional: true,
			addLineBreak: true,
		},
		// Synopsis section
		{
			id: 'tv-synopsis',
			type: 'field',
			field: 'overview',
			wrapper: '[bar]SINOPSIS[/bar]\n{{content}}',
			conditional: true,
			addLineBreak: true,
		},
		// Seasons breakdown
		{
			id: 'tv-seasons-list',
			type: 'field',
			field: 'seasons',
			wrapper: '[bar]TEMPORADAS[/bar]\n{{content}}',
			separator: '\n',
			conditional: true,
			maxItems: 10,
			addLineBreak: true,
		},
		// Trailer section
		{
			id: 'tv-trailer',
			type: 'field',
			field: 'trailerUrl',
			wrapper: '[bar]TRAILER[/bar]\n[media]{{content}}[/media]',
			conditional: true,
			addLineBreak: true,
		},
		// Premiere date section
		{
			id: 'tv-premiere',
			type: 'field',
			field: 'firstAirDate',
			wrapper: '[bar]ESTRENO[/bar]\n{{content}}',
			conditional: true,
			addLineBreak: true,
		},
		// Networks section
		{
			id: 'tv-networks',
			type: 'field',
			field: 'networks',
			wrapper: '[bar]CADENA[/bar]\n{{content}}',
			separator: '\n',
			conditional: true,
			addLineBreak: false,
		},
	],
}

// =============================================================================
// Season Template (Default)
// =============================================================================

export const DEFAULT_SEASON_TEMPLATE: MediaTemplate = {
	id: 'default-season-template',
	type: 'season',
	name: 'Plantilla de Temporada',
	isDefault: true,
	version: 1,
	blocks: [
		// Poster centered
		{
			id: 'season-poster',
			type: 'field',
			field: 'posterUrl',
			wrapper: '[center]\n[img]{{content}}[/img]\n[/center]',
			conditional: true,
			addLineBreak: true,
		},
		// Creators
		{
			id: 'season-creators',
			type: 'field',
			field: 'seriesCreators',
			label: '[b]Creadores:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		// Cast
		{
			id: 'season-cast',
			type: 'field',
			field: 'seriesCast',
			label: '[b]Reparto:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		// Genres
		{
			id: 'season-genres',
			type: 'field',
			field: 'seriesGenres',
			label: '[b]Géneros:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		// Episode count
		{
			id: 'season-episode-count',
			type: 'field',
			field: 'episodeCount',
			label: '[b]Episodios:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		// Episode runtime
		{
			id: 'season-runtime',
			type: 'field',
			field: 'averageRuntime',
			label: '[b]Duración por episodio:[/b] {{value}}',
			conditional: true,
			addLineBreak: true,
		},
		// Synopsis section
		{
			id: 'season-synopsis',
			type: 'field',
			field: 'overview',
			wrapper: '[bar]SINOPSIS[/bar]\n{{content}}',
			conditional: true,
			addLineBreak: true,
		},
		// Episodes list
		{
			id: 'season-episodes-list',
			type: 'field',
			field: 'episodes',
			wrapper: '[bar]EPISODIOS[/bar]\n[b]Temporada {{seasonNumber}}[/b]\n{{content}}',
			separator: '\n',
			conditional: true,
			maxItems: 30,
			addLineBreak: true,
		},
		// Trailer section
		{
			id: 'season-trailer',
			type: 'field',
			field: 'trailerUrl',
			wrapper: '[bar]TRAILER[/bar]\n[media]{{content}}[/media]',
			conditional: true,
			addLineBreak: true,
		},
		// Air date section
		{
			id: 'season-premiere',
			type: 'field',
			field: 'airDate',
			wrapper: '[bar]ESTRENO[/bar]\n{{content}}',
			conditional: true,
			addLineBreak: true,
		},
		// Networks section
		{
			id: 'season-networks',
			type: 'field',
			field: 'networks',
			wrapper: '[bar]CADENA[/bar]\n{{content}}',
			separator: '\n',
			conditional: true,
			addLineBreak: false,
		},
	],
}

// =============================================================================
// Game Template (Default) - For IGDB
// =============================================================================

export const DEFAULT_GAME_TEMPLATE: MediaTemplate = {
	id: 'default-game-template',
	type: 'game',
	name: 'Plantilla de Videojuego',
	isDefault: true,
	version: 3,
	blocks: [
		// Cover centered
		{
			id: 'game-cover',
			type: 'field',
			field: 'coverUrl',
			wrapper: '[center]\n[img]{{content}}[/img]\n[/center]',
			conditional: true,
			addLineBreak: true,
		},
		// Developers
		{
			id: 'game-developers',
			type: 'field',
			field: 'developers',
			label: '[b]Desarrollador:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		// Publishers
		{
			id: 'game-publishers',
			type: 'field',
			field: 'publishers',
			label: '[b]Distribuidor:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		// Platforms
		{
			id: 'game-platforms',
			type: 'field',
			field: 'platforms',
			label: '[b]Plataformas:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		// Genres
		{
			id: 'game-genres',
			type: 'field',
			field: 'genres',
			label: '[b]Géneros:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		// Game modes
		{
			id: 'game-modes',
			type: 'field',
			field: 'gameModes',
			label: '[b]Modos de juego:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		// Player perspectives
		{
			id: 'game-perspectives',
			type: 'field',
			field: 'playerPerspectives',
			label: '[b]Perspectiva:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		// Game engine
		{
			id: 'game-engine',
			type: 'field',
			field: 'gameEngines',
			label: '[b]Motor:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		// Collection / Saga
		{
			id: 'game-collection',
			type: 'field',
			field: 'collection',
			label: '[b]Saga:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		// Summary section
		{
			id: 'game-summary',
			type: 'field',
			field: 'summary',
			wrapper: '[bar]ACERCA DE ESTE JUEGO[/bar]\n{{content}}',
			conditional: true,
			addLineBreak: true,
		},
		// Video/Trailer section
		{
			id: 'game-trailer',
			type: 'field',
			field: 'trailerUrl',
			wrapper: '[bar]TRAILER[/bar]\n\n[media]{{content}}[/media]',
			conditional: true,
			addLineBreak: true,
		},
		// Screenshots (URLs are already img-wrapped by the template engine for image arrays)
		{
			id: 'game-screenshots',
			type: 'field',
			field: 'screenshots',
			wrapper: '[bar]MEDIA[/bar]\n\n[center]\n{{content}}\n[/center]',
			separator: '\n',
			conditional: true,
			maxItems: 10,
			addLineBreak: true,
		},
		// Time to beat (fields shown conditionally, no section bar to avoid empty sections)
		{
			id: 'game-ttb-hastily',
			type: 'field',
			field: 'timeToBeatHastily',
			label: '[b]Historia principal:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		{
			id: 'game-ttb-normally',
			type: 'field',
			field: 'timeToBeatNormally',
			label: '[b]Historia + Extras:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		{
			id: 'game-ttb-completely',
			type: 'field',
			field: 'timeToBeatCompletely',
			label: '[b]Completista:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		// Similar games
		{
			id: 'game-similar',
			type: 'field',
			field: 'similarGames',
			wrapper: '[bar]JUEGOS SIMILARES[/bar]\n\n{{content}}',
			separator: ', ',
			conditional: true,
			addLineBreak: true,
		},
		// Steam store card (embedded via [media])
		{
			id: 'game-steam-card',
			type: 'field',
			field: 'steamStoreUrl',
			wrapper: '[bar]STEAM[/bar]\n\n[media]{{content}}[/media]',
			conditional: true,
			addLineBreak: true,
		},
		// Release dates (per-platform)
		{
			id: 'game-release',
			type: 'field',
			field: 'releaseDates',
			wrapper: '[bar]LANZAMIENTO[/bar]\n\n{{content}}',
			separator: '\n',
			conditional: true,
			addLineBreak: false,
		},
	],
}

// =============================================================================
// Mobile Game Template (Default) - For IGDB (Juegos de móvil)
// =============================================================================

export const DEFAULT_MOBILE_GAME_TEMPLATE: MediaTemplate = {
	id: 'default-mobile-game-template',
	type: 'mobile-game',
	name: 'Plantilla de Juego de Móvil',
	isDefault: true,
	version: 2,
	blocks: [
		// Cover centered
		{
			id: 'mgame-cover',
			type: 'field',
			field: 'coverUrl',
			wrapper: '[center]\n[img]{{content}}[/img]\n[/center]',
			conditional: true,
			addLineBreak: true,
		},
		// Developers
		{
			id: 'mgame-developers',
			type: 'field',
			field: 'developers',
			label: '[b]Desarrollador:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		// Publishers
		{
			id: 'mgame-publishers',
			type: 'field',
			field: 'publishers',
			label: '[b]Distribuidor:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		// Platforms
		{
			id: 'mgame-platforms',
			type: 'field',
			field: 'platforms',
			label: '[b]Plataformas:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		// Genres
		{
			id: 'mgame-genres',
			type: 'field',
			field: 'genres',
			label: '[b]Géneros:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		// Game modes
		{
			id: 'mgame-modes',
			type: 'field',
			field: 'gameModes',
			label: '[b]Modos de juego:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		// Collection / Saga
		{
			id: 'mgame-collection',
			type: 'field',
			field: 'collection',
			label: '[b]Saga:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		// Summary section
		{
			id: 'mgame-summary',
			type: 'field',
			field: 'summary',
			wrapper: '[bar]ACERCA DE ESTE JUEGO[/bar]\n{{content}}',
			conditional: true,
			addLineBreak: true,
		},
		// Video/Trailer section
		{
			id: 'mgame-trailer',
			type: 'field',
			field: 'trailerUrl',
			wrapper: '[bar]TRAILER[/bar]\n\n[media]{{content}}[/media]',
			conditional: true,
			addLineBreak: true,
		},
		// Screenshots
		{
			id: 'mgame-screenshots',
			type: 'field',
			field: 'screenshots',
			wrapper: '[bar]MEDIA[/bar]\n\n[center]\n{{content}}\n[/center]',
			separator: '\n',
			conditional: true,
			maxItems: 10,
			addLineBreak: true,
		},
		// Store cards: Mediavida natively embeds both Google Play and App Store
		// links via [media] (embed/googleplay.html and embed/itunes.html).
		// The DESCARGA bar rides on the Google Play block; if a game only has an
		// App Store link, the card still renders (without the section bar).
		{
			id: 'mgame-googleplay-card',
			type: 'field',
			field: 'googlePlayUrl',
			wrapper: '[bar]DESCARGA[/bar]\n\n[media]{{content}}[/media]',
			conditional: true,
			addLineBreak: true,
		},
		{
			id: 'mgame-appstore-card',
			type: 'field',
			field: 'appStoreUrl',
			wrapper: '[media]{{content}}[/media]',
			conditional: true,
			addLineBreak: true,
		},
		// Release dates (per-platform)
		{
			id: 'mgame-release',
			type: 'field',
			field: 'releaseDates',
			wrapper: '[bar]LANZAMIENTO[/bar]\n\n{{content}}',
			separator: '\n',
			conditional: true,
			addLineBreak: false,
		},
	],
}

// =============================================================================
// Anime Template (Default) - For AniList
// =============================================================================

export const DEFAULT_ANIME_TEMPLATE: MediaTemplate = {
	id: 'default-anime-template',
	type: 'anime',
	name: 'Plantilla de Anime',
	isDefault: true,
	version: 1,
	blocks: [
		{
			id: 'anime-banner',
			type: 'field',
			field: 'bannerUrl',
			wrapper: '[center]\n[img]{{content}}[/img]\n[/center]',
			conditional: true,
			addLineBreak: true,
		},
		{ id: 'anime-info-bar', type: 'raw', rawText: '[bar]INFO[/bar]', addLineBreak: false },
		{
			id: 'anime-title',
			type: 'field',
			field: 'title',
			label: '[b]Título:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		{
			id: 'anime-genres',
			type: 'field',
			field: 'genres',
			label: '[b]Género:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		{
			id: 'anime-source',
			type: 'field',
			field: 'source',
			label: '[b]Origen:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		{
			id: 'anime-demographic',
			type: 'field',
			field: 'demographic',
			label: '[b]Demografía:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		{
			id: 'anime-studios',
			type: 'field',
			field: 'studios',
			label: '[b]Estudio:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		{
			id: 'anime-episodes',
			type: 'field',
			field: 'episodes',
			label: '[b]Capítulos:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		{
			id: 'anime-premiere',
			type: 'field',
			field: 'startDate',
			label: '[b]Estreno:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		{
			id: 'anime-links',
			type: 'field',
			field: 'linksText',
			label: '[b]Enlaces:[/b] {{value}}',
			conditional: true,
			addLineBreak: true,
		},
		{
			id: 'anime-synopsis',
			type: 'field',
			field: 'overview',
			wrapper: '[bar]SINOPSIS[/bar]\n{{content}}',
			conditional: true,
			addLineBreak: true,
		},
		{
			id: 'anime-pv',
			type: 'field',
			field: 'trailerUrl',
			wrapper: '[bar]PV[/bar]\n[media]{{content}}[/media]',
			conditional: true,
			addLineBreak: false,
		},
	],
}

// =============================================================================
// Manga Template (Default) - For AniList
// =============================================================================

export const DEFAULT_MANGA_TEMPLATE: MediaTemplate = {
	id: 'default-manga-template',
	type: 'manga',
	name: 'Plantilla de Manga',
	isDefault: true,
	version: 1,
	blocks: [
		{
			id: 'manga-banner',
			type: 'field',
			field: 'bannerUrl',
			wrapper: '[center]\n[img]{{content}}[/img]\n[/center]',
			conditional: true,
			addLineBreak: true,
		},
		{ id: 'manga-info-bar', type: 'raw', rawText: '[bar]INFO[/bar]', addLineBreak: false },
		{
			id: 'manga-title',
			type: 'field',
			field: 'title',
			label: '[b]Título:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		{
			id: 'manga-genres',
			type: 'field',
			field: 'genres',
			label: '[b]Género:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		{
			id: 'manga-demographic',
			type: 'field',
			field: 'demographic',
			label: '[b]Demografía:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		{
			id: 'manga-authors',
			type: 'field',
			field: 'authors',
			label: '[b]Autor:[/b] {{value}}',
			separator: ', ',
			conditional: true,
			addLineBreak: false,
		},
		{
			id: 'manga-year',
			type: 'field',
			field: 'year',
			label: '[b]Año:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		{
			id: 'manga-status',
			type: 'field',
			field: 'status',
			label: '[b]Publicación:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		{
			id: 'manga-chapters',
			type: 'field',
			field: 'chapters',
			label: '[b]Capítulos:[/b] {{value}}',
			conditional: true,
			addLineBreak: false,
		},
		{
			id: 'manga-links',
			type: 'field',
			field: 'linksText',
			label: '[b]Enlaces:[/b] {{value}}',
			conditional: true,
			addLineBreak: true,
		},
		{
			id: 'manga-synopsis',
			type: 'field',
			field: 'overview',
			wrapper: '[bar]SINOPSIS[/bar]\n{{content}}',
			conditional: true,
			addLineBreak: false,
		},
	],
}

// =============================================================================
// Exports
// =============================================================================

/**
 * Get the default template for a given type
 */
export function getDefaultTemplate(type: TemplateType): MediaTemplate {
	switch (type) {
		case 'movie':
			return DEFAULT_MOVIE_TEMPLATE
		case 'tvshow':
			return DEFAULT_TVSHOW_TEMPLATE
		case 'season':
			return DEFAULT_SEASON_TEMPLATE
		case 'game':
			return DEFAULT_GAME_TEMPLATE
		case 'mobile-game':
			return DEFAULT_MOBILE_GAME_TEMPLATE
		case 'anime':
			return DEFAULT_ANIME_TEMPLATE
		case 'manga':
			return DEFAULT_MANGA_TEMPLATE
	}
}

/**
 * All default templates
 */
export const DEFAULT_TEMPLATES = {
	movie: DEFAULT_MOVIE_TEMPLATE,
	tvshow: DEFAULT_TVSHOW_TEMPLATE,
	season: DEFAULT_SEASON_TEMPLATE,
	game: DEFAULT_GAME_TEMPLATE,
	'mobile-game': DEFAULT_MOBILE_GAME_TEMPLATE,
	anime: DEFAULT_ANIME_TEMPLATE,
	manga: DEFAULT_MANGA_TEMPLATE,
} as const
