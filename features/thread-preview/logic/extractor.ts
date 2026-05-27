import { MV_SELECTORS } from '@/constants'
import { LIKE_SUMMARY_CLASS } from './constants'
import { isPlaceholderIframeSrc } from './embeds'
import type { ThreadPreviewData } from './types'
import { absolutizeUrl } from './url'

export function extractFirstPostPreview(doc: Document, url: string): ThreadPreviewData | null {
	const post = getFirstPostElement(doc)
	if (!post) return null

	const cleanClone = preparePostClone(post)
	const postHtml = cleanClone.outerHTML
	if (!postHtml.trim()) return null

	return {
		postHtml,
		url,
	}
}

function preparePostClone(post: HTMLElement): HTMLElement {
	const clone = post.cloneNode(true) as HTMLElement
	const likeSummary = createStaticLikeSummary(clone)

	clone.querySelectorAll('script, style').forEach(el => {
		el.remove()
	})
	clone.querySelectorAll('.post-actions, .post-controls, .post-btn, .quote-button').forEach(el => {
		el.remove()
	})

	clone.querySelectorAll<HTMLElement>('*').forEach(element => {
		for (const attr of Array.from(element.attributes)) {
			if (attr.name.toLowerCase().startsWith('on')) {
				element.removeAttribute(attr.name)
			}
		}
	})

	clone.querySelectorAll<HTMLImageElement>('img').forEach(img => {
		const dataSrc = img.getAttribute('data-src')
		const src = img.getAttribute('src')
		if ((!src || src.includes('/style/img/pix.gif')) && dataSrc) {
			img.setAttribute('src', absolutizeUrl(dataSrc) || dataSrc)
		} else if (src) {
			img.setAttribute('src', absolutizeUrl(src) || src)
		}
		img.setAttribute('loading', 'lazy')
	})

	clone.querySelectorAll<HTMLIFrameElement>('iframe').forEach(iframe => {
		const dataSrc = iframe.getAttribute('data-src')
		const src = iframe.getAttribute('src')
		if ((!src || isPlaceholderIframeSrc(src)) && dataSrc) {
			iframe.setAttribute('src', absolutizeUrl(dataSrc) || dataSrc)
		}
		iframe.setAttribute('loading', 'lazy')
	})

	clone.querySelectorAll<HTMLVideoElement>('video').forEach(video => {
		const dataSrc = video.getAttribute('data-src')
		const src = video.getAttribute('src')
		if (!src && dataSrc) {
			video.setAttribute('src', absolutizeUrl(dataSrc) || dataSrc)
		}
		video.setAttribute('controls', '')
		video.setAttribute('preload', 'metadata')
	})

	clone.querySelectorAll<HTMLSourceElement>('source').forEach(source => {
		const dataSrc = source.getAttribute('data-src')
		const src = source.getAttribute('src')
		if (!src && dataSrc) {
			source.setAttribute('src', absolutizeUrl(dataSrc) || dataSrc)
		}
	})

	clone.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(anchor => {
		const href = anchor.getAttribute('href')
		if (href && !href.startsWith('#')) {
			anchor.href = absolutizeUrl(href) || href
		}
		if (!href || href.startsWith('#')) return
		anchor.target = '_blank'
		anchor.rel = 'noopener noreferrer'
	})

	if (likeSummary) {
		const postBody = clone.querySelector<HTMLElement>('.post-body, .post-header, .cuerpo') ?? clone
		postBody.appendChild(likeSummary)
	}

	return clone
}

function createStaticLikeSummary(post: HTMLElement): HTMLElement | null {
	const source = post.querySelector<HTMLElement>('.post-controls .btnmola, .post-controls .post-n.btnmola, .btnmola')
	if (!source) return null

	const count = getLikeCount(source)
	if (count <= 0) return null

	const doc = post.ownerDocument
	const controls = doc.createElement('div')
	controls.className = 'post-controls mvp-thread-preview-controls'

	const summary = doc.createElement('span')
	summary.className = `post-btn btnmola post-n ${LIKE_SUMMARY_CLASS}`
	summary.title = `${count} me gusta`
	summary.setAttribute('aria-label', `${count} me gusta`)

	const icon = doc.createElement('i')
	icon.className = 'fa fa-thumbs-up'
	const label = doc.createElement('span')
	label.textContent = formatLikeCount(count)
	summary.append(icon, ' ', label)
	controls.appendChild(summary)

	return controls
}

function getLikeCount(source: HTMLElement): number {
	const raw = source.querySelector('span')?.textContent || source.textContent || ''
	const normalized = raw.trim().replace(',', '.').toUpperCase()
	const match = normalized.match(/(\d+(?:\.\d+)?)(K|M)?/)
	if (!match) return 0

	const value = Number.parseFloat(match[1])
	if (Number.isNaN(value)) return 0
	if (match[2] === 'M') return Math.round(value * 1_000_000)
	if (match[2] === 'K') return Math.round(value * 1_000)
	return Math.round(value)
}

function formatLikeCount(count: number): string {
	if (count >= 1_000_000) return `${Number.parseFloat((count / 1_000_000).toFixed(1))}M`
	if (count >= 1_000) return `${Number.parseFloat((count / 1_000).toFixed(1))}K`
	return String(count)
}

function getFirstPostElement(doc: Document): HTMLElement | null {
	const explicitPost = doc.querySelector<HTMLElement>(MV_SELECTORS.THREAD.POST)
	if (explicitPost) return explicitPost

	return (
		Array.from(doc.querySelectorAll<HTMLElement>('div[id^="post-"]')).find(candidate =>
			/^post-\d+$/.test(candidate.id)
		) || null
	)
}
