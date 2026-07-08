import { storage } from '@wxt-dev/storage'
import { logger } from '@/lib/logger'
import { STORAGE_KEYS } from '@/constants'

const FRAGRANTICA_HOSTS = new Set(['fragrantica.com', 'fragrantica.es'])
const FRAGRANTICA_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const FRAGRANTICA_REQUEST_TIMEOUT_MS = 15000
const MAX_CACHE_ENTRIES = 120
const FRAGRANTICA_CACHE_SCHEMA_VERSION = 7

export interface FragranticaRating {
	value: number
	count: number | null
}

export interface FragranticaAccord {
	label: string
	color: string
	score: number
}

export interface FragranticaPyramid {
	top: string[]
	middle: string[]
	base: string[]
}

export interface FragranticaWear {
	key: string
	label: string
	score: number
	source?: 'votes' | 'profile'
}

export interface FragranticaFragrance {
	url: string
	id: string
	title: string
	brand: string
	audience: string
	image: string
	fallbackImage: string
	rating: FragranticaRating | null
	accords: FragranticaAccord[]
	pyramid: FragranticaPyramid
	/** Flat "Notas de fragancia" list, used when Fragrantica doesn't publish a Salida/Corazón/Base pyramid for this perfume. */
	notes: string[]
	wear: FragranticaWear[]
}

interface FragranticaCacheEntry {
	createdAt: number
	version?: number
	payload: FragranticaFragrance
}

const fragranticaCacheStorage = storage.defineItem<Record<string, FragranticaCacheEntry>>(
	`local:${STORAGE_KEYS.FRAGRANTICA_CACHE}`,
	{ fallback: {} }
)

export function normalizeFragranticaPerfumeUrl(rawHref: string): string | null {
	try {
		const url = new URL(rawHref.trim())
		const host = url.hostname.toLowerCase().replace(/^www\./, '')

		if (!FRAGRANTICA_HOSTS.has(host) || !/^\/perfume\/.+\/.+\.html$/i.test(url.pathname)) {
			return null
		}

		url.protocol = 'https:'
		url.hostname = 'www.fragrantica.es'
		url.hash = ''
		url.search = ''
		return url.toString()
	} catch {
		return null
	}
}

export async function fetchFragranticaFragrance(rawUrl: string): Promise<FragranticaFragrance> {
	const url = normalizeFragranticaPerfumeUrl(rawUrl)
	if (!url) {
		throw new Error('El enlace no es una ficha de perfume de Fragrantica.')
	}

	const cache = await fragranticaCacheStorage.getValue()
	const cached = cache[url]
	if (
		cached &&
		cached.version === FRAGRANTICA_CACHE_SCHEMA_VERSION &&
		Date.now() - cached.createdAt < FRAGRANTICA_CACHE_TTL_MS
	) {
		return cached.payload
	}

	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), FRAGRANTICA_REQUEST_TIMEOUT_MS)

	try {
		const response = await fetch(url, {
			credentials: 'include',
			redirect: 'follow',
			signal: controller.signal,
			headers: {
				Accept: 'text/html,application/xhtml+xml',
			},
		})

		if (!response.ok) {
			throw new Error(`Fragrantica respondió con HTTP ${response.status}.`)
		}

		const payload = parseFragranticaHtml(await response.text(), url)
		await writeFragranticaCache(url, payload)
		return payload
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			logger.warn('Fragrantica request timeout', { url, timeoutMs: FRAGRANTICA_REQUEST_TIMEOUT_MS })
			throw new Error('Fragrantica tardó demasiado en responder.')
		}
		throw error
	} finally {
		clearTimeout(timeoutId)
	}
}

async function writeFragranticaCache(url: string, payload: FragranticaFragrance): Promise<void> {
	try {
		const cache = await fragranticaCacheStorage.getValue()
		const entries = Object.entries({
			...cache,
			[url]: { createdAt: Date.now(), version: FRAGRANTICA_CACHE_SCHEMA_VERSION, payload },
		}).sort(([, a], [, b]) => b.createdAt - a.createdAt)

		await fragranticaCacheStorage.setValue(Object.fromEntries(entries.slice(0, MAX_CACHE_ENTRIES)))
	} catch (error) {
		logger.warn('Failed to persist Fragrantica cache', error)
	}
}

export function parseFragranticaHtml(html: string, url: string): FragranticaFragrance {
	const id = extractFragranceId(url)
	const jsonLd = collectJsonLd(html)
	const product = findJsonLdProduct(jsonLd)
	const rawTitle = cleanText(
		getTagText(html, 'h1') ||
			getJsonLdValue(product, 'name') ||
			getMeta(html, 'og:title') ||
			getTagText(html, 'title')
	)
	const description = cleanText(
		getJsonLdValue(product, 'description') ||
			getMeta(html, 'og:description') ||
			getMeta(html, 'description')
	)
	const fallbackImage = normalizeImageUrl(
		firstValue(getJsonLdValue(product, 'image')) || getMeta(html, 'og:image'),
		url
	)
	const accords = collectAccords(html)
	const pyramid = collectPyramid(html, description)
	const notes = hasPyramidNotes(pyramid) ? [] : collectFlatNotes(html)

	return {
		url,
		id,
		title: trimTitle(rawTitle),
		brand: cleanText(
			getJsonLdValue(getJsonLdValue(product, 'brand'), 'name') ||
				getItemPropText(html, 'brand') ||
				inferBrandFromTitle(rawTitle)
		),
		audience: extractAudience(rawTitle),
		image: collectFragranceImage(html, id, fallbackImage),
		fallbackImage,
		rating: normalizeRating(getJsonLdValue(product, 'aggregateRating')) || collectRating(html),
		accords,
		pyramid,
		notes,
		wear: collectWear(html, { accords, pyramid, description }),
	}
}

function hasPyramidNotes(pyramid: FragranticaPyramid): boolean {
	return Boolean(pyramid.top.length || pyramid.middle.length || pyramid.base.length)
}

/**
 * Some Fragrantica pages (usually newer or crowd-sourced perfumes) skip the curated
 * Salida/Corazón/Base pyramid and only show a flat "Notas de fragancia" note-voting widget.
 * This is a best-effort fallback for those pages.
 */
function collectFlatNotes(html: string): string[] {
	const decoded = decodeHtmlEntities(html)
		.replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style\b[\s\S]*?<\/style>/gi, ' ')

	const widget = extractPyramidWidgetRegion(decoded)
	const structural = widget ? collectPyramidNoteLabels(widget) : []
	if (structural.length) return structural

	const region = extractFlatNotesRegion(decoded)
	return region ? collectNoteLinks(region) : []
}

function extractFlatNotesRegion(html: string): string {
	const startPatterns = [/Notas de [Ff]ragancia/i, /Fragrance Notes?/i]
	const endPatterns = [
		/Acordes principales/i,
		/Buscar por acordes/i,
		/Valoraciones de usuarios/i,
		/Rendimiento/i,
		/Votar por ingredientes/i,
		/Vote for ingredients/i,
		/Rese/i,
	]
	let startIndex = -1
	for (const pattern of startPatterns) {
		const match = html.match(pattern)
		if (match && (startIndex < 0 || match.index! < startIndex)) startIndex = match.index!
	}
	if (startIndex < 0) return ''

	const rest = html.slice(startIndex + 1)
	let endIndex = html.length
	for (const pattern of endPatterns) {
		const match = rest.match(pattern)
		if (match && match.index! > 0) endIndex = Math.min(endIndex, startIndex + 1 + match.index!)
	}
	return html.slice(startIndex, endIndex)
}

function extractFragranceId(url: string): string {
	return new URL(url).pathname.match(/-(\d+)\.html$/)?.[1] || ''
}

function collectFragranceImage(html: string, id: string, fallbackImage: string): string {
	const pattern = /https?:\/\/fimgs\.net\/mdimg\/perfume-thumbs\/[^"'\s<>]+/gi
	for (const match of html.matchAll(pattern)) {
		const value = decodeHtmlEntities(match[0])
		if (!id || value.includes(`.${id}.`)) return value
	}
	return id ? `https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.${id}.avif` : fallbackImage
}

function collectJsonLd(html: string): unknown[] {
	const blocks: unknown[] = []
	const pattern = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
	for (const match of html.matchAll(pattern)) {
		try {
			blocks.push(JSON.parse(decodeHtmlEntities(match[1].trim())))
		} catch {
			// Fragrantica can ship unrelated malformed structured-data blocks.
		}
	}
	return blocks
}

function findJsonLdProduct(values: unknown[]): Record<string, unknown> | null {
	const queue = [...values]
	while (queue.length) {
		const item = queue.shift()
		if (!isRecord(item)) continue

		const type = item['@type']
		const types = Array.isArray(type) ? type : [type]
		if (types.some(value => String(value).toLowerCase() === 'product')) return item

		for (const value of Object.values(item)) {
			if (Array.isArray(value)) queue.push(...value)
			else if (isRecord(value)) queue.push(value)
		}
	}
	return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

function getJsonLdValue(source: unknown, key: string): unknown {
	return isRecord(source) ? source[key] || '' : ''
}

function getMeta(html: string, name: string): string {
	for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
		const tag = match[0]
		const metaName = getAttribute(tag, 'property') || getAttribute(tag, 'name')
		if (metaName === name) return decodeHtmlEntities(getAttribute(tag, 'content'))
	}
	return ''
}

function getTagText(html: string, tagName: string): string {
	const match = html.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'))
	return match ? textFromHtml(match[1]) : ''
}

function getItemPropText(html: string, itemProp: string): string {
	const pattern = new RegExp(
		`<([a-z][\\w:-]*)\\b[^>]*itemprop=["']${escapeRegExp(itemProp)}["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
		'i'
	)
	const match = html.match(pattern)
	return match ? textFromHtml(match[2]) : ''
}

function collectRating(html: string): FragranticaRating | null {
	const text = textFromHtml(html)
	const match =
		text.match(/Calificaci\S*\s+([\d.,]+)\s+de\s+5\s+con\s+([\d.,]+)\s+votos/i) ||
		text.match(/Rated\s+([\d.,]+)\s+out\s+of\s+5\s+with\s+([\d.,]+)\s+votes/i)
	if (!match) return null

	const value = parseLocaleNumber(match[1])
	const count = parseVoteCount(match[2])
	return Number.isFinite(value) ? { value: Math.round(value * 100) / 100, count } : null
}

function collectAccords(html: string): FragranticaAccord[] {
	const seen = new Set<string>()
	const accords: FragranticaAccord[] = []
	const pattern =
		/<([a-z][\w:-]*)\b([^>]*class=["'][^"']*(?:accord-box|accordBox)[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi

	for (const match of html.matchAll(pattern)) {
		const label = textFromHtml(match[3])
		const key = normalizeForSearch(label)
		if (!key || seen.has(key)) continue
		seen.add(key)

		const style = `${getAttribute(match[2], 'style')} ${match[2]} ${match[3]}`
		accords.push({
			label,
			color: extractCssColor(style) || '#8bc6a9',
			score: extractWidthPercent(style) || Math.max(42, 100 - accords.length * 8),
		})
	}

	const fallbackAccords = collectAccordsFromText(textFromHtml(html))
	for (const accord of fallbackAccords) {
		const key = normalizeForSearch(accord.label)
		if (!key || seen.has(key)) continue
		seen.add(key)
		accords.push(accord)
	}

	return applyAccordScores(accords).slice(0, 9)
}

function collectAccordsFromText(text: string): FragranticaAccord[] {
	const chunk = extractTextBetween(text, /acordes principales/i, [
		/Buscar por acordes/i,
		/Valoraciones de usuarios/i,
		/Puntuaci/i,
		/Piramide del perfume/i,
		/Notas? de Salida/i,
	])
	if (!chunk) return []

	const vocabulary: Array<[string, string]> = [
		['fresco especiado', '#9ed7d5'],
		['cálido especiado', '#d79b63'],
		['cítrico', '#e5dd30'],
		['aromático', '#9acb76'],
		['amaderado', '#b88454'],
		['ámbar', '#bfa33f'],
		['almizclado', '#d8d1c2'],
		['lavanda', '#b1a6d9'],
		['herbal', '#7fb36a'],
		['verde', '#77b978'],
		['floral', '#e2a1bd'],
		['florales blancos', '#efe8d0'],
		['dulce', '#d8a1b3'],
		['avainillado', '#d9bd76'],
		['balsámico', '#b98b5f'],
		['fresco', '#a7d8d2'],
		['acuático', '#75b9d2'],
		['marino', '#6fb4d0'],
		['afrutados', '#d96f75'],
		['frutal', '#d96f75'],
		['atalcado', '#d7c7bc'],
		['iris', '#b8a6d8'],
		['terroso', '#8d7a54'],
		['musgoso', '#6d8c5d'],
		['cuero', '#8f684d'],
		['ahumado', '#8f8f8f'],
		['tabaco', '#9b7656'],
		['oud', '#765842'],
		['rosas', '#d7839d'],
		['rosa', '#d7839d'],
		['especiado suave', '#cfa06a'],
		['canela', '#b86f45'],
		['fresh spicy', '#9ed7d5'],
		['warm spicy', '#d79b63'],
		['citrus', '#e5dd30'],
		['aromatic', '#9acb76'],
		['woody', '#b88454'],
		['amber', '#bfa33f'],
		['musky', '#d8d1c2'],
		['lavender', '#b1a6d9'],
	]
	const normalizedChunk = normalizeForSearch(chunk)

	return vocabulary
		.map(([label, color]) => ({
			label,
			color,
			index: normalizedChunk.indexOf(normalizeForSearch(label)),
			score: 0,
		}))
		.filter(item => item.index >= 0)
		.sort((a, b) => a.index - b.index)
		.filter((item, index, list) => {
			const itemKey = normalizeForSearch(item.label)
			return !list.slice(0, index).some(other => {
				const otherKey = normalizeForSearch(other.label)
				return item.index === other.index && (otherKey.includes(itemKey) || itemKey.includes(otherKey))
			})
		})
		.map(({ label, color, score }) => ({ label, color, score }))
}

function applyAccordScores(accords: FragranticaAccord[]): FragranticaAccord[] {
	return accords.map((accord, index, list) => ({
		...accord,
		score: accord.score || Math.max(42, 100 - index * Math.ceil(48 / Math.max(1, list.length - 1))),
	}))
}

function extractTextBetween(text: string, startPattern: RegExp, endPatterns: RegExp[]): string {
	const startMatch = text.match(startPattern)
	if (!startMatch) return ''

	const start = (startMatch.index || 0) + startMatch[0].length
	const rest = text.slice(start)
	let end = text.length
	for (const endPattern of endPatterns) {
		const endMatch = rest.match(endPattern)
		if (endMatch && typeof endMatch.index === 'number') {
			end = Math.min(end, start + endMatch.index)
		}
	}

	return cleanText(text.slice(start, end))
}

function collectPyramid(html: string, description: string): FragranticaPyramid {
	const decoded = decodeHtmlEntities(html).replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
	const widget = extractPyramidWidgetRegion(decoded)
	const structural = widget ? collectPyramidGroups(widget) : { top: [], middle: [], base: [] }
	if (structural.top.length || structural.middle.length || structural.base.length) return structural

	return collectPyramidFromText(html, description)
}

/**
 * Fragrantica renders the notes/pyramid widget inside a single `id="pyramid"` container and
 * tags every individual note with a "pyramid-note-label" class. Anchoring extraction to that
 * structure (instead of searching the whole page for heading text) avoids false matches — the
 * descriptive paragraph repeats "Nota de Salida es ..." in prose, and a text-only search can
 * wander past it into unrelated links (share buttons, language switcher, etc.) before it ever
 * reaches the real note pills.
 */
function extractPyramidWidgetRegion(html: string): string {
	const startMatch = html.match(/id="pyramid"/i)
	if (!startMatch || typeof startMatch.index !== 'number') return ''

	const rest = html.slice(startMatch.index)
	const endMatch = rest.match(/Votar por ingredientes|Vote for ingredients/i)
	return endMatch && typeof endMatch.index === 'number' ? rest.slice(0, endMatch.index) : rest.slice(0, 20000)
}

type PyramidLevel = 'top' | 'middle' | 'base'

function collectPyramidGroups(widgetHtml: string): FragranticaPyramid {
	const candidates: Array<{ key: PyramidLevel; index: number }> = [
		{ key: 'top', index: findPatternIndex(widgetHtml, />\s*Notas? de Salida\s*<\/span>/i, />\s*Top Notes?\s*<\/span>/i) },
		{
			key: 'middle',
			index: findPatternIndex(
				widgetHtml,
				/>\s*Notas? de Coraz(?:o|ó)n\s*<\/span>/i,
				/>\s*Coraz(?:o|ó)n\s*<\/span>/i,
				/>\s*Middle Notes?\s*<\/span>/i,
				/>\s*Heart Notes?\s*<\/span>/i
			),
		},
		{ key: 'base', index: findPatternIndex(widgetHtml, />\s*Notas? de Fondo\s*<\/span>/i, />\s*Base\s*<\/span>/i, />\s*Base Notes?\s*<\/span>/i) },
	]
	const boundaries = candidates.filter(candidate => candidate.index >= 0).sort((a, b) => a.index - b.index)

	const result: FragranticaPyramid = { top: [], middle: [], base: [] }
	boundaries.forEach((boundary, index) => {
		const end = index + 1 < boundaries.length ? boundaries[index + 1].index : widgetHtml.length
		result[boundary.key] = collectPyramidNoteLabels(widgetHtml.slice(boundary.index, end))
	})
	return result
}

function findPatternIndex(text: string, ...patterns: RegExp[]): number {
	for (const pattern of patterns) {
		const match = text.match(pattern)
		if (match && typeof match.index === 'number') return match.index
	}
	return -1
}

function collectPyramidNoteLabels(html: string): string[] {
	const notes: string[] = []
	const seen = new Set<string>()
	for (const match of html.matchAll(/class="pyramid-note-label[^"]*"[^>]*>\s*([^<]+?)\s*</gi)) {
		const label = cleanText(decodeHtmlEntities(match[1]))
		const key = normalizeForSearch(label)
		if (!isValidNoteLabel(label) || seen.has(key)) continue
		seen.add(key)
		notes.push(label)
	}
	return notes.slice(0, 24)
}

/** Fallback for pages where the pyramid widget markup isn't present (e.g. very old cached HTML). */
function collectPyramidFromText(html: string, description: string): FragranticaPyramid {
	const sentenceText = cleanText([description, textFromHtml(html)].filter(Boolean).join(' '))
	const top = extractNoteGroupBetween(sentenceText, [/Notas? de Salida\b/i, /Top Notes?\b/i], [
		/Notas? de Coraz\S*\b/i,
		/Middle Notes?\b/i,
		/Heart Notes?\b/i,
		/Notas? de Fondo\b/i,
		/Base Notes?\b/i,
	])
	const middle = extractNoteGroupBetween(sentenceText, [/Notas? de Coraz\S*\b/i, /Middle Notes?\b/i, /Heart Notes?\b/i], [
		/Notas? de Fondo\b/i,
		/Base Notes?\b/i,
	])
	const base = extractNoteGroupBetween(sentenceText, [/Notas? de Fondo\b/i, /Base Notes?\b/i], [])

	return {
		top: top.length ? top : extractNoteGroup(sentenceText, [/Notas? de Salida (?:son|es) (.*?);/i, /Top Notes? (?:are|is) (.*?);/i]),
		middle: middle.length
			? middle
			: extractNoteGroup(sentenceText, [/Notas? de Coraz(?:o|ó)n (?:son|es) (.*?);/i, /Middle Notes? (?:are|is) (.*?);/i]),
		base: base.length
			? base
			: extractNoteGroup(sentenceText, [/Notas? de Fondo (?:son|es) (.*?)(?:\.|;|$)/i, /Base Notes? (?:are|is) (.*?)(?:\.|;|$)/i]),
	}
}

function collectNoteLinks(html: string): string[] {
	const notes: string[] = []
	const seen = new Set<string>()
	for (const match of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
		const label = textFromHtml(match[1])
		const key = normalizeForSearch(label)
		if (!isValidNoteLabel(label) || seen.has(key)) continue
		seen.add(key)
		notes.push(label)
	}
	return notes.slice(0, 12)
}

function extractNoteGroup(text: string, patterns: RegExp[]): string[] {
	for (const pattern of patterns) {
		const match = text.match(pattern)
		if (match) return splitNoteList(match[1]).filter(isValidNoteLabel)
	}
	return []
}

function extractNoteGroupBetween(text: string, startPatterns: RegExp[], endPatterns: RegExp[]): string[] {
	let startIndex = -1
	let startLength = 0
	for (const pattern of startPatterns) {
		const match = text.match(pattern)
		if (match && typeof match.index === 'number' && (startIndex < 0 || match.index < startIndex)) {
			startIndex = match.index
			startLength = match[0].length
		}
	}
	if (startIndex < 0) return []

	const afterStart = text.slice(startIndex + startLength)
	const connectorMatch = afterStart.match(/^\s+(?:son|es|are|is)\s+/i)
	const contentStart = startIndex + startLength + (connectorMatch ? connectorMatch[0].length : 0)
	const rest = text.slice(contentStart)
	let endIndex = text.length

	for (const pattern of endPatterns) {
		const match = rest.match(pattern)
		if (match && typeof match.index === 'number' && match.index > 0) {
			endIndex = Math.min(endIndex, contentStart + match.index)
		}
	}

	const punctuationMatch = rest.match(/[.;]/)
	if (punctuationMatch && typeof punctuationMatch.index === 'number' && punctuationMatch.index > 0) {
		endIndex = Math.min(endIndex, contentStart + punctuationMatch.index)
	}

	return splitNoteList(text.slice(contentStart, endIndex)).filter(isValidNoteLabel)
}

function splitNoteList(value: string): string[] {
	return cleanText(value)
		.replace(/\s+(?:y|e|and)\s+/gi, ', ')
		.replace(/\s*&\s*/g, ', ')
		.split(',')
		.map(cleanText)
		.filter(Boolean)
		.slice(0, 12)
}

function collectWear(html: string, profile: { accords: FragranticaAccord[]; pyramid: FragranticaPyramid; description: string }): FragranticaWear[] {
	const voted = collectWearFromText(textFromHtml(html))
	if (voted.length >= 3) return voted
	return inferWearFromProfile(profile)
}

function collectWearFromText(text: string): FragranticaWear[] {
	const wear: FragranticaWear[] = []
	for (const item of wearDefinitions()) {
		const index = text.search(item.pattern)
		if (index < 0) continue
		const score = Number.parseInt(text.slice(index, index + 220).match(/(\d{1,3})\s*%/)?.[1] || '0', 10)
		if (score > 0) wear.push({ label: item.label, key: item.key, score: Math.min(100, score), source: 'votes' })
	}
	const order = wearDefinitions().map(item => item.key)
	return wear.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
}

function inferWearFromProfile(profile: { accords: FragranticaAccord[]; pyramid: FragranticaPyramid; description: string }): FragranticaWear[] {
	const text = normalizeForSearch([
		...profile.accords.map(accord => accord.label),
		...profile.pyramid.top,
		...profile.pyramid.middle,
		...profile.pyramid.base,
		profile.description,
	].join(' '))
	const scores: Record<string, number> = { winter: 42, spring: 42, summer: 42, autumn: 42, day: 48, night: 48 }

	addWearScore(scores, text, ['calido', 'ambar', 'amaderado', 'canela', 'tabaco', 'cuero', 'oud', 'balsamico'], { winter: 30, autumn: 26, night: 20 })
	addWearScore(scores, text, ['fresco', 'citrico', 'bergamota', 'acuatico', 'marino', 'verde'], { summer: 24, spring: 18, day: 18 })
	addWearScore(scores, text, ['floral', 'rosas', 'iris', 'lavanda', 'herbal', 'aromatico'], { spring: 22, day: 14, autumn: 8 })
	addWearScore(scores, text, ['dulce', 'avainillado', 'vainilla', 'almizclado'], { night: 16, autumn: 14, winter: 10 })

	return wearDefinitions().map(item => ({
		key: item.key,
		label: item.label,
		score: Math.max(12, Math.min(100, Math.round(scores[item.key]))),
		source: 'profile',
	}))
}

function addWearScore(scores: Record<string, number>, text: string, tokens: string[], weights: Record<string, number>): void {
	if (!tokens.some(token => text.includes(normalizeForSearch(token)))) return
	for (const [key, value] of Object.entries(weights)) scores[key] += value
}

function wearDefinitions(): Array<{ key: string; label: string; pattern: RegExp }> {
	return [
		{ key: 'winter', label: 'Invierno', pattern: /\b(?:invierno|winter)\b/i },
		{ key: 'spring', label: 'Primavera', pattern: /\b(?:primavera|spring)\b/i },
		{ key: 'summer', label: 'Verano', pattern: /\b(?:verano|summer)\b/i },
		{ key: 'autumn', label: 'Otoño', pattern: /\b(?:oto(?:n|ñ)o|fall|autumn)\b/i },
		{ key: 'day', label: 'Día', pattern: /\b(?:d(?:i|í)a|day)\b/i },
		{ key: 'night', label: 'Noche', pattern: /\b(?:noche|night)\b/i },
	]
}

function normalizeRating(ratingSource: unknown): FragranticaRating | null {
	if (!isRecord(ratingSource)) return null
	const value = Number.parseFloat(String(ratingSource.ratingValue || ratingSource.value || ''))
	const count = parseVoteCount(String(ratingSource.ratingCount || ratingSource.reviewCount || ratingSource.count || ''))
	return Number.isFinite(value) ? { value: Math.round(value * 100) / 100, count } : null
}

function isValidNoteLabel(label: string): boolean {
	const normalized = normalizeForSearch(label)
	const blockedLabels = new Set([
		'deutsch',
		'english',
		'cestina',
		'čeština',
		'francais',
		'italiano',
		'magyar',
		'monгол',
		'монгол',
		'russkii',
		'русский',
		'ukrainska',
		'українська',
		'nederlands',
		'polski',
		'portugues',
		'romana',
		'srpski',
		'svenska',
		'turkce',
		'ελληνικα',
		'ελληνικά',
		'עברית',
		'العربية',
		'日本語',
		'汉语',
		'漢語',
		'한국어',
		'claire liegent',
		'dominique ropion',
		'noticias',
		'disenadores',
		'paises',
		'empresas matriz',
		'industrias',
		'buscar por notas',
		'buscador de perfumes',
		'mostrar votos',
		'ocultar votos',
		'mostrar etiquetas',
		'ocultar etiquetas',
		'votar por ingredientes',
		'show votes',
		'hide labels',
		'vote for ingredients',
	])

	return Boolean(
		label &&
			label.length <= 44 &&
			!blockedLabels.has(normalized) &&
			!/\bfragrantica\.(?:com|es|ru|fr|de|it|pl|nl|br|mx)\b/i.test(label) &&
			!/[\u0370-\u03ff\u0400-\u04ff\u0590-\u05ff\u0600-\u06ff\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(label) &&
			!/^(buscar|notas?|coraz|base|salida|fragancias?|rese|fotos?|image|photo|perfume)$/i.test(label) &&
			!/window\.datalayer|function|var|const|let|script|<|>|=|\{|\}|\[|\]/i.test(label)
	)
}

function normalizeImageUrl(value: unknown, baseUrl: string): string {
	if (typeof value !== 'string' || !value.trim()) return ''
	try {
		return new URL(value, baseUrl).toString()
	} catch {
		return ''
	}
}

function firstValue(value: unknown): unknown {
	return Array.isArray(value) ? value[0] : value
}

function inferBrandFromTitle(title: string): string {
	const byMatch = title.match(/\s+by\s+(.+?)(?:\s+for\s+|$)/i)
	if (byMatch) return byMatch[1]
	const clean = title.replace(/\s+para\s+.*$/i, '').replace(/\s+(?:perfume|cologne|colonia)\b.*$/i, '')
	const parts = clean.split(/\s+/).filter(Boolean)
	return parts.length > 1 ? parts[parts.length - 1] : ''
}

function trimTitle(value: string): string {
	return cleanText(value)
		.replace(/\s+Fragrantica.*$/i, '')
		.replace(/\s+-\s+(?:a fragrance|una fragancia).*$/i, '')
		.replace(/\s+para\s+.*$/i, '')
		.slice(0, 140)
}

function extractAudience(value: string): string {
	return cleanText(value.match(/\bpara\s+([^|,-]+)$/i)?.[1] || value.match(/\bfor\s+([^|,-]+)$/i)?.[1] || '')
}

function parseVoteCount(value: string): number | null {
	const count = Number.parseInt(String(value || '').replace(/[^0-9]/g, ''), 10)
	return Number.isFinite(count) ? count : null
}

function parseLocaleNumber(value: string): number {
	const clean = String(value || '').trim()
	if (clean.includes(',') && clean.includes('.')) return Number.parseFloat(clean.replace(/,/g, ''))
	return Number.parseFloat(clean.replace(/,/g, '.'))
}

function cleanText(value: unknown): string {
	return String(value || '').replace(/\s+/g, ' ').trim()
}

function normalizeForSearch(value: string): string {
	return cleanText(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function extractCssColor(style: string): string {
	return style.match(/(?:background|background-color)\s*:\s*([^;]+)/i)?.[1]?.trim() || ''
}

function extractWidthPercent(style: string): number {
	const value = Number.parseFloat(style.match(/(?:width|min-width|max-width)\s*:\s*(\d{1,3}(?:\.\d+)?)%/i)?.[1] || '0')
	return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
}

function getAttribute(tag: string, name: string): string {
	return decodeHtmlEntities(tag.match(new RegExp(`${escapeRegExp(name)}\\s*=\\s*(["'])(.*?)\\1`, 'i'))?.[2] || '')
}

function textFromHtml(html: string): string {
	return cleanText(decodeHtmlEntities(stripTags(html)))
}

function stripTags(html: string): string {
	return String(html || '')
		.replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
		.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
		.replace(/<[^>]*>/g, ' ')
}

function decodeHtmlEntities(value: string): string {
	const named: Record<string, string> = {
		amp: '&',
		apos: "'",
		gt: '>',
		hellip: '...',
		laquo: '<<',
		ldquo: '"',
		lsquo: "'",
		lt: '<',
		nbsp: ' ',
		ndash: '-',
		quot: '"',
		raquo: '>>',
		rdquo: '"',
		rsquo: "'",
	}
	return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_entity, body: string) => {
		const lower = body.toLowerCase()
		if (lower[0] === '#') {
			const radix = lower[1] === 'x' ? 16 : 10
			const codePoint = Number.parseInt(lower.slice(radix === 16 ? 2 : 1), radix)
			return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : ''
		}
		return named[lower] || `&${body};`
	})
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
