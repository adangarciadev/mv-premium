import {
	BODY_CLAMPED_CLASS,
	BODY_TRUNCABLE_CLASS,
	MAX_MEDIA_AWARE_PREVIEW_HEIGHT,
	MAX_PREVIEW_HEIGHT,
	MEDIA_CLAMP_PADDING,
	MEDIA_CLAMP_SELECTOR,
	MIN_EXPANDABLE_OVERFLOW,
	TRUNCATION_TOLERANCE,
} from './constants'

export function applyPreviewFogTheme(body: HTMLElement): void {
	const source = body.querySelector<HTMLElement>('.post, [id^="post-"]') ?? body
	const color = findBackgroundColor(source)
	if (!color) return

	body.style.setProperty('--mvp-thread-preview-fog-rgb', `${color.r}, ${color.g}, ${color.b}`)
	body.style.setProperty('--mvp-thread-preview-fog-hi-rgb', formatRgbTriplet(adjustColor(color, 14)))
	body.style.setProperty('--mvp-thread-preview-fog-low-rgb', formatRgbTriplet(adjustColor(color, -10)))
}

type RgbColor = { r: number; g: number; b: number }

function findBackgroundColor(start: HTMLElement): RgbColor | null {
	let element: HTMLElement | null = start
	while (element) {
		const parsed = parseRgbColor(getComputedStyle(element).backgroundColor)
		if (parsed) return parsed
		element = element.parentElement
	}

	return parseRgbColor(getComputedStyle(document.body).backgroundColor)
}

function parseRgbColor(value: string): RgbColor | null {
	if (!value || value === 'transparent') return null

	const match = value.match(/rgba?\(([^)]+)\)/i)
	if (!match) return null

	const parts = match[1]
		.replace(/\s*\/\s*/g, ' ')
		.replace(/,/g, ' ')
		.split(/\s+/)
		.map(part => part.trim())
		.filter(Boolean)
	const [r, g, b, alpha = '1'] = parts
	const parsed = {
		r: Number.parseFloat(r),
		g: Number.parseFloat(g),
		b: Number.parseFloat(b),
	}
	const opacity = Number.parseFloat(alpha)

	if ([parsed.r, parsed.g, parsed.b, opacity].some(Number.isNaN) || opacity <= 0.01) return null
	return parsed
}

function adjustColor(color: RgbColor, amount: number): RgbColor {
	return {
		r: clampColor(color.r + amount),
		g: clampColor(color.g + amount),
		b: clampColor(color.b + amount),
	}
}

function clampColor(value: number): number {
	return Math.max(0, Math.min(255, Math.round(value)))
}

function formatRgbTriplet(color: RgbColor): string {
	return `${color.r}, ${color.g}, ${color.b}`
}

export function observePreviewMediaResizes(body: HTMLElement, onResize: () => void): () => void {
	let disconnect = () => {}
	const cleanupObserver = new MutationObserver(() => {
		if (body.isConnected) return
		cleanupObserver.disconnect()
		disconnect()
	})
	cleanupObserver.observe(document.body, { childList: true, subtree: true })

	if (!('ResizeObserver' in window)) {
		const observer = new MutationObserver(onResize)
		observer.observe(body, {
			attributes: true,
			attributeFilter: ['style', 'height', 'class'],
			childList: true,
			subtree: true,
		})
		disconnect = () => observer.disconnect()
		return () => {
			cleanupObserver.disconnect()
			disconnect()
		}
	}

	const resizeObserver = new ResizeObserver(onResize)
	resizeObserver.observe(body)
	body.querySelectorAll<HTMLElement>(MEDIA_CLAMP_SELECTOR).forEach(element => resizeObserver.observe(element))
	disconnect = () => resizeObserver.disconnect()

	return () => {
		cleanupObserver.disconnect()
		disconnect()
	}
}

export function updatePreviewClamp(body: HTMLElement, expandButton: HTMLButtonElement): void {
	if (!body.classList.contains(BODY_CLAMPED_CLASS)) return

	const height = getMediaAwareClampHeight(body)
	body.style.maxHeight = `${height}px`

	const truncable = isPreviewTruncable(body, height)
	body.classList.toggle(BODY_TRUNCABLE_CLASS, truncable)
	expandButton.hidden = !truncable
}

function getMediaAwareClampHeight(body: HTMLElement): number {
	let height = MAX_PREVIEW_HEIGHT

	body.querySelectorAll<HTMLElement>(MEDIA_CLAMP_SELECTOR).forEach(element => {
		const top = element.offsetTop
		const bottom = top + element.offsetHeight
		if (top > height || bottom <= height) return

		height = Math.min(Math.max(height, bottom + MEDIA_CLAMP_PADDING), MAX_MEDIA_AWARE_PREVIEW_HEIGHT)
	})

	return height
}

export function isPreviewTruncable(element: HTMLElement, maxHeight = MAX_PREVIEW_HEIGHT): boolean {
	const measuredContentHeight = getMeasuredPreviewContentHeight(element)
	if (measuredContentHeight !== null) {
		return measuredContentHeight > maxHeight + TRUNCATION_TOLERANCE
	}

	const visibleHeight = element.clientHeight || element.getBoundingClientRect().height
	if (visibleHeight > 0 && element.scrollHeight > 0) {
		return element.scrollHeight > visibleHeight + MIN_EXPANDABLE_OVERFLOW
	}

	return element.scrollHeight > maxHeight + MIN_EXPANDABLE_OVERFLOW
}

function getMeasuredPreviewContentHeight(body: HTMLElement): number | null {
	const bodyRect = body.getBoundingClientRect()
	if (bodyRect.height <= 0) return null

	const primaryBottom = getMaxElementBottom(getPrimaryContentAnchors(body), bodyRect)
	if (primaryBottom > 0) return primaryBottom

	const descendantBottom = getMeasuredDescendantContentBottom(body, bodyRect)
	return descendantBottom > 0 ? descendantBottom : null
}

function getPrimaryContentAnchors(body: HTMLElement): HTMLElement[] {
	const post = body.querySelector<HTMLElement>('.post, [id^="post-"]') ?? body
	const anchors = Array.from(
		post.querySelectorAll<HTMLElement>('.post-contents, .body, .cuerpo, .post-controls')
	)

	if (post.matches('.post-contents, .body, .cuerpo, .post-controls')) {
		anchors.unshift(post)
	}

	return [...new Set(anchors)]
}

function getMaxElementBottom(elements: HTMLElement[], bodyRect: DOMRect): number {
	let bottom = 0
	elements.forEach(element => {
		if (!isVisiblePreviewElement(element)) return
		const rect = element.getBoundingClientRect()
		if (rect.height <= 0) return
		bottom = Math.max(bottom, rect.bottom - bodyRect.top)
	})

	return bottom
}

function getMeasuredDescendantContentBottom(body: HTMLElement, bodyRect: DOMRect): number {
	let bottom = 0
	body.querySelectorAll<HTMLElement>('*').forEach(element => {
		if (!isVisiblePreviewElement(element) || !isContentHeightAnchor(element)) return
		const rect = element.getBoundingClientRect()
		if (rect.height <= 0) return
		bottom = Math.max(bottom, rect.bottom - bodyRect.top)
	})

	return bottom
}

function isVisiblePreviewElement(element: HTMLElement): boolean {
	const style = getComputedStyle(element)
	return style.display !== 'none' && style.visibility !== 'hidden' && style.position !== 'fixed'
}

function isContentHeightAnchor(element: HTMLElement): boolean {
	if (
		element.matches(
			'img, iframe, video, table, .embed, [data-s9e-mediaembed], .youtube_lite, [data-youtube], .deal-wrap, .minideal-row, .deal-row, .poll-wrap, .mvp-twitter-lite-card'
		)
	) {
		return true
	}

	if (
		element.matches(
			'.post, .post-body, .post-contents, .body, .cuerpo, .table-wrap, .name-pad, .post-avatar, .post-meta, .post-meta-reply'
		)
	) {
		return false
	}

	if (/^(P|H1|H2|H3|H4|H5|H6|LI|TD|TH|PRE|CODE|BLOCKQUOTE)$/i.test(element.tagName)) return true
	return element.children.length === 0 && !!element.textContent.trim()
}
