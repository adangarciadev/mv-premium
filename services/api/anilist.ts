/**
 * AniList API Service
 *
 * ARCHITECTURE: Pure RPC facade. All network requests are made via the
 * background script to keep external fetches out of content scripts.
 */

import { sendMessage } from '@/lib/messaging'
import { cachedFetch, createCacheKey, CACHE_TTL } from '@/services/media'
import { renderTemplate } from '@/lib/template-engine'
import { getDefaultTemplate } from '@/features/templates'
import { useSettingsStore } from '@/store'
import type { UploadResult } from '@/lib/messaging'
import type { AnimeTemplateDataInput, MangaTemplateDataInput, MediaTemplate } from '@/types/templates'

const CACHE_PREFIX = 'mv-anilist-v1'
const IMAGE_CACHE_PREFIX = 'mv-anilist-image-v1'
const ANILIST_SITE_URL = 'https://anilist.co'
const MAL_ANIME_URL = 'https://myanimelist.net/anime'
const MAL_MANGA_URL = 'https://myanimelist.net/manga'

type AniListMediaType = 'ANIME' | 'MANGA'

interface AniListFuzzyDate {
	year: number | null
	month: number | null
	day: number | null
}

interface AniListTitle {
	romaji: string | null
	english: string | null
	native: string | null
	userPreferred: string | null
}

interface AniListImage {
	large: string | null
	extraLarge: string | null
}

interface AniListTrailer {
	id: string | null
	site: string | null
	thumbnail: string | null
}

interface AniListTag {
	name: string
	rank: number
	isMediaSpoiler: boolean
	isGeneralSpoiler: boolean
}

interface AniListStudioConnection {
	nodes: Array<{ name: string }>
}

interface AniListStaffConnection {
	edges: Array<{
		role: string | null
		node: { name: { full: string | null } }
	}>
}

interface AniListExternalLink {
	site: string
	url: string
	type: string | null
}

export interface AniListMedia {
	id: number
	idMal: number | null
	type: AniListMediaType
	title: AniListTitle
	description: string | null
	format: string | null
	status: string | null
	episodes: number | null
	chapters: number | null
	volumes: number | null
	source: string | null
	startDate: AniListFuzzyDate
	genres: string[]
	tags: AniListTag[]
	coverImage: AniListImage
	bannerImage: string | null
	siteUrl: string | null
	trailer: AniListTrailer | null
	studios?: AniListStudioConnection
	staff?: AniListStaffConnection
	externalLinks?: AniListExternalLink[]
}

export interface AniListSearchResult {
	data?: {
		Page?: {
			media?: AniListMedia[]
		}
	}
}

export interface AniListMediaResult {
	data?: {
		Media?: AniListMedia | null
	}
}

export interface AnimeTemplateData extends AnimeTemplateDataInput {}
export interface MangaTemplateData extends MangaTemplateDataInput {}

const SEARCH_QUERY = `
query SearchMedia($search: String!, $type: MediaType!) {
	Page(page: 1, perPage: 20) {
		media(search: $search, type: $type, sort: SEARCH_MATCH) {
			id
			idMal
			type
			title { romaji english native userPreferred }
			format
			status
			episodes
			chapters
			volumes
			startDate { year month day }
			genres
			coverImage { large extraLarge }
			bannerImage
			siteUrl
		}
	}
}`

const DETAILS_QUERY = `
query MediaDetails($id: Int!, $type: MediaType!) {
	Media(id: $id, type: $type) {
		id
		idMal
		type
		title { romaji english native userPreferred }
		description(asHtml: false)
		format
		status
		episodes
		chapters
		volumes
		source
		startDate { year month day }
		genres
		tags { name rank isMediaSpoiler isGeneralSpoiler }
		coverImage { large extraLarge }
		bannerImage
		siteUrl
		trailer { id site thumbnail }
		studios(isMain: true) { nodes { name } }
		staff(perPage: 20) { edges { role node { name { full } } } }
		externalLinks { site url type }
	}
}`

function fetchAniListViaBackground<T>(query: string, variables: Record<string, unknown>): Promise<T> {
	return sendMessage('anilistRequest', { query, variables }) as Promise<T>
}

function fetchAniList<T>(query: string, variables: Record<string, unknown>, ttl = CACHE_TTL.MEDIUM): Promise<T> {
	const cacheKey = createCacheKey(JSON.stringify(variables), query)
	return cachedFetch(cacheKey, () => fetchAniListViaBackground<T>(query, variables), {
		prefix: CACHE_PREFIX,
		ttl,
		persist: false,
	})
}

async function rehostAniListImageUrl(imageUrl: string | null): Promise<string | null> {
	if (!imageUrl) return null

	try {
		const url = new URL(imageUrl)
		if (url.hostname !== 's4.anilist.co') return imageUrl
	} catch {
		return imageUrl
	}

	const cacheKey = createCacheKey('image', imageUrl)
	return cachedFetch(
		cacheKey,
		async () => {
			const result = (await sendMessage('rehostAniListImage', { url: imageUrl })) as UploadResult
			return result.success && result.url ? result.url : imageUrl
		},
		{ prefix: IMAGE_CACHE_PREFIX, ttl: CACHE_TTL.LONG, persist: false }
	)
}

async function rehostAniListTemplateImages<T extends { bannerUrl: string | null; coverUrl: string | null }>(
	data: T
): Promise<T> {
	if (data.bannerUrl && data.bannerUrl === data.coverUrl) {
		const imageUrl = await rehostAniListImageUrl(data.bannerUrl)
		return { ...data, bannerUrl: imageUrl, coverUrl: imageUrl }
	}

	const [bannerUrl, coverUrl] = await Promise.all([
		rehostAniListImageUrl(data.bannerUrl),
		rehostAniListImageUrl(data.coverUrl),
	])
	return { ...data, bannerUrl, coverUrl }
}

export function getAniListImageUrl(media: Pick<AniListMedia, 'bannerImage' | 'coverImage'>): string | null {
	return media.bannerImage || media.coverImage.extraLarge || media.coverImage.large || null
}

export function getAniListCoverUrl(media: Pick<AniListMedia, 'coverImage'>): string | null {
	return media.coverImage.extraLarge || media.coverImage.large || null
}

export function titleFromMedia(media: Pick<AniListMedia, 'title'>): string {
	const romaji = media.title.romaji?.trim()
	const english = media.title.english?.trim()
	const preferred = media.title.userPreferred?.trim()
	const native = media.title.native?.trim()
	const primary = romaji || preferred || english || native || 'Sin título'

	if (english && english !== primary) return `${primary} (${english})`
	return primary
}

function originalTitleFromMedia(media: Pick<AniListMedia, 'title'>): string {
	return media.title.romaji || media.title.native || titleFromMedia(media)
}

function formatDate(date: AniListFuzzyDate): string | null {
	if (!date.year) return null
	const month = date.month ? String(date.month).padStart(2, '0') : '01'
	const day = date.day ? String(date.day).padStart(2, '0') : '01'
	return `${date.year}-${month}-${day}`
}

function cleanDescription(description: string | null): string {
	if (!description) return ''
	return description
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/[ \t]+/g, ' ')
		.trim()
}

function inferDemographic(tags: AniListTag[]): string | null {
	const demographicTags = ['Shounen', 'Shoujo', 'Seinen', 'Josei', 'Kodomo']
	const match = tags
		.filter(tag => !tag.isMediaSpoiler && !tag.isGeneralSpoiler)
		.sort((a, b) => b.rank - a.rank)
		.find(tag => demographicTags.includes(tag.name))
	return match?.name ?? null
}

function formatExternalLinks(media: Pick<AniListMedia, 'siteUrl' | 'idMal' | 'externalLinks'>, malKind: 'anime' | 'manga') {
	const links = new Map<string, string>()
	if (media.siteUrl) links.set('AniList', media.siteUrl)
	if (media.idMal) {
		const baseUrl = malKind === 'anime' ? MAL_ANIME_URL : MAL_MANGA_URL
		links.set('MAL', `${baseUrl}/${media.idMal}`)
	}

	for (const link of media.externalLinks ?? []) {
		if (/mangaupdates/i.test(link.site)) links.set('MangaUpdates', link.url)
	}

	return [...links.entries()].map(([label, url]) => ({ label, url }))
}

function dedupeMediaResults(results: AniListMedia[][]): AniListMedia[] {
	const byId = new Map<number, AniListMedia>()
	for (const media of results.flat()) {
		if (!byId.has(media.id)) byId.set(media.id, media)
	}
	return [...byId.values()]
}

function formatLinksForTemplate(links: Array<{ label: string; url: string }>): string {
	return links.map(link => `[url=${link.url}]${link.label}[/url]`).join(' · ')
}

function trailerUrl(media: Pick<AniListMedia, 'trailer' | 'externalLinks'>): string | null {
	const trailer = media.trailer
	if (trailer?.site?.toLowerCase() === 'youtube' && trailer.id) {
		return `https://www.youtube.com/watch?v=${trailer.id}`
	}

	const youtubeLink = media.externalLinks?.find(link => /youtube/i.test(link.site) || /youtu\.?be/i.test(link.url))
	return youtubeLink?.url ?? null
}

function namesByRole(media: Pick<AniListMedia, 'staff'>, roles: RegExp[]): string[] {
	const names = new Set<string>()
	for (const edge of media.staff?.edges ?? []) {
		const role = edge.role || ''
		if (!roles.some(pattern => pattern.test(role))) continue
		const name = edge.node.name.full
		if (name) names.add(name)
	}
	return [...names].slice(0, 6)
}

function labelFromMap(value: string | null, labels: Record<string, string>): string | null {
	if (!value) return null
	return labels[value] || value.replace(/_/g, ' ').toLowerCase()
}

const FORMAT_LABELS: Record<string, string> = {
	TV: 'TV',
	TV_SHORT: 'TV corta',
	MOVIE: 'Película',
	SPECIAL: 'Especial',
	OVA: 'OVA',
	ONA: 'ONA',
	MUSIC: 'Musical',
	MANGA: 'Manga',
	NOVEL: 'Novela',
	ONE_SHOT: 'One-shot',
}

const STATUS_LABELS: Record<string, string> = {
	FINISHED: 'Finalizada',
	RELEASING: 'En emisión',
	NOT_YET_RELEASED: 'Próximamente',
	CANCELLED: 'Cancelada',
	HIATUS: 'En pausa',
}

const SOURCE_LABELS: Record<string, string> = {
	ORIGINAL: 'Original',
	MANGA: 'Manga',
	LIGHT_NOVEL: 'Novela ligera',
	VISUAL_NOVEL: 'Novela visual',
	VIDEO_GAME: 'Videojuego',
	OTHER: 'Otro',
	NOVEL: 'Novela',
	DOUJINSHI: 'Doujinshi',
	ANIME: 'Anime',
	WEB_NOVEL: 'Web novel',
	LIVE_ACTION: 'Live action',
	GAME: 'Juego',
	COMIC: 'Cómic',
	MULTIMEDIA_PROJECT: 'Proyecto multimedia',
	PICTURE_BOOK: 'Libro ilustrado',
}

const GENRE_LABELS: Record<string, string> = {
	Action: 'Acción',
	Adventure: 'Aventura',
	Comedy: 'Comedia',
	Drama: 'Drama',
	Ecchi: 'Ecchi',
	Fantasy: 'Fantasía',
	Horror: 'Terror',
	'Mahou Shoujo': 'Mahou shoujo',
	Mecha: 'Mecha',
	Music: 'Música',
	Mystery: 'Misterio',
	Psychological: 'Psicológico',
	Romance: 'Romance',
	'Sci-Fi': 'Ciencia ficción',
	'Slice of Life': 'Slice of life',
	Sports: 'Deportes',
	Supernatural: 'Sobrenatural',
	Thriller: 'Thriller',
}

function translateGenres(genres: string[]): string[] {
	return genres.map(genre => GENRE_LABELS[genre] || genre)
}

export function normalizeAnimeTemplateData(media: AniListMedia): AnimeTemplateData {
	const links = formatExternalLinks(media, 'anime')
	return {
		title: titleFromMedia(media),
		originalTitle: originalTitleFromMedia(media),
		genres: translateGenres(media.genres),
		source: labelFromMap(media.source, SOURCE_LABELS),
		demographic: inferDemographic(media.tags),
		studios: media.studios?.nodes.map(studio => studio.name).filter(Boolean) ?? [],
		episodes: media.episodes,
		status: labelFromMap(media.status, STATUS_LABELS),
		format: labelFromMap(media.format, FORMAT_LABELS),
		startDate: formatDate(media.startDate),
		year: media.startDate.year ? String(media.startDate.year) : null,
		overview: cleanDescription(media.description),
		bannerUrl: getAniListImageUrl(media),
		coverUrl: getAniListCoverUrl(media),
		trailerUrl: trailerUrl(media),
		anilistUrl: media.siteUrl || `${ANILIST_SITE_URL}/anime/${media.id}`,
		malUrl: media.idMal ? `${MAL_ANIME_URL}/${media.idMal}` : null,
		links,
		linksText: formatLinksForTemplate(links),
	}
}

export function normalizeMangaTemplateData(media: AniListMedia): MangaTemplateData {
	const links = formatExternalLinks(media, 'manga')
	return {
		title: titleFromMedia(media),
		originalTitle: originalTitleFromMedia(media),
		genres: translateGenres(media.genres),
		demographic: inferDemographic(media.tags),
		authors: namesByRole(media, [/story/i, /art/i, /original creator/i, /creator/i]),
		status: labelFromMap(media.status, STATUS_LABELS),
		format: labelFromMap(media.format, FORMAT_LABELS),
		chapters: media.chapters,
		volumes: media.volumes,
		startDate: formatDate(media.startDate),
		year: media.startDate.year ? String(media.startDate.year) : null,
		overview: cleanDescription(media.description),
		bannerUrl: getAniListImageUrl(media),
		coverUrl: getAniListCoverUrl(media),
		anilistUrl: media.siteUrl || `${ANILIST_SITE_URL}/manga/${media.id}`,
		malUrl: media.idMal ? `${MAL_MANGA_URL}/${media.idMal}` : null,
		links,
		linksText: formatLinksForTemplate(links),
	}
}

export async function searchAnime(query: string): Promise<AniListMedia[]> {
	const result = await fetchAniList<AniListSearchResult>(
		SEARCH_QUERY,
		{ search: query.trim(), type: 'ANIME' },
		CACHE_TTL.SHORT
	)
	return dedupeMediaResults([result.data?.Page?.media ?? []])
}

export async function searchManga(query: string): Promise<AniListMedia[]> {
	const result = await fetchAniList<AniListSearchResult>(
		SEARCH_QUERY,
		{ search: query.trim(), type: 'MANGA' },
		CACHE_TTL.SHORT
	)
	return dedupeMediaResults([result.data?.Page?.media ?? []])
}

async function getMediaDetails(mediaId: number, type: AniListMediaType): Promise<AniListMedia> {
	const result = await fetchAniList<AniListMediaResult>(DETAILS_QUERY, { id: mediaId, type }, CACHE_TTL.MEDIUM)
	const media = result.data?.Media
	if (!media) throw new Error('No se encontró el contenido en AniList')
	return media
}

export async function getAnimeTemplateData(mediaId: number): Promise<AnimeTemplateData> {
	return rehostAniListTemplateImages(normalizeAnimeTemplateData(await getMediaDetails(mediaId, 'ANIME')))
}

export async function getMangaTemplateData(mediaId: number): Promise<MangaTemplateData> {
	return rehostAniListTemplateImages(normalizeMangaTemplateData(await getMediaDetails(mediaId, 'MANGA')))
}

function getActiveTemplate(type: 'anime' | 'manga'): MediaTemplate {
	const { mediaTemplates } = useSettingsStore.getState()
	return mediaTemplates[type] || getDefaultTemplate(type)
}

export function generateAnimeTemplate(data: AnimeTemplateData): string {
	return renderTemplate(getActiveTemplate('anime'), data)
}

export function generateMangaTemplate(data: MangaTemplateData): string {
	return renderTemplate(getActiveTemplate('manga'), data)
}
