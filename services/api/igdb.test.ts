/**
 * Tests for IGDB API Service
 *
 * Tests the data transformation and template generation functions.
 * Network-dependent functions are mocked via sendMessage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IGDBGame } from './igdb-types'
import { IGDBAgeRatingCategory, IGDBWebsiteCategory } from './igdb-types'

// Mock messaging module
vi.mock('@/lib/messaging', () => ({
	sendMessage: vi.fn(),
}))

// Mock settings store
vi.mock('@/store', () => ({
	useSettingsStore: {
		getState: () => ({
			mediaTemplates: {
				movie: null,
				tvshow: null,
				season: null,
				game: null,
			},
		}),
	},
}))

// Mock cachedFetch to pass through directly
vi.mock('@/services/media', () => ({
	cachedFetch: vi.fn((_key, fn) => fn()),
	createCacheKey: vi.fn((endpoint, body) => `${endpoint}:${body}`),
	CACHE_TTL: { SHORT: 60000, MEDIUM: 300000, LONG: 3600000 },
}))

// Import after mocks are set up
import { sendMessage } from '@/lib/messaging'
import {
	searchGames,
	getGameDetails,
	getGamesByIds,
	getGameTemplateData,
	generateGameTemplate,
	hasIgdbCredentials,
} from './igdb'

const mockSendMessage = sendMessage as ReturnType<typeof vi.fn>

const mockLocalizationData = () => {
	mockSendMessage.mockResolvedValueOnce([]) // game_localizations
	mockSendMessage.mockResolvedValueOnce([]) // alternative_names
}

describe('IGDB API Service', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockSendMessage.mockReset()
	})

	describe('hasIgdbCredentials', () => {
		it('should call sendMessage with correct parameters', async () => {
			mockSendMessage.mockResolvedValueOnce(true)

			const result = await hasIgdbCredentials()

			expect(mockSendMessage).toHaveBeenCalledWith('hasIgdbCredentials', undefined)
			expect(result).toBe(true)
		})

		it('should return false when credentials are not configured in env', async () => {
			mockSendMessage.mockResolvedValueOnce(false)

			const result = await hasIgdbCredentials()

			expect(result).toBe(false)
		})
	})

	describe('searchGames', () => {
		it('should search for games and return results', async () => {
			const mockGames: IGDBGame[] = [
				{ id: 1, name: 'The Witcher 3' },
				{ id: 2, name: 'The Witcher 2' },
			]
			mockSendMessage.mockResolvedValueOnce(mockGames)

			const result = await searchGames('witcher')

			expect(mockSendMessage).toHaveBeenCalledWith('igdbRequest', {
				endpoint: '/games',
				body: expect.stringContaining('search "witcher"'),
			})
			expect(result).toEqual(mockGames)
		})

		it('should sanitize special characters from query', async () => {
			const mockGames: IGDBGame[] = [{ id: 1, name: 'The Expanse: Osiris Reborn' }]
			mockSendMessage.mockResolvedValueOnce(mockGames)

			const result = await searchGames('the expanse: osiris')

			// Colon should be stripped and replaced with space
			expect(mockSendMessage).toHaveBeenCalledWith('igdbRequest', {
				endpoint: '/games',
				body: expect.stringContaining('search "the expanse osiris"'),
			})
			expect(result).toEqual(mockGames)
		})

		it('should fall back to wildcard search when primary search returns no results', async () => {
			mockSendMessage.mockResolvedValueOnce([]) // Primary search: no results
			const mockGames: IGDBGame[] = [{ id: 1, name: 'The Expanse: Osiris Reborn' }]
			mockSendMessage.mockResolvedValueOnce(mockGames) // Wildcard fallback

			const result = await searchGames('expanse osir')

			// First call: primary search
			expect(mockSendMessage).toHaveBeenCalledWith('igdbRequest', {
				endpoint: '/games',
				body: expect.stringContaining('search "expanse osir"'),
			})
			// Second call: wildcard fallback
			expect(mockSendMessage).toHaveBeenCalledWith('igdbRequest', {
				endpoint: '/games',
				body: expect.stringContaining('where name ~ *"expanse"* & name ~ *"osir"*'),
			})
			expect(result).toEqual(mockGames)
		})

		it('should return empty array for empty sanitized query', async () => {
			const result = await searchGames(':::')

			expect(mockSendMessage).not.toHaveBeenCalled()
			expect(result).toEqual([])
		})

		it('should respect limit parameter', async () => {
			mockSendMessage.mockResolvedValueOnce([])
			mockSendMessage.mockResolvedValueOnce([])

			await searchGames('test', 5)

			expect(mockSendMessage).toHaveBeenCalledWith('igdbRequest', {
				endpoint: '/games',
				body: expect.stringContaining('limit 5'),
			})
		})
	})

	describe('getGameDetails', () => {
		it('should fetch game details by ID', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Elden Ring',
				summary: 'An action RPG',
			}
			mockSendMessage.mockResolvedValueOnce([mockGame])

			const result = await getGameDetails(123)

			expect(mockSendMessage).toHaveBeenCalledWith('igdbRequest', {
				endpoint: '/games',
				body: expect.stringContaining('where id = 123'),
			})
			expect(result).toEqual(mockGame)
		})

		it('should return null when game not found', async () => {
			mockSendMessage.mockResolvedValueOnce([])

			const result = await getGameDetails(999999)

			expect(result).toBeNull()
		})
	})

	describe('getGamesByIds', () => {
		it('should fetch multiple games by IDs', async () => {
			const mockGames: IGDBGame[] = [
				{ id: 1, name: 'Game 1' },
				{ id: 2, name: 'Game 2' },
			]
			mockSendMessage.mockResolvedValueOnce(mockGames)

			const result = await getGamesByIds([1, 2])

			expect(mockSendMessage).toHaveBeenCalledWith('igdbRequest', {
				endpoint: '/games',
				body: expect.stringContaining('where id = (1,2)'),
			})
			expect(result).toEqual(mockGames)
		})

		it('should return empty array for empty input', async () => {
			const result = await getGamesByIds([])

			expect(mockSendMessage).not.toHaveBeenCalled()
			expect(result).toEqual([])
		})
	})

	describe('getGameTemplateData', () => {
		it('should transform IGDB game data to template format', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Test Game',
				summary: 'A great game',
				storyline: 'Epic story',
				first_release_date: 1609459200, // 2021-01-01
				rating: 85.5,
				cover: { id: 1, image_id: 'co1abc' },
				screenshots: [
					{ id: 1, image_id: 'sc1abc' },
					{ id: 2, image_id: 'sc2def' },
				],
				videos: [{ id: 1, video_id: 'dQw4w9WgXcQ', name: 'Trailer' }],
				genres: [{ id: 1, name: 'Adventure' }],
				themes: [{ id: 1, name: 'Fantasy' }],
				platforms: [
					{ id: 1, name: 'PlayStation 5', abbreviation: 'PS5' },
					{ id: 2, name: 'Xbox Series X', abbreviation: 'XSX' },
				],
				involved_companies: [
					{ id: 1, company: { id: 1, name: 'Developer Studio' }, developer: true, publisher: false },
					{ id: 2, company: { id: 2, name: 'Publisher Inc' }, developer: false, publisher: true },
				],
				game_modes: [{ id: 1, name: 'Single player' }],
				websites: [
					{ id: 1, category: IGDBWebsiteCategory.Official, url: 'https://game.com' },
					{ id: 2, category: IGDBWebsiteCategory.Steam, url: 'https://store.steampowered.com/app/123' },
				],
				age_ratings: [{ id: 1, category: IGDBAgeRatingCategory.PEGI, rating: 4 }],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat (no data)
			mockLocalizationData()

			const result = await getGameTemplateData(123)

			expect(result).not.toBeNull()
			expect(result?.name).toBe('Test Game')
			expect(result?.summary).toBe('A great game')
			expect(result?.storyline).toBe('Epic story')
			expect(result?.releaseDate).toBe('1 de enero de 2021')
			expect(result?.rating).toBe(86) // Rounded
			expect(result?.developers).toEqual(['Developer Studio'])
			expect(result?.publishers).toEqual(['Publisher Inc'])
			expect(result?.platforms).toEqual(['PS5', 'XSX'])
			expect(result?.genres).toEqual(['Aventura']) // Translated
			expect(result?.themes).toEqual(['Fantasía']) // Translated
			expect(result?.gameModes).toEqual(['Un jugador']) // Translated
			expect(result?.coverUrl).toBe('https://images.igdb.com/igdb/image/upload/t_cover_big/co1abc.jpg')
			expect(result?.screenshots).toHaveLength(2)
			expect(result?.trailerUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
			expect(result?.websites).toHaveLength(2)
			expect(result?.ageRating).toBe('PEGI 16')
		})

		it('should return null when game not found', async () => {
			mockSendMessage.mockResolvedValueOnce([]) // getGameDetails returns empty
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()

			const result = await getGameTemplateData(999999)

			expect(result).toBeNull()
		})

		it('should handle game with minimal data', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Minimal Game',
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()

			const result = await getGameTemplateData(123)

			expect(result).not.toBeNull()
			expect(result?.name).toBe('Minimal Game')
			expect(result?.summary).toBe('')
			expect(result?.storyline).toBeNull()
			expect(result?.releaseDate).toBeNull()
			expect(result?.rating).toBeNull()
			expect(result?.developers).toEqual([])
			expect(result?.publishers).toEqual([])
			expect(result?.platforms).toEqual([])
			expect(result?.genres).toEqual([])
			expect(result?.themes).toEqual([])
			expect(result?.gameModes).toEqual([])
			expect(result?.playerPerspectives).toEqual([])
			expect(result?.coverUrl).toBeNull()

			expect(result?.steamLibraryHeaderUrl).toBeNull()
			expect(result?.screenshots).toEqual([])
			expect(result?.steamScreenshots).toEqual([])
			expect(result?.detailedDescription).toBeNull()
			expect(result?.trailerUrl).toBeNull()
			expect(result?.timeToBeatNormally).toBeNull()
			expect(result?.websites).toEqual([])
			expect(result?.ageRating).toBeNull()
		})

		it('should use platform name when abbreviation is not available', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Test Game',
				platforms: [{ id: 1, name: 'Nintendo Switch' }], // No abbreviation
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()

			const result = await getGameTemplateData(123)

			expect(result?.platforms).toEqual(['Nintendo Switch'])
		})

		it('should limit screenshots to 4', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Test Game',
				screenshots: [
					{ id: 1, image_id: 'sc1' },
					{ id: 2, image_id: 'sc2' },
					{ id: 3, image_id: 'sc3' },
					{ id: 4, image_id: 'sc4' },
					{ id: 5, image_id: 'sc5' },
					{ id: 6, image_id: 'sc6' },
				],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()

			const result = await getGameTemplateData(123)

			expect(result?.screenshots).toHaveLength(6)
		})

		it('should keep original genre name when no translation exists', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Test Game',
				genres: [{ id: 1, name: 'SomeNewGenre' }],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()

			const result = await getGameTemplateData(123)

			expect(result?.genres).toEqual(['SomeNewGenre'])
		})

		it('should include time-to-beat data when available', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Test Game',
			}
			const mockTimeToBeat = {
				id: 1,
				game_id: 123,
				hastily: 90000, // 25h
				normally: 180000, // 50h
				completely: 360000, // 100h
				count: 42,
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([mockTimeToBeat]) // getTimeToBeat
			mockLocalizationData()

			const result = await getGameTemplateData(123)

			expect(result?.timeToBeatHastily).toBe('25h')
			expect(result?.timeToBeatNormally).toBe('50h')
			expect(result?.timeToBeatCompletely).toBe('100h')
		})

		it('should handle time-to-beat API failure gracefully', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Test Game',
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockRejectedValueOnce(new Error('API error')) // getTimeToBeat fails
			mockLocalizationData()

			const result = await getGameTemplateData(123)

			expect(result).not.toBeNull()
			expect(result?.name).toBe('Test Game')
			expect(result?.timeToBeatHastily).toBeNull()
			expect(result?.timeToBeatNormally).toBeNull()
			expect(result?.timeToBeatCompletely).toBeNull()
		})

		it('should use Steam Spanish description when game has Steam external link', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Cyberpunk 2077',
				summary: 'An open-world RPG set in Night City',
				external_games: [
					{
						id: 1,
						url: 'https://store.steampowered.com/app/1091500',
						uid: '1091500',
						external_game_source: { id: 1, name: 'Steam' },
					},
				],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()
			mockSendMessage.mockResolvedValueOnce({
				appId: 1091500,
				description: 'Cyberpunk 2077 es un RPG de mundo abierto...',
				screenshots: ['https://steam/ss1.jpg'],
				steamLibraryHeaderUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1091500/library_header_2x.jpg',
			}) // fetchSteamGame

			const result = await getGameTemplateData(123)

			expect(result?.summary).toBe('Cyberpunk 2077 es un RPG de mundo abierto...')
			expect(result?.detailedDescription).toBeNull()
			expect(result?.steamScreenshots).toEqual(['https://steam/ss1.jpg'])
			expect(result?.steamLibraryHeaderUrl).toBe(
				'https://cdn.akamai.steamstatic.com/steam/apps/1091500/library_header_2x.jpg'
			)
			expect(result?.steamStoreUrl).toBe('https://store.steampowered.com/app/1091500')
			expect(mockSendMessage).toHaveBeenCalledWith('fetchSteamGame', 1091500)
		})

		it('should parse numeric UID when Steam URL is unavailable', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Test Game',
				summary: 'English summary',
				external_games: [
					{
						id: 1,
						uid: '1091500',
						external_game_source: { id: 1, name: 'Steam' },
					},
				],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()
			mockSendMessage.mockResolvedValueOnce({
				appId: 1091500,
				description: 'Descripción detallada en español',
				screenshots: [],
				steamLibraryHeaderUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1091500/library_header_2x.jpg',
			}) // fetchSteamGame

			const result = await getGameTemplateData(123)

			expect(result?.summary).toBe('Descripción detallada en español')
			expect(result?.steamStoreUrl).toBe('https://store.steampowered.com/app/1091500')
			expect(mockSendMessage).toHaveBeenCalledWith('fetchSteamGame', 1091500)
		})

		it('should fall back to IGDB English summary when Steam fetch fails', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Test Game',
				summary: 'English fallback summary',
				external_games: [
					{
						id: 1,
						url: 'https://store.steampowered.com/app/12345',
						external_game_source: { id: 1, name: 'Steam' },
					},
				],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()
			mockSendMessage.mockRejectedValueOnce(new Error('Steam API down')) // fetchSteamGame fails

			const result = await getGameTemplateData(123)

			expect(result?.summary).toBe('English fallback summary')
		})

		it('should fall back to IGDB summary when Steam returns no description', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Test Game',
				summary: 'IGDB English summary',
				external_games: [
					{
						id: 1,
						url: 'https://store.steampowered.com/app/12345',
						external_game_source: { id: 1, name: 'Steam' },
					},
				],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()
			mockSendMessage.mockResolvedValueOnce(null) // fetchSteamGame returns null

			const result = await getGameTemplateData(123)

			expect(result?.summary).toBe('IGDB English summary')
		})

		it('should use short_description fallback when about_the_game is image-only', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'The Witcher 3',
				summary: 'English RPG summary',
				external_games: [
					{
						id: 1,
						url: 'https://store.steampowered.com/app/292030',
						uid: '292030',
						external_game_source: { id: 1, name: 'Steam' },
					},
				],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()
			mockSendMessage.mockResolvedValueOnce({
				appId: 292030,
				// Steam resolved description to short_description because about_the_game was image-only
				description: 'RPG de mundo abierto ya disponible en español',
				screenshots: [],
				steamLibraryHeaderUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/292030/library_header_2x.jpg',
			}) // fetchSteamGame

			const result = await getGameTemplateData(123)

			// Steam already resolved the best description internally
			expect(result?.summary).toBe('RPG de mundo abierto ya disponible en español')
			expect(result?.detailedDescription).toBeNull()
		})

		it('should not call Steam when game has no Steam external link', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Console Exclusive',
				summary: 'A console only game',
				external_games: [
					{
						id: 1,
						url: 'https://playstation.com/game/123',
						external_game_source: { id: 1, name: 'PlayStation Store' },
					},
				],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()

			const result = await getGameTemplateData(123)

			expect(result?.summary).toBe('A console only game')
			expect(result?.steamStoreUrl).toBeNull()
			// Should NOT have called fetchSteamGame
			expect(mockSendMessage).toHaveBeenCalledTimes(4) // igdbRequest x4 (details, timeToBeat, localizations, alt names)
		})

		it('should fall back to websites for Steam App ID when external_games has no Steam', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Test Game',
				summary: 'English summary',
				websites: [
					{ id: 1, category: IGDBWebsiteCategory.Official, url: 'https://example.com' },
					{
						id: 2,
						category: IGDBWebsiteCategory.Steam,
						url: 'https://store.steampowered.com/app/292030',
					},
				],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()
			mockSendMessage.mockResolvedValueOnce({
				appId: 292030,
				description: 'Descripción detallada desde websites',
				screenshots: [],
				steamLibraryHeaderUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/292030/library_header_2x.jpg',
			}) // fetchSteamGame

			const result = await getGameTemplateData(123)

			expect(result?.summary).toBe('Descripción detallada desde websites')
			expect(result?.steamStoreUrl).toBe('https://store.steampowered.com/app/292030')
			expect(mockSendMessage).toHaveBeenCalledWith('fetchSteamGame', 292030)
		})
	})

	describe('generateGameTemplate', () => {
		it('should generate BBCode template from game data', () => {
			const gameData = {
				name: 'Test Game',
				originalName: 'Test Game',
				releaseDate: '2024-01-15',
				developers: ['Studio A'],
				publishers: ['Publisher B'],
				platforms: ['PC', 'PS5'],
				genres: ['Aventura', 'RPG'],
				themes: ['Fantasía'],
				gameModes: ['Un jugador'],
				playerPerspectives: ['Tercera persona'],
				summary: 'A great adventure game.',
				detailedDescription: null,
				storyline: null,
				coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1abc.jpg',
				steamLibraryHeaderUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/292030/library_header_2x.jpg',
				screenshots: [],
				steamScreenshots: ['https://steam/ss1.jpg'],
				artworks: [],
				trailerUrl: 'https://www.youtube.com/watch?v=abc123',
				trailers: [],
				websites: [],
				externalGames: [],
				steamStoreUrl: 'https://store.steampowered.com/app/292030',
				languageSupports: [],
				rating: 85,
				aggregatedRating: null,
				totalRating: null,
				ageRating: 'PEGI 12',
				releaseYear: '2024',
				releaseDates: [],
				similarGames: [],
				dlcs: [],
				status: null,
				gameEngines: [],
				collection: null,
				timeToBeatHastily: null,
				timeToBeatNormally: null,
				timeToBeatCompletely: null,
			}

			const result = generateGameTemplate(gameData)

			// Default template includes these fields (note: name is not in default template)
			expect(result).toContain('[center]')
			expect(result).toContain('[img]https://images.igdb.com/igdb/image/upload/t_cover_big/co1abc.jpg[/img]')
			expect(result).toContain('[b]Desarrollador:[/b] Studio A')
			expect(result).toContain('[b]Distribuidor:[/b] Publisher B')
			expect(result).toContain('[b]Plataformas:[/b] PC, PS5')
			expect(result).toContain('[b]Géneros:[/b] Aventura, RPG')
			expect(result).toContain('[b]Modos de juego:[/b] Un jugador')
			expect(result).toContain('[bar]ACERCA DE ESTE JUEGO[/bar]')
			expect(result).toContain('A great adventure game.')
			expect(result).toContain('[bar]TRAILER[/bar]')
			expect(result).toContain('[media]https://www.youtube.com/watch?v=abc123[/media]')
			expect(result).toContain('[bar]STEAM[/bar]')
			expect(result).toContain('[media]https://store.steampowered.com/app/292030[/media]')
		})

		it('should handle game data without optional fields', () => {
			const gameData = {
				name: 'Minimal Game',
				originalName: 'Minimal Game',
				releaseDate: null,
				releaseYear: null,
				releaseDates: [],
				developers: [],
				publishers: [],
				platforms: [],
				genres: [],
				themes: [],
				gameModes: [],
				playerPerspectives: [],
				summary: '',
				detailedDescription: null,
				storyline: null,
				coverUrl: null,
				steamLibraryHeaderUrl: null,
				screenshots: [],
				steamScreenshots: [],
				artworks: [],
				trailerUrl: null,
				trailers: [],
				websites: [],
				externalGames: [],
				steamStoreUrl: null,
				languageSupports: [],
				rating: null,
				aggregatedRating: null,
				totalRating: null,
				ageRating: null,
				similarGames: [],
				dlcs: [],
				status: null,
				gameEngines: [],
				collection: null,
				timeToBeatHastily: null,
				timeToBeatNormally: null,
				timeToBeatCompletely: null,
			}

			const result = generateGameTemplate(gameData)

			// Should generate valid BBCode without crashing
			// Empty fields should be skipped (conditional: true)
			expect(result).not.toContain('[img][/img]') // Empty cover should be skipped
			expect(result).not.toContain('[media][/media]') // Empty video should be skipped
			expect(result).not.toContain('[b]Desarrollador:[/b]') // Empty developers skipped
			expect(result).not.toContain('[b]Distribuidor:[/b]') // Empty publishers skipped
			expect(result).not.toContain('[bar]TRAILER[/bar]') // No video, no trailer section
			expect(result).not.toContain('[bar]STEAM[/bar]') // No Steam URL, no Steam section
			expect(result).not.toContain('[bar]LANZAMIENTO[/bar]') // No release date
		})
	})
})

describe('IGDB Data Transformations', () => {
	describe('Website category labels', () => {
		it('should map common website categories correctly', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Test Game',
				websites: [
					{ id: 1, category: IGDBWebsiteCategory.Official, url: 'https://official.com' },
					{ id: 2, category: IGDBWebsiteCategory.Steam, url: 'https://steam.com' },
					{ id: 3, category: IGDBWebsiteCategory.GOG, url: 'https://gog.com' },
					{ id: 4, category: IGDBWebsiteCategory.EpicGames, url: 'https://epic.com' },
					{ id: 5, category: IGDBWebsiteCategory.Discord, url: 'https://discord.gg/test' },
					{ id: 6, category: IGDBWebsiteCategory.Twitter, url: 'https://twitter.com/test' },
					{ id: 7, category: IGDBWebsiteCategory.YouTube, url: 'https://youtube.com/test' },
					{ id: 8, category: IGDBWebsiteCategory.Reddit, url: 'https://reddit.com/r/test' },
				],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()

			const result = await getGameTemplateData(123)

			expect(result?.websites).toEqual([
				{ category: 'official', url: 'https://official.com' },
				{ category: 'steam', url: 'https://steam.com' },
				{ category: 'gog', url: 'https://gog.com' },
				{ category: 'epic', url: 'https://epic.com' },
				{ category: 'discord', url: 'https://discord.gg/test' },
				{ category: 'twitter', url: 'https://twitter.com/test' },
				{ category: 'youtube', url: 'https://youtube.com/test' },
				{ category: 'reddit', url: 'https://reddit.com/r/test' },
			])
		})

		it('should use "other" for unknown website categories', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Test Game',
				websites: [{ id: 1, category: 999 as IGDBWebsiteCategory, url: 'https://unknown.com' }],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()

			const result = await getGameTemplateData(123)

			expect(result?.websites?.[0].category).toBe('other')
		})
	})

	describe('Age rating extraction', () => {
		it('should prefer PEGI rating', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Test Game',
				age_ratings: [
					{ id: 1, category: IGDBAgeRatingCategory.ESRB, rating: 10 }, // T (Teen)
					{ id: 2, category: IGDBAgeRatingCategory.PEGI, rating: 5 }, // PEGI 18
				],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()

			const result = await getGameTemplateData(123)

			expect(result?.ageRating).toBe('PEGI 18')
		})

		it('should return null when only ESRB is available', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Test Game',
				age_ratings: [{ id: 1, category: IGDBAgeRatingCategory.ESRB, rating: 10 }],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()

			const result = await getGameTemplateData(123)

			// Currently only PEGI is supported
			expect(result?.ageRating).toBeNull()
		})
	})

	describe('Date formatting', () => {
		it('should format Unix timestamp to long Spanish date', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Test Game',
				first_release_date: 1577836800, // 2020-01-01 00:00:00 UTC
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()

			const result = await getGameTemplateData(123)

			expect(result?.releaseDate).toBe('1 de enero de 2020')
		})
	})

	describe('Company extraction', () => {
		it('should separate developers from publishers', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Test Game',
				involved_companies: [
					{ id: 1, company: { id: 1, name: 'Dev A' }, developer: true, publisher: false },
					{ id: 2, company: { id: 2, name: 'Dev B' }, developer: true, publisher: false },
					{ id: 3, company: { id: 3, name: 'Pub A' }, developer: false, publisher: true },
					{ id: 4, company: { id: 4, name: 'Both' }, developer: true, publisher: true },
				],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()

			const result = await getGameTemplateData(123)

			expect(result?.developers).toEqual(['Dev A', 'Dev B', 'Both'])
			expect(result?.publishers).toEqual(['Pub A', 'Both'])
		})
	})
})
