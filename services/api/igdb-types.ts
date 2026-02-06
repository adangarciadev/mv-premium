/**
 * IGDB API Types
 *
 * Types for the Internet Game Database API.
 * https://api-docs.igdb.com/
 */

// =============================================================================
// Core Types
// =============================================================================

export interface IGDBGame {
	id: number
	name: string
	slug?: string
	summary?: string
	storyline?: string
	first_release_date?: number // Unix timestamp
	rating?: number // 0-100
	aggregated_rating?: number // 0-100
	total_rating?: number // 0-100
	status?: number // Game release status
	cover?: IGDBCover
	screenshots?: IGDBScreenshot[]
	artworks?: IGDBArtwork[]
	videos?: IGDBVideo[]
	genres?: IGDBGenre[]
	themes?: IGDBTheme[]
	platforms?: IGDBPlatform[]
	involved_companies?: IGDBInvolvedCompany[]
	game_modes?: IGDBGameMode[]
	player_perspectives?: IGDBPlayerPerspective[]
	game_engines?: IGDBGameEngine[]
	collection?: IGDBCollection
	collections?: IGDBCollection[]
	franchise?: IGDBFranchise
	franchises?: IGDBFranchise[]
	similar_games?: IGDBSimilarGame[]
	dlcs?: IGDBDlc[]
	websites?: IGDBWebsite[]
	age_ratings?: IGDBAgeRating[]
	release_dates?: IGDBReleaseDate[]
	external_games?: IGDBExternalGame[]
	language_supports?: IGDBLanguageSupport[]
}

export interface IGDBCover {
	id: number
	game?: number
	image_id: string
	width?: number
	height?: number
	url?: string
}

export interface IGDBScreenshot {
	id: number
	game?: number
	image_id: string
	width?: number
	height?: number
	url?: string
}

export interface IGDBArtwork {
	id: number
	game?: number
	image_id: string
	width?: number
	height?: number
	url?: string
}

export interface IGDBGameEngine {
	id: number
	name: string
	slug?: string
}

export interface IGDBCollection {
	id: number
	name: string
	slug?: string
}

export interface IGDBFranchise {
	id: number
	name: string
	slug?: string
}

export interface IGDBSimilarGame {
	id: number
	name: string
	cover?: IGDBCover
}

export interface IGDBDlc {
	id: number
	name: string
}

export interface IGDBPlayerPerspective {
	id: number
	name: string
	slug?: string
}

export interface IGDBTimeToBeat {
	id: number
	game_id: number
	hastily?: number // seconds — rush playthrough
	normally?: number // seconds — normal playthrough
	completely?: number // seconds — 100% completion
	count?: number // number of submissions
}

export interface IGDBVideo {
	id: number
	game?: number
	name?: string
	video_id: string // YouTube video ID
}

export interface IGDBGenre {
	id: number
	name: string
	slug?: string
}

export interface IGDBTheme {
	id: number
	name: string
	slug?: string
}

export interface IGDBPlatform {
	id: number
	name: string
	abbreviation?: string
	slug?: string
}

export interface IGDBInvolvedCompany {
	id: number
	company: IGDBCompany
	developer?: boolean
	publisher?: boolean
	porting?: boolean
	supporting?: boolean
}

export interface IGDBCompany {
	id: number
	name: string
	slug?: string
}

export interface IGDBGameMode {
	id: number
	name: string
	slug?: string
}

export interface IGDBWebsite {
	id: number
	category: IGDBWebsiteCategory
	url: string
	trusted?: boolean
}

export interface IGDBExternalGame {
	id: number
	name?: string
	url?: string
	uid?: string
	year?: number
	platform?: IGDBPlatform
	external_game_source?: IGDBExternalGameSource
	game_release_format?: IGDBGameReleaseFormat
}

export interface IGDBExternalGameSource {
	id: number
	name: string
}

export interface IGDBGameReleaseFormat {
	id: number
	format: string
}

export enum IGDBWebsiteCategory {
	Official = 1,
	Wikia = 2,
	Wikipedia = 3,
	Facebook = 4,
	Twitter = 5,
	Twitch = 6,
	Instagram = 8,
	YouTube = 9,
	iPhone = 10,
	iPad = 11,
	Android = 12,
	Steam = 13,
	Reddit = 14,
	Itch = 15,
	EpicGames = 16,
	GOG = 17,
	Discord = 18,
}

export interface IGDBAgeRating {
	id: number
	category: IGDBAgeRatingCategory
	rating: number
}

export enum IGDBAgeRatingCategory {
	ESRB = 1,
	PEGI = 2,
	CERO = 3,
	USK = 4,
	GRAC = 5,
	CLASS_IND = 6,
	ACB = 7,
}

export interface IGDBReleaseDate {
	id: number
	date?: number // Unix timestamp
	human?: string
	platform?: IGDBPlatform
	region?: number
}

export interface IGDBLanguageSupport {
	id: number
	language?: IGDBLanguage
	language_support_type?: IGDBLanguageSupportType
}

export interface IGDBLanguage {
	id: number
	name: string
	native_name?: string
	locale?: string
}

export interface IGDBLanguageSupportType {
	id: number
	name: string
}

// =============================================================================
// Search Response
// =============================================================================

export interface IGDBSearchResult {
	games: IGDBGame[]
	count: number
}

// =============================================================================
// Image URL Helpers
// =============================================================================

export type IGDBImageSize =
	| 'cover_small' // 90x128
	| 'screenshot_med' // 569x320
	| 'cover_big' // 264x374
	| 'logo_med' // 284x160
	| 'screenshot_big' // 889x500
	| 'screenshot_huge' // 1280x720
	| 'thumb' // 90x90
	| 'micro' // 35x35
	| '720p' // 1280x720
	| '1080p' // 1920x1080

/**
 * Build an IGDB image URL from an image_id
 */
export function getIGDBImageUrl(imageId: string, size: IGDBImageSize = 'cover_big'): string {
	return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`
}

// =============================================================================
// PEGI Rating Labels
// =============================================================================

export const PEGI_RATING_LABELS: Record<number, string> = {
	1: 'PEGI 3',
	2: 'PEGI 7',
	3: 'PEGI 12',
	4: 'PEGI 16',
	5: 'PEGI 18',
}

export const ESRB_RATING_LABELS: Record<number, string> = {
	6: 'RP (Rating Pending)',
	7: 'EC (Early Childhood)',
	8: 'E (Everyone)',
	9: 'E10+ (Everyone 10+)',
	10: 'T (Teen)',
	11: 'M (Mature 17+)',
	12: 'AO (Adults Only)',
}

// =============================================================================
// Game Modes (Spanish translations)
// =============================================================================

export const GAME_MODE_TRANSLATIONS: Record<string, string> = {
	'Single player': 'Un jugador',
	Multiplayer: 'Multijugador',
	'Co-operative': 'Cooperativo',
	'Split screen': 'Pantalla dividida',
	'Massively Multiplayer Online (MMO)': 'MMO',
	'Battle Royale': 'Battle Royale',
}

// =============================================================================
// Genre Translations (English to Spanish)
// =============================================================================

export const GENRE_TRANSLATIONS: Record<string, string> = {
	'Point-and-click': 'Point and click',
	Fighting: 'Lucha',
	Shooter: 'Disparos',
	Music: 'Musical',
	Platform: 'Plataformas',
	Puzzle: 'Puzle',
	Racing: 'Carreras',
	'Real Time Strategy (RTS)': 'Estrategia en tiempo real',
	'Role-playing (RPG)': 'RPG',
	Simulator: 'Simulador',
	Sport: 'Deportes',
	Strategy: 'Estrategia',
	'Turn-based strategy (TBS)': 'Estrategia por turnos',
	Tactical: 'Táctico',
	"Hack and slash/Beat 'em up": 'Hack and slash',
	Quiz: 'Trivia',
	Pinball: 'Pinball',
	Adventure: 'Aventura',
	Indie: 'Indie',
	Arcade: 'Arcade',
	'Visual Novel': 'Novela visual',
	'Card & Board Game': 'Cartas y tablero',
	MOBA: 'MOBA',
}

// =============================================================================
// Theme Translations
// =============================================================================

// =============================================================================
// Game Status Labels (Spanish)
// =============================================================================

/**
 * IGDB game status enum values mapped to Spanish labels.
 * See: https://api-docs.igdb.com/#game-enums
 */
export const GAME_STATUS_LABELS: Record<number, string> = {
	0: 'Lanzado',
	2: 'Alpha',
	3: 'Beta',
	4: 'Acceso anticipado',
	5: 'Offline',
	6: 'Cancelado',
	7: 'Rumoreado',
	8: 'Delisted',
}

// =============================================================================
// Player Perspective Translations
// =============================================================================

export const PLAYER_PERSPECTIVE_TRANSLATIONS: Record<string, string> = {
	'First person': 'Primera persona',
	'Third person': 'Tercera persona',
	'Bird view / Isometric': 'Vista cenital / Isométrica',
	'Side view': 'Vista lateral',
	Text: 'Texto',
	Auditory: 'Auditivo',
	'Virtual Reality': 'Realidad virtual',
}

export const THEME_TRANSLATIONS: Record<string, string> = {
	Action: 'Acción',
	Fantasy: 'Fantasía',
	'Science fiction': 'Ciencia ficción',
	Horror: 'Terror',
	Thriller: 'Suspense',
	Survival: 'Supervivencia',
	Historical: 'Histórico',
	Stealth: 'Sigilo',
	Comedy: 'Comedia',
	Business: 'Negocios',
	Drama: 'Drama',
	'Non-fiction': 'No ficción',
	Educational: 'Educativo',
	Sandbox: 'Sandbox',
	Kids: 'Infantil',
	'Open world': 'Mundo abierto',
	Warfare: 'Bélico',
	Party: 'Party',
	'4X (explore, expand, exploit, and exterminate)': '4X',
	Erotic: 'Erótico',
	Mystery: 'Misterio',
	Romance: 'Romance',
}
