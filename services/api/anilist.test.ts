import { describe, expect, it, vi } from 'vitest'
import { renderTemplate } from '@/lib/template-engine'
import { DEFAULT_ANIME_TEMPLATE, DEFAULT_MANGA_TEMPLATE } from '@/features/templates'
import {
	normalizeAnimeTemplateData,
	normalizeMangaTemplateData,
	type AniListMedia,
} from './anilist'

vi.mock('@/lib/messaging', () => ({
	sendMessage: vi.fn(),
}))

vi.mock('@/store', () => ({
	useSettingsStore: {
		getState: () => ({ mediaTemplates: { anime: null, manga: null } }),
	},
}))

function createAniListMedia(overrides: Partial<AniListMedia> = {}): AniListMedia {
	return {
		id: 154587,
		idMal: 52991,
		type: 'ANIME',
		title: {
			romaji: 'Sousou no Frieren',
			english: "Frieren: Beyond Journey's End",
			native: 'Sousou no Frieren',
			userPreferred: 'Sousou no Frieren',
		},
		description: 'Tras derrotar al rey demonio.<br><br>Frieren inicia un nuevo viaje.',
		format: 'TV',
		status: 'FINISHED',
		episodes: 28,
		chapters: null,
		volumes: null,
		source: 'MANGA',
		startDate: { year: 2023, month: 9, day: 29 },
		genres: ['Adventure', 'Drama', 'Fantasy'],
		tags: [
			{ name: 'Shounen', rank: 80, isMediaSpoiler: false, isGeneralSpoiler: false },
			{ name: 'Time Skip', rank: 60, isMediaSpoiler: false, isGeneralSpoiler: false },
		],
		coverImage: {
			large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587.jpg',
			extraLarge: null,
		},
		bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587.jpg',
		siteUrl: 'https://anilist.co/anime/154587',
		trailer: { id: 'abc123', site: 'youtube', thumbnail: null },
		studios: { nodes: [{ name: 'Madhouse' }] },
		staff: {
			edges: [
				{ role: 'Story & Art', node: { name: { full: 'Kanehito Yamada' } } },
				{ role: 'Art', node: { name: { full: 'Tsukasa Abe' } } },
			],
		},
		externalLinks: [],
		...overrides,
	}
}

describe('AniList template normalization', () => {
	it('normalizes anime data for the forum template', () => {
		const data = normalizeAnimeTemplateData(createAniListMedia())

		expect(data.title).toBe("Sousou no Frieren (Frieren: Beyond Journey's End)")
		expect(data.genres).toEqual(['Aventura', 'Drama', 'Fantasía'])
		expect(data.source).toBe('Manga')
		expect(data.demographic).toBe('Shounen')
		expect(data.studios).toEqual(['Madhouse'])
		expect(data.episodes).toBe(28)
		expect(data.startDate).toBe('2023-09-29')
		expect(data.trailerUrl).toBe('https://www.youtube.com/watch?v=abc123')
		expect(data.anilistUrl).toBe('https://anilist.co/anime/154587')
		expect(data.malUrl).toBe('https://myanimelist.net/anime/52991')
		expect(data.linksText).toContain('AniList')
		expect(data.linksText).toContain('MAL')
	})

	it('normalizes manga data and preserves MangaUpdates external links', () => {
		const data = normalizeMangaTemplateData(
			createAniListMedia({
				id: 30002,
				idMal: 2,
				type: 'MANGA',
				format: 'MANGA',
				status: 'RELEASING',
				episodes: null,
				chapters: 376,
				volumes: 42,
				siteUrl: 'https://anilist.co/manga/30002',
				externalLinks: [{ site: 'MangaUpdates', url: 'https://www.mangaupdates.com/series.html?id=88', type: 'INFO' }],
			})
		)

		expect(data.status).toBe('En emisión')
		expect(data.format).toBe('Manga')
		expect(data.chapters).toBe(376)
		expect(data.volumes).toBe(42)
		expect(data.authors).toEqual(['Kanehito Yamada', 'Tsukasa Abe'])
		expect(data.malUrl).toBe('https://myanimelist.net/manga/2')
		expect(data.linksText).toContain('MangaUpdates')
	})

	it('cleans AniList descriptions before rendering', () => {
		const data = normalizeAnimeTemplateData(createAniListMedia({ description: '<p>Linea 1</p><br>Linea 2' }))

		expect(data.overview).toBe('Linea 1\n\nLinea 2')
	})

	it('renders defaults while omitting missing optional fields', () => {
		const animeData = normalizeAnimeTemplateData(
			createAniListMedia({
				idMal: null,
				episodes: null,
				trailer: null,
				studios: { nodes: [] },
				tags: [],
			})
		)
		const mangaData = normalizeMangaTemplateData(
			createAniListMedia({
				type: 'MANGA',
				idMal: null,
				chapters: null,
				volumes: null,
				staff: { edges: [] },
			})
		)

		const animeTemplate = renderTemplate(DEFAULT_ANIME_TEMPLATE, animeData)
		const mangaTemplate = renderTemplate(DEFAULT_MANGA_TEMPLATE, mangaData)

		expect(animeTemplate).toContain('[bar]INFO[/bar]')
		expect(animeTemplate).toContain('[b]Enlaces:[/b] [url=https://anilist.co/anime/154587]AniList[/url]')
		expect(animeTemplate).not.toContain('[b]Capítulos:[/b]')
		expect(animeTemplate).not.toContain('[bar]PV[/bar]')
		expect(mangaTemplate).toContain('[bar]SINOPSIS[/bar]')
		expect(mangaTemplate).not.toContain('[b]Autor:[/b]')
	})
})
