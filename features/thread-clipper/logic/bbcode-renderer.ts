import type { ClippedThreadPrefill } from './thread-prefill'
import type { ThreadClipperBasketItem, ThreadClipperTemplate, ThreadClipperTextFormat } from './types'
import { VALID_SUBFORUM_SLUGS } from '@/lib/subforums'

const MAX_TITLE_LENGTH = 72
const MAX_SELECTION_LENGTH = 12000
export const THREAD_CLIPPER_LIMITS = {
	maxTextItems: 8,
	maxMediaItems: 12,
	maxBodyLength: 60000,
	maxSelectionLength: MAX_SELECTION_LENGTH,
} as const

export function normalizeWhitespace(value: string): string {
	return value.replace(/\s+/g, ' ').trim()
}

export function sanitizeBbcodeText(value: string): string {
	return normalizeWhitespace(value).replace(/\[/g, '(').replace(/\]/g, ')')
}

export function sanitizeBbcodeMultilineText(value: string): string {
	return value
		.replace(/\r\n?/g, '\n')
		.split('\n')
		.map(line => line.replace(/[ \t\f\v]+/g, ' ').trim())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim()
		.replace(/\[/g, '(')
		.replace(/\]/g, ')')
}

export function normalizeClipSourceUrl(url: string): string | null {
	try {
		const parsed = new URL(url)
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
		return parsed.href.replace(/\[/g, '%5B').replace(/\]/g, '%5D')
	} catch {
		return null
	}
}

export function trimThreadTitle(value: string): string {
	const normalized = sanitizeBbcodeText(value)
	if (normalized.length <= MAX_TITLE_LENGTH) return normalized
	return normalized.slice(0, MAX_TITLE_LENGTH).trimEnd()
}

export function getHostname(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '')
	} catch {
		return 'enlace'
	}
}

export function cleanArticleTitle(title: string, sourceUrl: string): string {
	const host = getHostname(sourceUrl)
	const hostParts = host
		.split('.')
		.filter(part => part.length > 2)
		.map(part => part.replace(/[-_]/g, ' '))
	const suffixes = [host, ...hostParts, 'X', 'Twitter']
	let cleaned = normalizeWhitespace(title)
	for (const suffix of suffixes) {
		const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		cleaned = cleaned.replace(new RegExp(`\\s+[-|–—:]\\s+${escaped}\\s*$`, 'i'), '')
	}
	return normalizeWhitespace(cleaned)
}

export function buildThreadTitle(tabTitle: string, selectionText: string | undefined, sourceUrl: string): string {
	const selection = normalizeWhitespace(selectionText || '')
	if (selection.length >= 12 && selection.length <= MAX_TITLE_LENGTH) {
		return trimThreadTitle(selection)
	}

	const title = cleanArticleTitle(tabTitle, sourceUrl)
	if (title) return trimThreadTitle(title)

	return trimThreadTitle(`Noticia de ${getHostname(sourceUrl)}`)
}

export function buildSourceLinkTitle(tabTitle: string, sourceUrl: string): string {
	return sanitizeBbcodeText(cleanArticleTitle(tabTitle, sourceUrl)) || `Noticia de ${getHostname(sourceUrl)}`
}

export function normalizeClipMediaUrl(url: string): string | null {
	const normalizedUrl = normalizeClipSourceUrl(url)
	if (!normalizedUrl) return null
	try {
		const parsed = new URL(normalizedUrl)
		const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
		const isYoutube =
			host === 'youtu.be' ||
			host === 'youtube.com' ||
			host.endsWith('.youtube.com') ||
			host === 'ytimg.com' ||
			host.endsWith('.ytimg.com') ||
			host === 'youtube-nocookie.com' ||
			host.endsWith('.youtube-nocookie.com')
		const isTwitter = host === 'twitter.com' || host === 'x.com' || host.endsWith('.twitter.com') || host.endsWith('.x.com')
		const isInstagram = host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am'
		if (!isYoutube && !isTwitter && !isInstagram) return null
		if (isYoutube) {
			const videoId =
				host === 'youtu.be'
					? parsed.pathname.split('/').filter(Boolean)[0]
					: parsed.searchParams.get('v') ||
						parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] ||
						parsed.pathname.match(/^\/(?:vi|vi_webp)\/([^/?#]+)/)?.[1] ||
						null
			if (videoId) return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
		}
		if (isTwitter) {
			const statusMatch = parsed.pathname.match(/^\/([A-Za-z0-9_]+)\/status(?:es)?\/(\d+)\/?$/i)
			const embedStatusId = parsed.pathname.match(/^\/i\/status\/(\d+)\/?$/i)?.[1]
			if (!statusMatch && !embedStatusId) return null
			if (statusMatch) return `https://twitter.com/${statusMatch[1]}/status/${statusMatch[2]}`
			if (embedStatusId) return `https://twitter.com/i/status/${embedStatusId}`
			return null
		}
		if (isInstagram) {
			const postMatch = parsed.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)\/?$/i)
			if (!postMatch) return null
			return `https://www.instagram.com/${postMatch[1]}/${postMatch[2]}/`
		}
		return null
	} catch {
		return null
	}
}

export function normalizeClipMediaUrls(mediaUrls: readonly string[] = []): string[] {
	const normalized: string[] = []
	for (const url of mediaUrls) {
		const normalizedUrl = normalizeClipMediaUrl(url)
		if (!normalizedUrl || normalized.includes(normalizedUrl)) continue
		normalized.push(normalizedUrl)
	}
	return normalized
}

export function getMediaLabel(url: string): string {
	try {
		const parsed = new URL(url)
		const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
		if (host.includes('youtu')) return 'YouTube'
		if (host.includes('twitter') || host === 'x.com') return 'X/Twitter'
		if (host.includes('instagram') || host === 'instagr.am') return 'Instagram'
		return host
	} catch {
		return 'Media'
	}
}

function buildQuoteBbcode(text: string): string {
	return `[quote]\n${text}\n[/quote]`
}

function buildSourceBbcode(sourceUrl: string): string {
	return `[b][url=${sourceUrl}]Fuente[/url][/b]`
}

export function buildThreadBody(input: {
	sourceUrl: string
	sourceTitle: string
	selectionText?: string
	items?: readonly ThreadClipperBasketItem[]
	textFormat?: ThreadClipperTextFormat
	template?: ThreadClipperTemplate
	description?: string
	publishedAt?: string
	contentMode?: 'article' | 'media-only'
}): string {
	const textFormat = input.textFormat ?? 'quote'
	const includeArticleContext = input.contentMode !== 'media-only'
	const blocks: string[] = []
	const sourceBlock = buildSourceBbcode(input.sourceUrl)

	if (includeArticleContext && input.description && !input.items?.some(item => item.type === 'text')) {
		const description = sanitizeBbcodeMultilineText(input.description).slice(0, 500)
		if (description) blocks.push(textFormat === 'quote' ? buildQuoteBbcode(description) : description)
	}

	if (input.items?.length) {
		let textCount = 0
		let mediaCount = 0
		for (const item of input.items) {
			if (item.type === 'media') {
				if (mediaCount >= THREAD_CLIPPER_LIMITS.maxMediaItems) continue
				const [mediaUrl] = normalizeClipMediaUrls([item.value])
				if (mediaUrl) {
					blocks.push(`[media]${mediaUrl}[/media]`)
					mediaCount += 1
				}
				continue
			}
			if (item.type === 'link') {
				const linkUrl = normalizeClipSourceUrl(item.value)
				if (linkUrl) blocks.push(`[url=${linkUrl}]${sanitizeBbcodeText(item.label)}[/url]`)
				continue
			}
			if (textCount >= THREAD_CLIPPER_LIMITS.maxTextItems) continue
			const text = sanitizeBbcodeMultilineText(item.value).slice(0, MAX_SELECTION_LENGTH).trim()
			const format = item.format ?? textFormat
			if (text) {
				blocks.push(format === 'quote' ? buildQuoteBbcode(text) : text)
				textCount += 1
			}
		}
	} else {
		const selection = sanitizeBbcodeMultilineText(input.selectionText || '').slice(0, MAX_SELECTION_LENGTH).trim()
		if (selection) blocks.push(textFormat === 'quote' ? buildQuoteBbcode(selection) : selection)
	}

	const contentBody = blocks.join('\n\n')
	const reservedSourceLength = sourceBlock.length + (contentBody ? 2 : 0)
	const maxContentLength = Math.max(0, THREAD_CLIPPER_LIMITS.maxBodyLength - reservedSourceLength)
	const limitedContent =
		contentBody.length > maxContentLength ? contentBody.slice(0, maxContentLength).trimEnd() : contentBody

	return limitedContent ? `${limitedContent}\n\n${sourceBlock}` : sourceBlock
}

export function buildClippedThreadPrefill(input: {
	subforum: string
	sourceUrl: string
	tabTitle: string
	selectionText?: string
	items?: ThreadClipperBasketItem[]
	textFormat?: ThreadClipperTextFormat
	template?: ThreadClipperTemplate
	titleOverride?: string
	description?: string
	publishedAt?: string
	contentMode?: 'article' | 'media-only'
}): Omit<ClippedThreadPrefill, 'createdAt'> | null {
	if (!VALID_SUBFORUM_SLUGS.has(input.subforum)) return null
	const sourceUrl = normalizeClipSourceUrl(input.sourceUrl)
	if (!sourceUrl) return null

	const titleSource =
		input.titleOverride !== undefined ? input.titleOverride : buildThreadTitle(input.tabTitle, input.selectionText, sourceUrl)
	const title = trimThreadTitle(titleSource)
	const sourceTitle = buildSourceLinkTitle(input.tabTitle, sourceUrl)
	return {
		subforum: input.subforum,
		title,
		body: buildThreadBody({
			sourceUrl,
			sourceTitle,
			selectionText: input.selectionText,
			items: input.items,
			textFormat: input.textFormat,
			template: input.template,
			description: input.description,
			publishedAt: input.publishedAt,
			contentMode: input.contentMode,
		}),
		sourceUrl,
	}
}
