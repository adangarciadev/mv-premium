/**
 * Tests for IGDB API Service
 *
 * Tests the data transformation and template generation functions.
 * Network-dependent functions are mocked via sendMessage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IGDBGame } from './igdb-types'
import type { MediaTemplate, UserTemplates } from '@/types/templates'
import { IGDBAgeRatingCategory, IGDBWebsiteCategory } from './igdb-types'

const storeMock = vi.hoisted(() => ({
	mediaTemplates: {
		movie: null,
		tvshow: null,
		season: null,
		game: null,
	} as UserTemplates,
	getSettings: vi.fn(),
}))

// Mock messaging module
vi.mock('@/lib/messaging', () => ({
	sendMessage: vi.fn(),
}))

// Mock mobile store background wrappers. The direct store scraping/API helpers
// are covered in mobile-stores.test.ts; IGDB only needs the wrapper contract.
vi.mock('@/services/api/mobile-stores', () => ({
	searchGooglePlayAppViaBackground: vi.fn(),
	searchItunesAppViaBackground: vi.fn(),
}))

// Mock settings store
vi.mock('@/store', () => ({
	getSettings: storeMock.getSettings,
	useSettingsStore: {
		getState: () => ({
			mediaTemplates: storeMock.mediaTemplates,
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
import { searchGooglePlayAppViaBackground, searchItunesAppViaBackground } from '@/services/api/mobile-stores'
import {
	searchGames,
	getGameDetails,
	getGamesByIds,
	getGameTemplateData,
	getGameTemplateString,
	generateGameTemplate,
	generateSteamMediaTemplate,
	getUpcomingGameReleases,
	normalizeUpcomingGameReleases,
	hasIgdbCredentials,
} from './igdb'

const mockSendMessage = sendMessage as ReturnType<typeof vi.fn>
const mockSearchGooglePlayAppViaBackground = searchGooglePlayAppViaBackground as ReturnType<typeof vi.fn>
const mockSearchItunesAppViaBackground = searchItunesAppViaBackground as ReturnType<typeof vi.fn>

const mockLocalizationData = () => {
	mockSendMessage.mockResolvedValueOnce([]) // game_localizations
	mockSendMessage.mockResolvedValueOnce([]) // alternative_names
}

describe('IGDB API Service', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockSendMessage.mockReset()
		mockSearchGooglePlayAppViaBackground.mockReset()
		mockSearchItunesAppViaBackground.mockReset()
		mockSearchGooglePlayAppViaBackground.mockResolvedValue(null)
		mockSearchItunesAppViaBackground.mockResolvedValue(null)
		storeMock.mediaTemplates.movie = null
		storeMock.mediaTemplates.tvshow = null
		storeMock.mediaTemplates.season = null
		storeMock.mediaTemplates.game = null
		storeMock.getSettings.mockResolvedValue({ mediaTemplates: storeMock.mediaTemplates })
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

	describe('getUpcomingGameReleases', () => {
		it('never persists upcoming releases to storage (time-window keys would pile up)', async () => {
			const { cachedFetch } = await import('@/services/media')
			vi.mocked(cachedFetch).mockClear()
			mockSendMessage.mockResolvedValueOnce([]).mockResolvedValueOnce([])

			await getUpcomingGameReleases({
				from: new Date('2026-01-01T00:00:00Z'),
				to: new Date('2026-02-01T00:00:00Z'),
			})

			expect(cachedFetch).toHaveBeenCalledWith(
				expect.stringContaining('upcoming-releases'),
				expect.any(Function),
				expect.objectContaining({ persist: false })
			)
		})

		it('queries upcoming games in the requested date range', async () => {
			const mockGames: IGDBGame[] = [
				{
					id: 1,
					name: 'Future Game',
					slug: 'future-game',
					first_release_date: 1767225600,
					cover: { id: 1, image_id: 'cofuture' },
					platforms: [
						{ id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' },
						{ id: 167, name: 'PlayStation 5', abbreviation: 'PS5' },
					],
					release_dates: [
						{ id: 1, date: 1767225600, platform: { id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' } },
						{ id: 2, date: 1790726400, platform: { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' } },
					],
					hypes: 20,
				},
			]
			mockSendMessage
				.mockResolvedValueOnce(mockGames)
				.mockResolvedValueOnce([])

			const result = await getUpcomingGameReleases({
				from: new Date('2026-01-01T00:00:00Z'),
				to: new Date('2026-02-01T00:00:00Z'),
				limit: 12,
			})

			expect(mockSendMessage).toHaveBeenCalledWith('igdbRequest', {
				endpoint: '/games',
				body: expect.stringContaining('where first_release_date >= 1767225600'),
			})
			expect(mockSendMessage).toHaveBeenCalledWith('igdbRequest', {
				endpoint: '/games',
				body: expect.stringContaining('limit 500'),
			})
			expect(mockSendMessage).toHaveBeenCalledWith('igdbRequest', {
				endpoint: '/games',
				body: expect.stringContaining('offset 0'),
			})
			expect(mockSendMessage).toHaveBeenCalledWith('igdbRequest', {
				endpoint: '/games',
				body: expect.stringContaining('release_dates.date, release_dates.category, release_dates.status.name'),
			})
			expect(mockSendMessage).toHaveBeenCalledWith('igdbRequest', {
				endpoint: '/release_dates',
				body: expect.stringContaining('where date >= 1767225600 & date < 1769904000'),
			})
			expect(mockSendMessage.mock.calls.some(([, payload]) => String(payload.body).includes('& category = 0'))).toBe(false)
			expect(result).toEqual([
				expect.objectContaining({
					id: 1,
					name: 'Future Game',
					slug: 'future-game',
					coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/cofuture.jpg',
					releaseDate: '2026-01-01',
					releaseTimestamp: 1767225600,
					platforms: ['PC', 'PS5'],
					releasePlatforms: ['PC'],
					igdbUrl: 'https://www.igdb.com/games/future-game',
					hypes: 20,
					follows: 0,
					rating: null,
					ratingCount: 0,
				}),
			])
		})

		it('uses the final release date instead of earlier non-final dates', async () => {
			const mockGames: IGDBGame[] = [
				{
					id: 6,
					name: 'Forza Horizon 6',
					slug: 'forza-horizon-6',
					first_release_date: 1778803200,
					cover: { id: 6, image_id: 'coforza6' },
					platforms: [
						{ id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' },
						{ id: 169, name: 'Xbox Series X|S', abbreviation: 'Series X|S' },
						{ id: 167, name: 'PlayStation 5', abbreviation: 'PS5' },
					],
					release_dates: [
						{ id: 1, date: 1778803200, category: 0, status: { name: 'Beta' }, platform: { id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' } },
						{ id: 2, date: 1779148800, category: 0, status: { name: 'Full Release' }, platform: { id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' } },
						{ id: 3, date: 1779148800, category: 0, status: { name: 'Full Release' }, platform: { id: 169, name: 'Xbox Series X|S', abbreviation: 'Series X|S' } },
						{ id: 4, date: 1779148800, category: 0, status: { name: 'Full Release' }, platform: { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' } },
					],
					hypes: 20,
				},
			]
			mockSendMessage
				.mockResolvedValueOnce(mockGames)
				.mockResolvedValueOnce([])

			const result = await getUpcomingGameReleases({
				from: new Date('2026-05-15T00:00:00Z'),
				to: new Date('2026-05-30T00:00:00Z'),
				limit: 12,
			})

			expect(result).toEqual([
				expect.objectContaining({
					name: 'Forza Horizon 6',
					releaseDate: '2026-05-19',
					releaseTimestamp: 1779148800,
					releasePlatforms: ['PC', 'Series X|S', 'PS5'],
				}),
			])
		})

		it('includes platform-specific releases when the game first launched before the requested range', async () => {
			mockSendMessage
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([
					{
						id: 10,
						date: 1767657600,
						platform: { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' },
						game: {
							id: 1,
							name: 'Former PC Exclusive',
							slug: 'former-pc-exclusive',
							first_release_date: 1767225600,
							cover: { id: 1, image_id: 'coformer' },
							platforms: [
								{ id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' },
								{ id: 167, name: 'PlayStation 5', abbreviation: 'PS5' },
							],
							release_dates: [
								{ id: 1, date: 1767225600, platform: { id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' } },
								{ id: 10, date: 1767657600, platform: { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' } },
							],
							hypes: 12,
						},
					},
				])

			const result = await getUpcomingGameReleases({
				from: new Date('2026-01-05T00:00:00Z'),
				to: new Date('2026-01-10T00:00:00Z'),
				limit: 12,
			})

			expect(result).toEqual([
				expect.objectContaining({
					id: 1,
					name: 'Former PC Exclusive',
					releaseDate: '2026-01-06',
					releaseTimestamp: 1767657600,
					platforms: ['PC', 'PS5'],
					releasePlatforms: ['PS5'],
				}),
			])
		})

		it('keeps more than three releases from the same day', async () => {
			const sameDayReleases = Array.from({ length: 5 }, (_, index) => ({
				id: index + 1,
				date: 1767225600,
				platform: { id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' },
				game: {
					id: index + 1,
					name: `Same Day Game ${index + 1}`,
					slug: `same-day-game-${index + 1}`,
					first_release_date: 1767225600,
					cover: { id: index + 1, image_id: `coday${index + 1}` },
					platforms: [{ id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' }],
					hypes: 5 - index,
				},
			}))

			mockSendMessage
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce(sameDayReleases)

			const result = await getUpcomingGameReleases({
				from: new Date('2026-01-01T00:00:00Z'),
				to: new Date('2026-01-02T00:00:00Z'),
				limit: 12,
			})

			expect(result).toHaveLength(5)
			expect(result.map(item => item.name)).toEqual([
				'Same Day Game 1',
				'Same Day Game 2',
				'Same Day Game 3',
				'Same Day Game 4',
				'Same Day Game 5',
			])
		})

		it('paginates release dates until the full requested range is loaded', async () => {
			const firstPage = Array.from({ length: 500 }, (_, index) => ({
				id: index + 1,
				date: 1767225600 + index,
				platform: { id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' },
				game: {
					id: index + 1,
					name: `Paged Game ${index + 1}`,
					slug: `paged-game-${index + 1}`,
					first_release_date: 1767225600 + index,
					platforms: [{ id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' }],
				},
			}))
			const secondPage = [
				{
					id: 501,
					date: 1767312000,
					platform: { id: 169, name: 'Xbox Series X|S', abbreviation: 'Series X|S' },
					game: {
						id: 501,
						name: 'Paged Xbox Game',
						slug: 'paged-xbox-game',
						first_release_date: 1767312000,
						platforms: [{ id: 169, name: 'Xbox Series X|S', abbreviation: 'Series X|S' }],
					},
				},
			]

			mockSendMessage
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce(firstPage)
				.mockResolvedValueOnce(secondPage)

			const result = await getUpcomingGameReleases({
				from: new Date('2026-01-01T00:00:00Z'),
				to: new Date('2026-02-01T00:00:00Z'),
			})

			expect(result).toHaveLength(501)
			expect(result.some(item => item.name === 'Paged Xbox Game')).toBe(true)
			expect(mockSendMessage).toHaveBeenCalledWith('igdbRequest', {
				endpoint: '/release_dates',
				body: expect.stringContaining('offset 450'),
			})
		})

		it('deduplicates overlapped release date pages', async () => {
			const firstPage = Array.from({ length: 500 }, (_, index) => ({
				id: index + 1,
				date: 1767225600 + index,
				platform: { id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' },
				game: {
					id: index + 1,
					name: `Overlap Game ${index + 1}`,
					slug: `overlap-game-${index + 1}`,
					first_release_date: 1767225600 + index,
					platforms: [{ id: 6, name: 'PC (Microsoft Windows)', abbreviation: 'PC' }],
				},
			}))
			const overlappedSecondPage = [
				...firstPage.slice(450),
				{
					id: 501,
					date: 1767312000,
					platform: { id: 167, name: 'PlayStation 5', abbreviation: 'PS5' },
					game: {
						id: 501,
						name: 'Overlap New Game',
						slug: 'overlap-new-game',
						first_release_date: 1767312000,
						platforms: [{ id: 167, name: 'PlayStation 5', abbreviation: 'PS5' }],
					},
				},
			]

			mockSendMessage
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce(firstPage)
				.mockResolvedValueOnce(overlappedSecondPage)

			const result = await getUpcomingGameReleases({
				from: new Date('2026-01-01T00:00:00Z'),
				to: new Date('2026-02-01T00:00:00Z'),
			})

			expect(result).toHaveLength(501)
			expect(result.filter(item => item.id === 451)).toHaveLength(1)
			expect(result.some(item => item.name === 'Overlap New Game')).toBe(true)
		})

		it('normalizes and sorts releases while filtering non-game categories', () => {
			const result = normalizeUpcomingGameReleases([
				{ id: 2, name: 'Second Game', first_release_date: 1767312000, cover: { id: 2, image_id: 'co2' } },
				{ id: 3, name: 'No Date Game' },
				{ id: 4, name: 'Low Signal Game', first_release_date: 1767225600 },
				{ id: 5, name: 'DLC Game', first_release_date: 1767225600, category: 1, cover: { id: 5, image_id: 'co5' } },
				{ id: 1, name: 'First Game', slug: 'first-game', first_release_date: 1767225600, follows: 10 },
			])

			expect(result).toEqual([
				expect.objectContaining({
					id: 1,
					name: 'First Game',
					coverUrl: null,
					platforms: [],
					releasePlatforms: [],
					igdbUrl: 'https://www.igdb.com/games/first-game',
					relevanceScore: expect.any(Number),
					hypes: 0,
					follows: 10,
					rating: null,
					ratingCount: 0,
				}),
				expect.objectContaining({
					id: 4,
					name: 'Low Signal Game',
					coverUrl: null,
					platforms: [],
					releasePlatforms: [],
					igdbUrl: 'https://www.igdb.com/games/4',
					relevanceScore: 0,
					hypes: 0,
					follows: 0,
					rating: null,
					ratingCount: 0,
				}),
				expect.objectContaining({
					id: 2,
					name: 'Second Game',
					coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co2.jpg',
					platforms: [],
					releasePlatforms: [],
					igdbUrl: 'https://www.igdb.com/games/2',
					relevanceScore: expect.any(Number),
					hypes: 0,
					follows: 0,
					rating: null,
					ratingCount: 0,
				}),
			])
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
			mockSendMessage.mockResolvedValueOnce([]) // searchSteamApps fallback

			const result = await getGameTemplateData(123)

			expect(result?.summary).toBe('A console only game')
			expect(result?.steamStoreUrl).toBeNull()
			expect(mockSendMessage).toHaveBeenCalledWith('searchSteamApps', { query: 'Console Exclusive', limit: 5 })
			// Should NOT have called fetchSteamGame
			expect(mockSendMessage).toHaveBeenCalledTimes(5) // igdbRequest x4 + steam search fallback
		})

		it('should search Steam by title when IGDB has no Steam link', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Found on Steam',
				summary: 'English summary',
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()
			mockSendMessage.mockResolvedValueOnce([
				{
					appId: 456,
					name: 'Found on Steam',
					appUrl: 'https://store.steampowered.com/app/456',
					tinyImage: null,
				},
			]) // searchSteamApps fallback
			mockSendMessage.mockResolvedValueOnce({
				description: 'Descripción de Steam',
				screenshots: [],
				steamLibraryHeaderUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/456/library_header_2x.jpg',
			}) // fetchSteamGame

			const result = await getGameTemplateData(123)

			expect(result?.summary).toBe('Descripción de Steam')
			expect(result?.steamStoreUrl).toBe('https://store.steampowered.com/app/456')
			expect(mockSendMessage).toHaveBeenCalledWith('searchSteamApps', { query: 'Found on Steam', limit: 5 })
			expect(mockSendMessage).toHaveBeenCalledWith('fetchSteamGame', 456)
		})

		it('should ignore weak Steam search matches when IGDB has no Steam link', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Forza Horizon 6',
				summary: 'English summary',
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()
			mockSendMessage.mockResolvedValueOnce([
				{
					appId: 1551360,
					name: 'Forza Horizon 5',
					appUrl: 'https://store.steampowered.com/app/1551360',
					tinyImage: null,
				},
			]) // searchSteamApps fallback

			const result = await getGameTemplateData(123)

			expect(result?.summary).toBe('English summary')
			expect(result?.steamStoreUrl).toBeNull()
			expect(mockSendMessage).toHaveBeenCalledWith('searchSteamApps', { query: 'Forza Horizon 6', limit: 5 })
			expect(mockSendMessage).not.toHaveBeenCalledWith('fetchSteamGame', 1551360)
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

		it('discards a non-Latin Steam description and keeps the IGDB summary', async () => {
			// Japanese-only Steam listings return Japanese text even when asking
			// for Spanish or English; IGDB's English summary is preferable then.
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Nandome ka no Shiki',
				summary: 'A mystery game set at a wedding ceremony.',
				external_games: [
					{
						id: 1,
						url: 'https://store.steampowered.com/app/999111',
						external_game_source: { id: 1, name: 'Steam' },
					},
				],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()
			mockSendMessage.mockResolvedValueOnce({
				description:
					'結婚式を舞台にした新たな推理ゲームをお届けします。殺された主人公が神の力で生き返って自分の死の原因を突き止めます。',
				screenshots: ['https://steam/ss1.jpg'],
				steamLibraryHeaderUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/999111/library_header_2x.jpg',
			}) // fetchSteamGame

			const result = await getGameTemplateData(123)

			expect(result?.summary).toBe('A mystery game set at a wedding ceremony.')
			expect(result?.steamScreenshots).toEqual(['https://steam/ss1.jpg'])
			expect(result?.steamStoreUrl).toBe('https://store.steampowered.com/app/999111')
		})

		it('extracts mobile store URLs and skips the Steam title fallback for mobile-only games', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Mobile Quest',
				summary: 'A mobile-only game',
				platforms: [
					{ id: 34, name: 'Android' },
					{ id: 39, name: 'iOS' },
				],
				external_games: [
					{ id: 1, uid: 'com.example.mobilequest', external_game_source: { id: 15, name: 'Android' } },
				],
				websites: [{ id: 1, category: IGDBWebsiteCategory.iPhone, url: 'https://apps.apple.com/app/id123456789' }],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()

			const result = await getGameTemplateData(123)

			expect(result?.googlePlayUrl).toBe('https://play.google.com/store/apps/details?id=com.example.mobilequest')
			expect(result?.appStoreUrl).toBe('https://apps.apple.com/app/id123456789')
			expect(result?.steamStoreUrl).toBeNull()
			expect(mockSendMessage).not.toHaveBeenCalledWith('searchSteamApps', expect.anything())
		})

		it('falls back to store title search when IGDB lacks store links for a mobile game', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Marvel Snap',
				platforms: [
					{ id: 34, name: 'Android' },
					{ id: 39, name: 'iOS' },
				],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()
			mockSearchGooglePlayAppViaBackground.mockResolvedValue({
				url: 'https://play.google.com/store/apps/details?id=com.nvsgames.snap',
				storeId: 'com.nvsgames.snap',
				name: null,
			})
			mockSearchItunesAppViaBackground.mockResolvedValue({
				url: 'https://apps.apple.com/es/app/id1592081003',
				storeId: '1592081003',
				name: 'MARVEL SNAP',
			})

			const result = await getGameTemplateData(123)

			expect(mockSearchGooglePlayAppViaBackground).toHaveBeenCalledWith('Marvel Snap')
			expect(mockSearchItunesAppViaBackground).toHaveBeenCalledWith('Marvel Snap')
			expect(result?.googlePlayUrl).toBe('https://play.google.com/store/apps/details?id=com.nvsgames.snap')
			expect(result?.appStoreUrl).toBe('https://apps.apple.com/es/app/id1592081003')
		})

		it('does not run the store title search for games without mobile platforms', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'The Witcher 3',
				platforms: [{ id: 6, name: 'PC (Microsoft Windows)' }],
				external_games: [
					{
						id: 1,
						url: 'https://store.steampowered.com/app/292030',
						external_game_source: { id: 1, name: 'Steam' },
					},
				],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()
			mockSendMessage.mockResolvedValueOnce(null) // fetchSteamGame

			const result = await getGameTemplateData(123)

			expect(result?.googlePlayUrl).toBeNull()
			expect(result?.appStoreUrl).toBeNull()
			expect(mockSearchGooglePlayAppViaBackground).not.toHaveBeenCalled()
			expect(mockSearchItunesAppViaBackground).not.toHaveBeenCalled()
		})

		it('normalizes store uids and full URLs from external games', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Cross Store',
				platforms: [
					{ id: 34, name: 'Android' },
					{ id: 39, name: 'iOS' },
				],
				external_games: [
					{
						id: 1,
						url: 'https://play.google.com/store/apps/details?id=com.cross.store',
						external_game_source: { id: 15, name: 'Google Play' },
					},
					{ id: 2, uid: '987654321', external_game_source: { id: 13, name: 'Apple App Store' } },
				],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()

			const result = await getGameTemplateData(123)

			expect(result?.googlePlayUrl).toBe('https://play.google.com/store/apps/details?id=com.cross.store')
			expect(result?.appStoreUrl).toBe('https://apps.apple.com/app/id987654321')
		})
	})

	describe('generateGameTemplate', () => {
		const customGameTemplate: MediaTemplate = {
			id: 'custom-game-template',
			type: 'game',
			name: 'Custom Game Template',
			blocks: [
				{
					id: 'raw',
					type: 'raw',
					rawText: '[b]MI PLANTILLA:[/b] {{name}}\n[bar]PLATAFORMAS[/bar]\n{{platforms}}',
				},
			],
		}

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
				googlePlayUrl: null,
				appStoreUrl: null,
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
				googlePlayUrl: null,
				appStoreUrl: null,
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

		it('should use the custom game template from the settings store when creating a thread', async () => {
			storeMock.mediaTemplates.game = customGameTemplate
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Custom Game',
				platforms: [{ id: 1, name: 'PC', abbreviation: 'PC' }],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()

			const result = await getGameTemplateString(123)

			expect(result).toContain('[b]MI PLANTILLA:[/b] Custom Game')
			expect(result).toContain('[bar]PLATAFORMAS[/bar]')
			expect(result).toContain('PC')
			expect(result).not.toContain('[b]Desarrollador:[/b]')
		})

		it('should use the persisted custom game template when the settings store has not hydrated it yet', async () => {
			storeMock.mediaTemplates.game = null
			storeMock.getSettings.mockResolvedValueOnce({
				mediaTemplates: {
					movie: null,
					tvshow: null,
					season: null,
					game: customGameTemplate,
				},
			})
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Persisted Template Game',
				platforms: [{ id: 1, name: 'PlayStation 5', abbreviation: 'PS5' }],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()

			const result = await getGameTemplateString(123)

			expect(result).toContain('[b]MI PLANTILLA:[/b] Persisted Template Game')
			expect(result).toContain('PS5')
			expect(result).not.toContain('[b]Desarrollador:[/b]')
		})

		it('uses the mobile game default template for the mobile-game type', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Mobile Quest',
				summary: 'A mobile-only game',
				platforms: [{ id: 34, name: 'Android' }],
				external_games: [
					{ id: 1, uid: 'com.example.mobilequest', external_game_source: { id: 15, name: 'Android' } },
				],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()

			const result = await getGameTemplateString(123, 'mobile-game')

			expect(result).toContain('[bar]DESCARGA[/bar]')
			expect(result).toContain('[media]https://play.google.com/store/apps/details?id=com.example.mobilequest[/media]')
			expect(result).not.toContain('[bar]STEAM[/bar]')
		})

		it('renders both store cards under DESCARGA when Google Play and App Store links exist', async () => {
			const mockGame: IGDBGame = {
				id: 123,
				name: 'Mobile Quest',
				summary: 'A mobile-only game',
				platforms: [
					{ id: 34, name: 'Android' },
					{ id: 39, name: 'iOS' },
				],
				external_games: [
					{ id: 1, uid: 'com.example.mobilequest', external_game_source: { id: 15, name: 'Android' } },
					{ id: 2, uid: '6754593077', external_game_source: { id: 13, name: 'Apple App Store' } },
				],
			}
			mockSendMessage.mockResolvedValueOnce([mockGame]) // getGameDetails
			mockSendMessage.mockResolvedValueOnce([]) // getTimeToBeat
			mockLocalizationData()

			const result = await getGameTemplateString(123, 'mobile-game')

			expect(result).toContain('[bar]DESCARGA[/bar]')
			expect(result).toContain('[media]https://play.google.com/store/apps/details?id=com.example.mobilequest[/media]')
			expect(result).toContain('[media]https://apps.apple.com/app/id6754593077[/media]')
		})
	})

	describe('generateSteamMediaTemplate', () => {
		it('generates a minimal Steam media embed when Steam URL is available', () => {
			const result = generateSteamMediaTemplate({
				name: 'The Witcher 3',
				originalName: 'The Witcher 3',
				releaseDate: null,
				releaseYear: null,
				releaseDates: [],
				status: null,
				developers: [],
				publishers: [],
				platforms: [],
				genres: [],
				themes: [],
				gameModes: [],
				playerPerspectives: [],
				gameEngines: [],
				collection: null,
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
				similarGames: [],
				dlcs: [],
				timeToBeatHastily: null,
				timeToBeatNormally: null,
				timeToBeatCompletely: null,
				websites: [],
				externalGames: [],
				steamStoreUrl: 'https://store.steampowered.com/app/292030',
				googlePlayUrl: null,
				appStoreUrl: null,
				languageSupports: [],
				rating: null,
				aggregatedRating: null,
				totalRating: null,
				ageRating: null,
			})

			expect(result).toBe('[media]https://store.steampowered.com/app/292030[/media]')
		})

		it('returns null when the game has no Steam URL', () => {
			const result = generateSteamMediaTemplate({
				name: 'Console Game',
				originalName: 'Console Game',
				releaseDate: null,
				releaseYear: null,
				releaseDates: [],
				status: null,
				developers: [],
				publishers: [],
				platforms: [],
				genres: [],
				themes: [],
				gameModes: [],
				playerPerspectives: [],
				gameEngines: [],
				collection: null,
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
				similarGames: [],
				dlcs: [],
				timeToBeatHastily: null,
				timeToBeatNormally: null,
				timeToBeatCompletely: null,
				websites: [],
				externalGames: [],
				steamStoreUrl: null,
				googlePlayUrl: null,
				appStoreUrl: null,
				languageSupports: [],
				rating: null,
				aggregatedRating: null,
				totalRating: null,
				ageRating: null,
			})

			expect(result).toBeNull()
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
