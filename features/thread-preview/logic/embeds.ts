import { MV_BASE_URL } from '@/constants'
import { reinitializeEmbeds } from '@/lib/content-modules/utils/reinitialize-embeds'
import { useSettingsStore } from '@/store/settings-store'
import {
	REINITIALIZABLE_EMBED_SELECTOR,
	STREAMABLE_CONTAINER_SELECTOR,
	STREAMABLE_PREVIEW_HEIGHT,
	TWITTER_PREVIEW_PROVISIONAL_HEIGHT,
	YOUTUBE_WIRED_ATTR,
} from './constants'

const YOUTUBE_EMBED_SELECTOR = '.youtube_lite, .embed.yt, [data-s9e-mediaembed="youtube"]'

export function preparePreviewTwitterEmbeds(body: HTMLElement): void {
	body.querySelectorAll<HTMLIFrameElement>('[data-s9e-mediaembed="twitter"] iframe').forEach(iframe => {
		const currentHeight = Number.parseInt(iframe.style.height || iframe.getAttribute('height') || '0', 10)
		if (!Number.isNaN(currentHeight) && currentHeight >= 360) return

		iframe.style.height = `${TWITTER_PREVIEW_PROVISIONAL_HEIGHT}px`
		iframe.setAttribute('scrolling', 'no')
		iframe.style.overflow = 'hidden'
	})
}

export function preparePreviewStreamableEmbeds(body: HTMLElement): void {
	body.querySelectorAll<HTMLElement>(STREAMABLE_CONTAINER_SELECTOR).forEach(container => {
		const embedUrl = getStreamableEmbedUrlFromContainer(container)
		const iframe = container.querySelector<HTMLIFrameElement>('iframe')
		if (iframe) {
			normalizeStreamableIframe(iframe, embedUrl)
			return
		}

		if (!embedUrl) return

		const replacement = document.createElement('iframe')
		replacement.src = embedUrl
		normalizeStreamableIframe(replacement, embedUrl)
		container.textContent = ''
		container.appendChild(replacement)
	})

	body
		.querySelectorAll<HTMLIFrameElement>('iframe[src*="streamable.com"], iframe[data-src*="streamable.com"]')
		.forEach(iframe => normalizeStreamableIframe(iframe))

	body.querySelectorAll<HTMLAnchorElement>('a[href*="streamable.com"]').forEach(anchor => {
		if (anchor.closest(STREAMABLE_CONTAINER_SELECTOR)) return

		const embedUrl = getStreamableEmbedUrl(anchor.href)
		if (!embedUrl) return

		const wrapper = document.createElement('div')
		wrapper.className = 'embed streamable'
		wrapper.setAttribute('data-s9e-mediaembed', 'streamable')

		const iframe = document.createElement('iframe')
		iframe.src = embedUrl
		normalizeStreamableIframe(iframe, embedUrl)
		wrapper.appendChild(iframe)
		anchor.replaceWith(wrapper)
	})
}

export function wirePreviewYoutubeEmbeds(body: HTMLElement, onActivate?: () => void): () => void {
	const controller = new AbortController()

	body.querySelectorAll<HTMLElement>(YOUTUBE_EMBED_SELECTOR).forEach(embed => {
		if (embed.hasAttribute(YOUTUBE_WIRED_ATTR)) return
		embed.setAttribute(YOUTUBE_WIRED_ATTR, 'true')

		embed.addEventListener(
			'click',
			event => {
				if (embed.querySelector('iframe')) return

				const videoId = extractYouTubeVideoId(embed)
				if (!videoId) return

				event.preventDefault()
				event.stopPropagation()

				const iframe = buildYouTubeIframe(videoId, embed)
				embed.textContent = ''
				embed.appendChild(iframe)
				onActivate?.()
			},
			{ capture: true, signal: controller.signal }
		)
	})

	return () => controller.abort()
}

function extractYouTubeVideoId(embed: HTMLElement): string | null {
	const direct = embed.getAttribute('data-youtube')?.trim()
	if (isValidYouTubeVideoId(direct)) return direct

	const anchorWithData = embed.querySelector<HTMLAnchorElement>('a[data-youtube]')
	const fromDataAnchor = anchorWithData?.getAttribute('data-youtube')?.trim()
	if (isValidYouTubeVideoId(fromDataAnchor)) return fromDataAnchor

	const href =
		anchorWithData?.getAttribute('href') ||
		embed.querySelector<HTMLAnchorElement>('a[href*="youtube.com"], a[href*="youtu.be"]')?.getAttribute('href') ||
		''
	if (!href) return null

	const watchMatch = href.match(/[?&]v=([\w-]{6,})/i)
	if (isValidYouTubeVideoId(watchMatch?.[1])) return watchMatch[1]

	const shortMatch = href.match(/youtu\.be\/([\w-]{6,})/i)
	if (isValidYouTubeVideoId(shortMatch?.[1])) return shortMatch[1]

	const embedMatch = href.match(/\/embed\/([\w-]{6,})/i)
	if (isValidYouTubeVideoId(embedMatch?.[1])) return embedMatch[1]

	return null
}

function isValidYouTubeVideoId(value?: string | null): value is string {
	return !!value && /^[\w-]{6,}$/.test(value)
}

function buildYouTubeIframe(videoId: string, source: HTMLElement): HTMLIFrameElement {
	const iframe = document.createElement('iframe')
	iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}${getYouTubeIframeParams(source)}`
	iframe.setAttribute('title', 'YouTube video player')
	iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share')
	iframe.setAttribute('allowfullscreen', '')
	iframe.setAttribute('frameborder', '0')
	iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
	iframe.style.width = '100%'
	iframe.style.height = '100%'
	iframe.style.display = 'block'
	return iframe
}

function getYouTubeIframeParams(source: HTMLElement): string {
	const params = new URLSearchParams({ autoplay: '1', rel: '0', origin: getYouTubeEmbedOrigin() })
	const dataParams = source.querySelector<HTMLElement>('[data-params]')?.getAttribute('data-params')?.trim()
	if (dataParams) {
		new URLSearchParams(dataParams.startsWith('?') ? dataParams.slice(1) : dataParams).forEach((value, key) => {
			if (key) params.set(key, value)
		})
	}

	const href = source.querySelector<HTMLAnchorElement>('a[href]')?.getAttribute('href')
	const start = getYouTubeStartParam(href || '')
	if (start !== null) params.set('start', String(start))

	return `?${params.toString()}`
}

function getYouTubeEmbedOrigin(): string {
	const pageOrigin = window.location.origin
	if (/^https?:\/\/(?:www\.)?mediavida\.com$/i.test(pageOrigin)) return pageOrigin
	return new URL(MV_BASE_URL).origin
}

function getYouTubeStartParam(href: string): number | null {
	if (!href) return null

	try {
		const url = new URL(href, MV_BASE_URL)
		const start = parseYouTubeTime(url.searchParams.get('start')) ?? parseYouTubeTime(url.searchParams.get('t'))
		return start && start > 0 ? start : null
	} catch {
		return null
	}
}

function parseYouTubeTime(value: string | null): number | null {
	if (!value) return null
	if (/^\d+$/.test(value)) return Number.parseInt(value, 10)

	const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i)
	if (!match) return null

	const hours = Number.parseInt(match[1] || '0', 10)
	const minutes = Number.parseInt(match[2] || '0', 10)
	const seconds = Number.parseInt(match[3] || '0', 10)
	const total = hours * 3600 + minutes * 60 + seconds
	return total > 0 ? total : null
}

function getStreamableEmbedUrlFromContainer(container: HTMLElement): string | null {
	const linkUrl = container.querySelector<HTMLAnchorElement>('a[href*="streamable.com"]')?.href
	const iframeUrl = getStreamableCandidateFromIframe(container.querySelector<HTMLIFrameElement>('iframe'))
	const attrUrl = getStreamableCandidateFromAttributes(container)
	return getStreamableEmbedUrl(linkUrl || iframeUrl || attrUrl || '')
}

function getStreamableCandidateFromIframe(iframe: HTMLIFrameElement | null): string | null {
	if (!iframe) return null

	return (
		extractStreamableUrlFromValue(iframe.getAttribute('src') || '') ||
		extractStreamableUrlFromValue(iframe.getAttribute('data-src') || '') ||
		null
	)
}

function getStreamableCandidateFromAttributes(element: HTMLElement): string | null {
	for (const attr of Array.from(element.attributes)) {
		const value = attr.value.trim()
		if (!value) continue
		const streamableUrl = extractStreamableUrlFromValue(value)
		if (streamableUrl) return streamableUrl
		if (/^(data-id|data-video-id|data-code)$/i.test(attr.name) && /^[a-z0-9]+$/i.test(value)) {
			return `https://streamable.com/${value}`
		}
	}

	return null
}

function normalizeStreamableIframe(iframe: HTMLIFrameElement, fallbackEmbedUrl?: string | null): void {
	const dataSrc = iframe.getAttribute('data-src')
	const src = iframe.getAttribute('src')
	const srcCandidate = src && !isPlaceholderIframeSrc(src) ? src : null
	const dataSrcCandidate = dataSrc && !isPlaceholderIframeSrc(dataSrc) ? dataSrc : null
	const embedUrl =
		getStreamableEmbedUrl(srcCandidate || dataSrcCandidate || iframe.src || '') || fallbackEmbedUrl || null
	if (embedUrl) iframe.src = embedUrl

	iframe.style.display = 'block'
	iframe.style.width = '100%'
	iframe.style.height = `${STREAMABLE_PREVIEW_HEIGHT}px`
	iframe.style.border = '0'
	iframe.setAttribute('allowfullscreen', 'true')
	iframe.setAttribute('scrolling', 'no')
	iframe.setAttribute('allow', 'fullscreen; autoplay; encrypted-media; picture-in-picture')
}

export function isPlaceholderIframeSrc(src: string): boolean {
	return src === 'about:blank' || src.includes('/style/img/pix.gif')
}

function getStreamableEmbedUrl(rawUrl: string): string | null {
	const streamableUrl = extractStreamableUrlFromValue(rawUrl)
	if (!streamableUrl) return null

	try {
		const url = new URL(streamableUrl, MV_BASE_URL)
		const hostname = url.hostname.toLowerCase()
		if (hostname !== 'streamable.com' && hostname !== 'www.streamable.com') return null

		const parts = url.pathname.split('/').filter(Boolean)
		const id = ['e', 'o', 's'].includes(parts[0] || '') ? parts[1] : parts[0]
		if (!id || !/^[a-z0-9]+$/i.test(id)) return null

		return `https://streamable.com/e/${id}`
	} catch {
		return null
	}
}

function extractStreamableUrlFromValue(value: string): string | null {
	const trimmed = value.trim()
	if (!trimmed) return null
	if (/^https?:\/\/(?:www\.)?streamable\.com\//i.test(trimmed)) return trimmed
	if (/^\/\/(?:www\.)?streamable\.com\//i.test(trimmed)) return `https:${trimmed}`

	const encodedMatch = trimmed.match(/https?%3A%2F%2F(?:www%2E)?streamable%2Ecom%2F[^'"%)\s]+/i)
	if (encodedMatch) return decodeURIComponent(encodedMatch[0])

	const plainMatch = trimmed.match(/https?:\/\/(?:www\.)?streamable\.com\/[^'"%)\s]+/i)
	if (plainMatch) return plainMatch[0]

	return null
}

export function collapseEmptyPreviewEmbeds(body: HTMLElement): void {
	body.querySelectorAll<HTMLElement>('.embed, [data-s9e-mediaembed]').forEach(embed => {
		if (embed.matches(STREAMABLE_CONTAINER_SELECTOR)) return

		const hasVisibleMedia = !!embed.querySelector(
			'img, video, object, embed, .deal-wrap, .minideal-row, .deal-row, .youtube_lite, [data-youtube]'
		)
		const iframe = embed.querySelector<HTMLIFrameElement>('iframe')
		const iframeSrc = iframe?.getAttribute('src') || iframe?.getAttribute('data-src') || ''
		const hasWorkingIframe = !!iframe && !!iframeSrc && !isPlaceholderIframeSrc(iframeSrc)
		if (hasVisibleMedia || hasWorkingIframe || embed.textContent.trim()) return

		embed.classList.add('mvp-thread-preview-empty-embed')
	})
}

export function reinitializePreviewEmbeds(body: HTMLElement): void {
	const mutedEmbeds: Array<[HTMLElement, string]> = []
	body.querySelectorAll<HTMLElement>('[data-s9e-mediaembed]').forEach(embed => {
		if (embed.matches(REINITIALIZABLE_EMBED_SELECTOR)) return

		const value = embed.getAttribute('data-s9e-mediaembed')
		if (!value) return
		embed.removeAttribute('data-s9e-mediaembed')
		mutedEmbeds.push([embed, value])
	})

	try {
		reinitializeEmbeds(body, {
			forceReloadTwitter: true,
			twitterLiteMode: useSettingsStore.getState().twitterLiteEmbedsEnabled === true,
		})
	} finally {
		mutedEmbeds.forEach(([embed, value]) => {
			embed.setAttribute('data-s9e-mediaembed', value)
		})
	}
}
