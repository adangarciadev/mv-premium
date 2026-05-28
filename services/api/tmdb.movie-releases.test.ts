import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sendMessageMock, cachedFetchMock } = vi.hoisted(() => ({
	sendMessageMock: vi.fn(),
	cachedFetchMock: vi.fn((...args: unknown[]) => {
		const fetcher = args[1] as () => Promise<unknown>
		return fetcher()
	}),
}))

vi.mock('@/lib/messaging', () => ({
	sendMessage: (...args: unknown[]) => sendMessageMock(...args),
}))

vi.mock('@/services/media', () => ({
	CACHE_TTL: {
		SHORT: 60_000,
		MEDIUM: 300_000,
		LONG: 1_800_000,
	},
	cachedFetch: (...args: unknown[]) => cachedFetchMock(...args),
	createCacheKey: (...parts: Array<string | number>) => parts.join(':'),
}))

vi.mock('@/store', () => ({
	useSettingsStore: {
		getState: () => ({ mediaTemplates: {} }),
	},
}))

vi.mock('@/features/templates', () => ({
	getDefaultTemplate: vi.fn(),
}))

vi.mock('@/lib/template-engine', () => ({
	renderTemplate: vi.fn(),
}))

vi.mock('@/lib/date-utils', () => ({
	formatDateLong: (value: string) => value,
}))

import { buildMovieThreadTitle, getUpcomingSpanishMovieReleases, hasTmdbApiKey } from './tmdb'

describe('TMDB Spanish movie releases', () => {
	beforeEach(() => {
		sendMessageMock.mockReset()
		cachedFetchMock.mockClear()
	})

	it('checks whether TMDB is configured in the background', async () => {
		sendMessageMock.mockResolvedValue(true)

		await expect(hasTmdbApiKey()).resolves.toBe(true)
		expect(sendMessageMock).toHaveBeenCalledWith('hasTmdbApiKey')
	})

	it('discovers Spanish theatrical releases and uses the ES theatrical date', async () => {
		sendMessageMock.mockImplementation((type: string, payload?: { endpoint: string; params?: Record<string, string> }) => {
			if (type !== 'tmdbRequest') return Promise.resolve(null)
			if (payload?.endpoint === '/discover/movie') {
				return Promise.resolve({
					page: 1,
					total_pages: 1,
					total_results: 1,
					results: [
						{
							id: 10,
							title: 'Una película',
							original_title: 'A Movie',
							overview: 'Estreno en salas españolas con ficha suficiente para aparecer en el calendario de próximos lanzamientos.',
							poster_path: '/poster.jpg',
							backdrop_path: '/backdrop.jpg',
							release_date: '2026-06-01',
							vote_average: 7,
							popularity: 8,
							genre_ids: [18],
						},
					],
				})
			}
			if (payload?.endpoint === '/movie/10/release_dates') {
				return Promise.resolve({
					results: [
						{
							iso_3166_1: 'ES',
							release_dates: [{ certification: '', release_date: '2026-05-21T00:00:00.000Z', type: 3 }],
						},
					],
				})
			}
			return Promise.resolve({ results: [] })
		})

		const releases = await getUpcomingSpanishMovieReleases({
			from: new Date('2026-05-01T00:00:00'),
			to: new Date('2026-05-31T00:00:00'),
		})

		expect(sendMessageMock).toHaveBeenCalledWith(
			'tmdbRequest',
			expect.objectContaining({
				endpoint: '/discover/movie',
				params: expect.objectContaining({
					region: 'ES',
					'release_date.gte': '2026-05-01',
					'release_date.lte': '2026-05-31',
					with_release_type: '2|3',
				}),
			})
		)
		expect(releases).toEqual([
			expect.objectContaining({
				id: 10,
				title: 'Una película',
				releaseDate: '2026-05-21',
				posterUrl: 'https://image.tmdb.org/t/p/w342/poster.jpg',
			}),
		])
	})

	it('orders releases by Spanish release date and respects the limit', async () => {
		sendMessageMock.mockImplementation((type: string, payload?: { endpoint: string }) => {
			if (type !== 'tmdbRequest') return Promise.resolve(null)
			if (payload?.endpoint === '/discover/movie') {
				return Promise.resolve({
					page: 1,
					total_pages: 1,
					total_results: 2,
					results: [
						{
							id: 1,
							title: 'Tarde',
							original_title: 'Late',
							overview: 'Estreno comercial con metadatos suficientes para el calendario de cine español.',
							poster_path: '/late.jpg',
							backdrop_path: null,
							release_date: '2026-05-20',
							vote_average: 6,
							popularity: 8,
							genre_ids: [18],
						},
						{
							id: 2,
							title: 'Pronto',
							original_title: 'Soon',
							overview: 'Estreno comercial con metadatos suficientes para el calendario de cine español.',
							poster_path: '/soon.jpg',
							backdrop_path: null,
							release_date: '2026-05-10',
							vote_average: 6,
							popularity: 8,
							genre_ids: [18],
						},
					],
				})
			}
			const id = payload?.endpoint.match(/\/movie\/(\d+)\/release_dates/)?.[1]
			return Promise.resolve({
				results: [
					{
						iso_3166_1: 'ES',
						release_dates: [
							{
								certification: '',
								release_date: id === '1' ? '2026-05-20T00:00:00.000Z' : '2026-05-10T00:00:00.000Z',
								type: 3,
							},
						],
					},
				],
			})
		})

		const releases = await getUpcomingSpanishMovieReleases({
			from: new Date('2026-05-01T00:00:00'),
			to: new Date('2026-05-31T00:00:00'),
			limit: 1,
		})

		expect(releases.map(release => release.title)).toEqual(['Pronto'])
	})

	it('ignores older Spanish theatrical dates outside the requested range', async () => {
		sendMessageMock.mockImplementation((type: string, payload?: { endpoint: string; params?: Record<string, string> }) => {
			if (type !== 'tmdbRequest') return Promise.resolve(null)
			if (payload?.endpoint === '/discover/movie') {
				return Promise.resolve({
					page: 1,
					total_pages: 1,
					total_results: 1,
					results: [
						{
							id: 20,
							title: 'El caso Hübener',
							original_title: 'Truth & Treason',
							overview: 'Estreno comercial con metadatos suficientes para el calendario de cine español.',
							poster_path: '/truth.jpg',
							backdrop_path: null,
							release_date: '2025-10-01',
							vote_average: 6,
							popularity: 8,
							genre_ids: [18],
						},
					],
				})
			}
			if (payload?.endpoint === '/movie/20/release_dates') {
				return Promise.resolve({
					results: [
						{
							iso_3166_1: 'ES',
							release_dates: [
								{ certification: '', release_date: '2025-10-01T00:00:00.000Z', type: 3 },
								{ certification: '', release_date: '2026-05-29T00:00:00.000Z', type: 3 },
							],
						},
					],
				})
			}
			return Promise.resolve({ results: [] })
		})

		const releases = await getUpcomingSpanishMovieReleases({
			from: new Date('2026-05-28T00:00:00'),
			to: new Date('2026-06-28T00:00:00'),
		})

		expect(releases[0]?.releaseDate).toBe('2026-05-29')
	})

	it('excludes movies without an explicit Spanish theatrical release date', async () => {
		sendMessageMock.mockImplementation((type: string, payload?: { endpoint: string; params?: Record<string, string> }) => {
			if (type !== 'tmdbRequest') return Promise.resolve(null)
			if (payload?.endpoint === '/discover/movie') {
				return Promise.resolve({
					page: 1,
					total_pages: 1,
					total_results: 1,
					results: [
						{
							id: 25,
							title: 'TRIP',
							original_title: 'TRIP',
							overview: 'Ficha pobre que no deberia aparecer sin una fecha teatral espanola confirmada.',
							poster_path: '/trip.jpg',
							backdrop_path: null,
							release_date: '2026-05-29',
							vote_average: 0,
							popularity: 8,
							genre_ids: [18],
						},
					],
				})
			}
			if (payload?.endpoint === '/movie/25/release_dates') {
				return Promise.resolve({
					results: [
						{
							iso_3166_1: 'US',
							release_dates: [{ certification: '', release_date: '2026-05-29T00:00:00.000Z', type: 3 }],
						},
					],
				})
			}
			return Promise.resolve({ results: [] })
		})

		const releases = await getUpcomingSpanishMovieReleases({
			from: new Date('2026-05-28T00:00:00'),
			to: new Date('2026-06-28T00:00:00'),
		})

		expect(releases).toEqual([])
	})

	it('enriches selected releases with genres, director, runtime, and rerelease notes', async () => {
		sendMessageMock.mockImplementation((type: string, payload?: { endpoint: string; params?: Record<string, string> }) => {
			if (type !== 'tmdbRequest') return Promise.resolve(null)
			if (payload?.endpoint === '/discover/movie') {
				return Promise.resolve({
					page: 1,
					total_pages: 1,
					total_results: 1,
					results: [
						{
							id: 30,
							title: 'Shrek',
							original_title: 'Shrek',
							overview: '',
							poster_path: '/old-poster.jpg',
							backdrop_path: null,
							release_date: '2001-06-29',
							vote_average: 7.8,
							genre_ids: [16],
						},
					],
				})
			}
			if (payload?.endpoint === '/movie/30/release_dates') {
				return Promise.resolve({
					results: [
						{
							iso_3166_1: 'ES',
							release_dates: [
								{
									certification: '',
									release_date: '2026-05-29T00:00:00.000Z',
									note: '25th Anniversary re-release',
									type: 3,
								},
							],
						},
					],
				})
			}
			if (payload?.endpoint === '/movie/30') {
				return Promise.resolve({
					id: 30,
					title: 'Shrek',
					original_title: 'Shrek',
					overview: '',
					poster_path: '/poster.jpg',
					backdrop_path: null,
					release_date: '2001-06-29',
					vote_average: 7.8,
					genre_ids: [16],
					runtime: 87,
					tagline: '',
					production_countries: [],
					genres: [{ id: 16, name: 'Animation' }],
					credits: {
						cast: [],
						crew: [{ id: 1, name: 'Andrew Adamson', job: 'Director', department: 'Directing' }],
					},
				})
			}
			return Promise.resolve({ results: [] })
		})

		const releases = await getUpcomingSpanishMovieReleases({
			from: new Date('2026-05-01T00:00:00'),
			to: new Date('2026-05-31T00:00:00'),
		})

		expect(sendMessageMock).toHaveBeenCalledWith(
			'tmdbRequest',
			expect.objectContaining({
				endpoint: '/movie/30',
				params: expect.objectContaining({ append_to_response: 'credits' }),
			})
		)
		expect(releases[0]).toEqual(
			expect.objectContaining({
				title: 'Shrek',
				releaseDate: '2026-05-29',
				genres: ['Animación'],
				director: 'Andrew Adamson',
				runtime: 87,
				releaseNote: '25th Anniversary re-release',
				isRerelease: true,
			})
		)
	})

	it('filters out short films with known runtimes', async () => {
		sendMessageMock.mockImplementation((type: string, payload?: { endpoint: string; params?: Record<string, string> }) => {
			if (type !== 'tmdbRequest') return Promise.resolve(null)
			if (payload?.endpoint === '/discover/movie') {
				return Promise.resolve({
					page: 1,
					total_pages: 1,
					total_results: 2,
					results: [
						{
							id: 40,
							title: 'L’Ourse et L’oiseau',
							original_title: 'L’Ourse et L’oiseau',
							overview: 'Cortometraje con duracion conocida que no debe mostrarse como largometraje de cartelera.',
							poster_path: null,
							backdrop_path: null,
							release_date: '2026-05-29',
							vote_average: 6,
							popularity: 8,
							genre_ids: [16],
						},
						{
							id: 41,
							title: 'Largometraje',
							original_title: 'Largometraje',
							overview: 'Estreno comercial con metadatos suficientes para el calendario de cine español.',
							poster_path: '/feature.jpg',
							backdrop_path: null,
							release_date: '2026-05-29',
							vote_average: 6,
							popularity: 8,
							genre_ids: [18],
						},
					],
				})
			}
			if (payload?.endpoint === '/movie/40/release_dates' || payload?.endpoint === '/movie/41/release_dates') {
				return Promise.resolve({
					results: [
						{
							iso_3166_1: 'ES',
							release_dates: [{ certification: '', release_date: '2026-05-29T00:00:00.000Z', type: 3 }],
						},
					],
				})
			}
			if (payload?.endpoint === '/movie/40') {
				return Promise.resolve({
					id: 40,
					title: 'L’Ourse et L’oiseau',
					original_title: 'L’Ourse et L’oiseau',
					overview: '',
					poster_path: null,
					backdrop_path: null,
					release_date: '2026-05-29',
					vote_average: 6,
					genre_ids: [],
					runtime: 20,
					tagline: '',
					production_countries: [],
					genres: [],
					credits: { cast: [], crew: [] },
				})
			}
			if (payload?.endpoint === '/movie/41') {
				return Promise.resolve({
					id: 41,
					title: 'Largometraje',
					original_title: 'Largometraje',
					overview: '',
					poster_path: null,
					backdrop_path: null,
					release_date: '2026-05-29',
					vote_average: 6,
					genre_ids: [],
					runtime: 95,
					tagline: '',
					production_countries: [],
					genres: [],
					credits: { cast: [], crew: [] },
				})
			}
			return Promise.resolve({ results: [] })
		})

		const releases = await getUpcomingSpanishMovieReleases({
			from: new Date('2026-05-28T00:00:00'),
			to: new Date('2026-06-28T00:00:00'),
		})

		expect(releases.map(release => release.title)).toEqual(['Largometraje'])
	})

	it('does not supplement missing re-releases from external sources', async () => {
		sendMessageMock.mockImplementation((type: string, payload?: { endpoint: string }) => {
			if (type !== 'tmdbRequest') return Promise.resolve(null)
			if (payload?.endpoint === '/discover/movie') {
				return Promise.resolve({ page: 1, total_pages: 1, total_results: 0, results: [] })
			}
			return Promise.resolve({ results: [] })
		})

		const releases = await getUpcomingSpanishMovieReleases({
			from: new Date('2026-05-28T00:00:00'),
			to: new Date('2026-06-28T00:00:00'),
		})

		expect(releases).toEqual([])
		expect(sendMessageMock).not.toHaveBeenCalledWith(
			'tmdbRequest',
			expect.objectContaining({ endpoint: '/search/movie' })
		)
	})

	it('builds Mediavida movie thread titles with director and year', () => {
		expect(
			buildMovieThreadTitle({
				title: 'La Odisea',
				director: 'Christopher Nolan',
				year: '2026',
			})
		).toBe("'La Odisea', de Christopher Nolan (2026)")
	})
})
