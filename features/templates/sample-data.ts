/**
 * Sample Data for Template Preview
 *
 * These sample data objects are used in the template editor to show
 * a live preview of how the template will look with real data.
 */

import type {
	MovieTemplateDataInput,
	TVShowTemplateDataInput,
	SeasonTemplateDataInput,
	GameTemplateDataInput,
} from '@/types/templates'

// =============================================================================
// Sample Movie Data
// =============================================================================

export const SAMPLE_MOVIE_DATA: MovieTemplateDataInput = {
	title: 'El Caballero Oscuro',
	originalTitle: 'The Dark Knight',
	year: '2008',
	director: 'Christopher Nolan',
	screenplay: ['Jonathan Nolan', 'Christopher Nolan'],
	cast: ['Christian Bale', 'Heath Ledger', 'Aaron Eckhart', 'Michael Caine', 'Gary Oldman'],
	genres: ['Acción', 'Crimen', 'Drama'],
	runtime: 152,
	overview:
		'Batman se enfrenta a un nuevo enemigo, el Joker, un criminal que siembra el caos en Gotham City y pone a prueba los límites éticos del héroe enmascarado. Con la ayuda del teniente Jim Gordon y el fiscal del distrito Harvey Dent, Batman intenta desmantelar las organizaciones criminales que plagan las calles, pero el Joker tiene otros planes que pondrán a prueba la determinación de todos.',
	posterUrl: 'https://image.tmdb.org/t/p/w500/1hRoyzDtpgMU7Dz4JF22RANzQO7.jpg',
	trailerUrl: 'https://www.youtube.com/watch?v=EXeTwQWrcwY',
	releaseDate: '2008-07-18',
	voteAverage: 8.5,
}

// =============================================================================
// Sample TV Show Data
// =============================================================================

export const SAMPLE_TVSHOW_DATA: TVShowTemplateDataInput = {
	title: 'Breaking Bad',
	originalTitle: 'Breaking Bad',
	year: '2008',
	creators: ['Vince Gilligan'],
	cast: ['Bryan Cranston', 'Aaron Paul', 'Anna Gunn', 'Dean Norris', 'Betsy Brandt', 'RJ Mitte'],
	genres: ['Drama', 'Crimen', 'Suspense'],
	episodeRunTime: 47,
	numberOfSeasons: 5,
	numberOfEpisodes: 62,
	status: 'Finalizada',
	type: 'Serie',
	networks: [
		{
			name: 'AMC',
			logoUrl: 'https://image.tmdb.org/t/p/w154/pmvRmATOCaDykE6JrVoeYpGmruT.png',
		},
	],
	overview:
		'Walter White, un profesor de química de Albuquerque diagnosticado con cáncer de pulmón terminal, se asocia con un antiguo alumno, Jesse Pinkman, para fabricar y vender metanfetamina con el fin de asegurar el futuro financiero de su familia antes de morir.',
	posterUrl: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
	trailerUrl: 'https://www.youtube.com/watch?v=HhesaQXLuRY',
	firstAirDate: '2008-01-20',
	lastAirDate: '2013-09-29',
	voteAverage: 9.5,
	seasons: [
		{ number: 1, name: 'Temporada 1', episodeCount: 7, airDate: '2008-01-20' },
		{ number: 2, name: 'Temporada 2', episodeCount: 13, airDate: '2009-03-08' },
		{ number: 3, name: 'Temporada 3', episodeCount: 13, airDate: '2010-03-21' },
		{ number: 4, name: 'Temporada 4', episodeCount: 13, airDate: '2011-07-17' },
		{ number: 5, name: 'Temporada 5', episodeCount: 16, airDate: '2012-07-15' },
	],
}

// =============================================================================
// Sample Season Data
// =============================================================================

export const SAMPLE_SEASON_DATA: SeasonTemplateDataInput = {
	seriesTitle: 'Breaking Bad',
	seasonNumber: 5,
	seasonName: 'Temporada 5',
	year: '2012',
	overview:
		'Tras la muerte de Gus Fring, Walter White se ha convertido en Heisenberg, el rey de la metanfetamina. Ahora debe lidiar con las consecuencias de sus acciones mientras construye un nuevo imperio del crimen, mientras Hank se acerca cada vez más a descubrir la verdad.',
	episodeCount: 16,
	averageRuntime: 47,
	posterUrl: 'https://image.tmdb.org/t/p/w500/r3z70vunihrAkjILQKWHX0G2xzO.jpg',
	trailerUrl: 'https://www.youtube.com/watch?v=HhesaQXLuRY',
	airDate: '2012-07-15',
	voteAverage: 9.6,
	networks: [
		{
			name: 'AMC',
			logoUrl: 'https://image.tmdb.org/t/p/w154/pmvRmATOCaDykE6JrVoeYpGmruT.png',
		},
	],
	episodes: [
		{ number: 1, name: 'Live Free or Die', airDate: '2012-07-15' },
		{ number: 2, name: 'Madrigal', airDate: '2012-07-22' },
		{ number: 3, name: 'Hazard Pay', airDate: '2012-07-29' },
		{ number: 4, name: 'Fifty-One', airDate: '2012-08-05' },
		{ number: 5, name: 'Dead Freight', airDate: '2012-08-12' },
		{ number: 6, name: 'Buyout', airDate: '2012-08-19' },
		{ number: 7, name: 'Say My Name', airDate: '2012-08-26' },
		{ number: 8, name: 'Gliding Over All', airDate: '2012-09-02' },
		{ number: 9, name: 'Blood Money', airDate: '2013-08-11' },
		{ number: 10, name: 'Buried', airDate: '2013-08-18' },
		{ number: 11, name: 'Confessions', airDate: '2013-08-25' },
		{ number: 12, name: 'Rabid Dog', airDate: '2013-09-01' },
		{ number: 13, name: "To'hajiilee", airDate: '2013-09-08' },
		{ number: 14, name: 'Ozymandias', airDate: '2013-09-15' },
		{ number: 15, name: 'Granite State', airDate: '2013-09-22' },
		{ number: 16, name: 'Felina', airDate: '2013-09-29' },
	],
	seriesGenres: ['Drama', 'Crimen', 'Suspense'],
	seriesCreators: ['Vince Gilligan'],
	seriesCast: ['Bryan Cranston', 'Aaron Paul', 'Anna Gunn', 'Dean Norris', 'Betsy Brandt', 'RJ Mitte'],
	seriesStatus: 'Finalizada',
}

// =============================================================================
// Sample Game Data (for IGDB)
// =============================================================================

export const SAMPLE_GAME_DATA: GameTemplateDataInput = {
	name: 'The Witcher 3: Wild Hunt',
	originalName: 'The Witcher 3: Wild Hunt',
	releaseDate: '19 de mayo de 2015',
	releaseYear: '2015',
	releaseDates: [
		'PC: 19 de mayo de 2015',
		'PS4: 19 de mayo de 2015',
		'Xbox One: 19 de mayo de 2015',
		'Switch: 15 de octubre de 2019',
	],
	status: 'Lanzado',
	developers: ['CD Projekt Red'],
	publishers: ['CD Projekt', 'Bandai Namco Entertainment'],
	platforms: ['PC', 'PlayStation 4', 'Xbox One', 'Nintendo Switch', 'PlayStation 5', 'Xbox Series X|S'],
	genres: ['RPG', 'Aventura'],
	themes: ['Fantasía', 'Mundo abierto', 'Medieval'],
	gameModes: ['Un jugador'],
	playerPerspectives: ['Tercera persona'],
	gameEngines: ['REDengine 3'],
	collection: 'The Witcher',
	summary:
		'Eres Geralt de Rivia, cazador de monstruos, en busca de tu hija adoptiva, Ciri, en un vasto mundo abierto rico en ciudades mercantes, islas de vikingos piratas, peligrosos puertos de montaña y cuevas olvidadas para explorar.',
	storyline:
		'La historia sigue a Geralt de Rivia mientras busca a Ciri, su hija adoptiva que está siendo perseguida por la Cacería Salvaje, un grupo de espectros que busca usar sus poderes para sus propios fines oscuros. A lo largo del camino, Geralt deberá enfrentarse a monstruos, tomar decisiones morales difíciles y navegar por las intrigas políticas de los reinos del Norte.',
	coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg',
	steamLibraryHeaderUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/292030/library_header_2x.jpg',
	detailedDescription:
		'The Witcher 3: Wild Hunt es un RPG de mundo abierto galardonado, ambientado en un universo de fantasía oscura donde cada elección tiene consecuencias. Explora un vasto mundo, lucha contra criaturas mortales y toma decisiones que darán forma a la historia.',
	steamScreenshots: [
		'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/ss_107600c1337accc09104f7a8aa7f275f23cad096.jpg',
		'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/ss_64eb760f9a2b67f6731a71c1e3b65c1e52b6b5f3.jpg',
	],
	screenshots: [
		'https://images.igdb.com/igdb/image/upload/t_1080p/em1y2ugcwy2myuhvb9db.jpg',
		'https://images.igdb.com/igdb/image/upload/t_1080p/qhazjvisxtqnhnzxj7xz.jpg',
	],
	artworks: [
		'https://images.igdb.com/igdb/image/upload/t_1080p/ar5h6.jpg',
		'https://images.igdb.com/igdb/image/upload/t_1080p/ar5h7.jpg',
	],
	trailerUrl: 'https://www.youtube.com/watch?v=c0i88t0Kacs',
	trailers: [
		{ name: 'Launch Cinematic', url: 'https://www.youtube.com/watch?v=c0i88t0Kacs' },
		{ name: 'Gameplay Trailer', url: 'https://www.youtube.com/watch?v=XHrskkHf958' },
	],
	similarGames: [
		{
			name: 'The Witcher 2: Assassins of Kings',
			coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1r76.jpg',
		},
		{ name: 'Dragon Age: Inquisition', coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1rcg.jpg' },
		{ name: 'The Elder Scrolls V: Skyrim', coverUrl: null },
	],
	dlcs: ['Hearts of Stone', 'Blood and Wine'],
	timeToBeatHastily: '32h',
	timeToBeatNormally: '55h 30min',
	timeToBeatCompletely: '103h 20min',
	websites: [
		{ category: 'official', url: 'https://thewitcher.com' },
		{ category: 'steam', url: 'https://store.steampowered.com/app/292030' },
	],
	externalGames: ['Steam: https://store.steampowered.com/app/292030'],
	steamStoreUrl: 'https://store.steampowered.com/app/292030',
	languageSupports: ['Español (Voces)', 'Español (Subtítulos)', 'Inglés (Interfaz)'],
	rating: 92,
	aggregatedRating: 93,
	totalRating: 92,
	ageRating: 'PEGI 18',
}

// =============================================================================
// Get Sample Data by Type
// =============================================================================

export function getSampleData(type: 'movie' | 'tvshow' | 'season' | 'game') {
	switch (type) {
		case 'movie':
			return SAMPLE_MOVIE_DATA
		case 'tvshow':
			return SAMPLE_TVSHOW_DATA
		case 'season':
			return SAMPLE_SEASON_DATA
		case 'game':
			return SAMPLE_GAME_DATA
	}
}
