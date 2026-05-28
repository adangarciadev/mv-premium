import { SHARE_CLASS, SHARE_OPEN_ATTR } from './constants'

const sharePanelControllers = new WeakMap<HTMLElement, AbortController>()

export function patchPreviewInternalLinks(body: HTMLElement, threadUrl: string, onContentChange: () => void): void {
	body.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(anchor => {
		const href = anchor.getAttribute('href')?.trim() || ''
		const isHashOnly = href === '#' || href.startsWith('#')
		const isSamePageHash = /^https?:\/\/(?:www\.)?mediavida\.com\/?#/i.test(href)
		if (!isHashOnly && !isSamePageHash) return

		anchor.removeAttribute('target')
		anchor.removeAttribute('rel')
		anchor.href = href.startsWith('http') ? href.replace(/^https?:\/\/(?:www\.)?mediavida\.com\/?/i, '') : href
		anchor.addEventListener('click', event => {
			event.preventDefault()
			event.stopPropagation()
			if (anchor.classList.contains('spoiler')) {
				togglePreviewSpoiler(anchor)
			} else if (isPostShareLink(anchor)) {
				togglePreviewShare(anchor, threadUrl)
			}
			window.setTimeout(onContentChange, 0)
			window.setTimeout(onContentChange, 180)
		})
	})
}

export function cleanupPreviewSharePanels(root: ParentNode = document): void {
	root.querySelectorAll<HTMLElement>(`.${SHARE_CLASS}`).forEach(panel => {
		sharePanelControllers.get(panel)?.abort()
		sharePanelControllers.delete(panel)
		panel.remove()
	})
	root.querySelectorAll<HTMLAnchorElement>(`[${SHARE_OPEN_ATTR}]`).forEach(anchor => {
		anchor.removeAttribute(SHARE_OPEN_ATTR)
	})
}

function isPostShareLink(anchor: HTMLAnchorElement): boolean {
	const href = anchor.getAttribute('href')?.trim() || ''
	return (
		anchor.classList.contains('qn') || (anchor.closest('.post-meta, .post-meta-reply') !== null && /^#\d+$/.test(href))
	)
}

function togglePreviewShare(anchor: HTMLAnchorElement, threadUrl: string): void {
	const existing = anchor.parentElement?.querySelector<HTMLElement>(`.${SHARE_CLASS}`)
	if (existing) {
		existing.remove()
		anchor.removeAttribute(SHARE_OPEN_ATTR)
		return
	}

	anchor
		.closest<HTMLElement>('.post, [id^="post-"]')
		?.querySelectorAll(`.${SHARE_CLASS}`)
		.forEach(el => el.remove())
	anchor
		.closest<HTMLElement>('.post, [id^="post-"]')
		?.querySelectorAll<HTMLAnchorElement>(`[${SHARE_OPEN_ATTR}]`)
		.forEach(openAnchor => openAnchor.removeAttribute(SHARE_OPEN_ATTR))

	const postNumber = getPostNumberFromAnchor(anchor)
	const shareUrl = `${threadUrl}#${postNumber}`
	const panel = createSharePanel(postNumber, shareUrl)
	anchor.setAttribute(SHARE_OPEN_ATTR, 'true')
	const host = anchor.closest<HTMLElement>('.post-meta, .post-header, .post-meta-reply') ?? anchor.parentElement
	if (host) {
		host.style.position ||= 'relative'
	}
	host?.appendChild(panel)

	const input = panel.querySelector<HTMLInputElement>('input')
	input?.focus()
	input?.select()
	bindPreviewShareOutsideClose(panel, anchor)
}

function bindPreviewShareOutsideClose(panel: HTMLElement, anchor: HTMLAnchorElement): void {
	const controller = new AbortController()
	sharePanelControllers.set(panel, controller)
	const cleanup = () => {
		anchor.removeAttribute(SHARE_OPEN_ATTR)
		sharePanelControllers.delete(panel)
		controller.abort()
	}
	const close = (event: MouseEvent | TouchEvent) => {
		const target = event.target
		if (!(target instanceof Node)) return
		if (panel.contains(target) || anchor.contains(target)) return
		panel.remove()
		cleanup()
	}
	const closeOnEscape = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') return
		panel.remove()
		cleanup()
	}

	window.setTimeout(() => {
		if (!panel.isConnected) {
			cleanup()
			return
		}
		document.addEventListener('click', close, { capture: true, signal: controller.signal })
		document.addEventListener('touchstart', close, { capture: true, signal: controller.signal })
		document.addEventListener('keydown', closeOnEscape, { signal: controller.signal })
	}, 0)
}

function getPostNumberFromAnchor(anchor: HTMLAnchorElement): string {
	const href = anchor.getAttribute('href')?.trim() || ''
	const fromHref = href.match(/#(\d+)$/)?.[1]
	if (fromHref) return fromHref

	const post = anchor.closest<HTMLElement>('[data-num], [id^="post-"]')
	const fromData = post?.getAttribute('data-num')
	if (fromData && /^\d+$/.test(fromData)) return fromData
	const fromId = post?.id.match(/^post-(\d+)$/)?.[1]
	return fromId || '1'
}

function createSharePanel(postNumber: string, shareUrl: string): HTMLElement {
	const encodedUrl = encodeURIComponent(shareUrl)
	const panel = document.createElement('div')
	panel.className = SHARE_CLASS
	panel.innerHTML = `
		<strong>Compartir post #${escapeHtml(postNumber)}</strong>
		<div class="mvp-thread-preview-share-url">
			<button class="mvp-thread-preview-share-copy" type="button" title="Copiar enlace" aria-label="Copiar enlace"><i class="fa fa-copy"></i></button>
			<input type="text" readonly value="${escapeHtml(shareUrl)}">
		</div>
		<div class="mvp-thread-preview-share-actions">
			<a class="mvp-share-facebook" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener noreferrer"><i class="fa fa-facebook"></i> Facebook</a>
			<a class="mvp-share-twitter" href="https://twitter.com/intent/tweet?url=${encodedUrl}" target="_blank" rel="noopener noreferrer"><i class="fa fa-twitter"></i> Twitter</a>
			<a class="mvp-share-whatsapp" href="https://api.whatsapp.com/send?text=${encodedUrl}" target="_blank" rel="noopener noreferrer"><i class="fa fa-whatsapp"></i> Whatsapp</a>
			<a class="mvp-share-email" href="mailto:?body=${encodedUrl}"><i class="fa fa-envelope-o"></i></a>
		</div>
	`

	const input = panel.querySelector<HTMLInputElement>('input')
	panel.querySelector<HTMLButtonElement>('.mvp-thread-preview-share-copy')?.addEventListener('click', event => {
		event.preventDefault()
		event.stopPropagation()
		input?.select()
		void navigator.clipboard?.writeText(shareUrl)
	})

	return panel
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')
}

function togglePreviewSpoiler(anchor: HTMLAnchorElement): void {
	if (!anchor.classList.contains('spoiler')) return

	const spoiler = findSpoilerContent(anchor)
	if (!spoiler) return

	const isHidden =
		spoiler.hidden === true ||
		spoiler.getAttribute('hidden') === 'until-found' ||
		spoiler.style.display === 'none' ||
		getComputedStyle(spoiler).display === 'none' ||
		spoiler.classList.contains('hidden')

	spoiler.hidden = false
	spoiler.style.display = isHidden ? 'block' : 'none'
	spoiler.classList.toggle('hidden', !isHidden)
	anchor.classList.toggle('open', isHidden)
	anchor.classList.toggle('active', isHidden)
}

function findSpoilerContent(anchor: HTMLAnchorElement): HTMLElement | null {
	const controls = anchor.getAttribute('aria-controls')
	if (controls) {
		const controlled = anchor.ownerDocument.getElementById(controls)
		if (controlled instanceof HTMLElement) return controlled
	}

	const following = findFollowingSpoilerBlock(anchor)
	if (following) return following

	const wrapper = anchor.closest<HTMLElement>('.spoiler-wrap, .spoil, .sp')
	return (
		wrapper?.querySelector<HTMLElement>('div.spoiler, div.sp, .spoiler-content, .spoil-content, .sp-content') ??
		findNearbySpoilerBlock(anchor)
	)
}

function findFollowingSpoilerBlock(anchor: HTMLAnchorElement): HTMLElement | null {
	let current: Element | null = anchor
	const post = anchor.closest('.post, [id^="post-"]')

	while (current && current !== post) {
		let sibling = current.nextElementSibling
		while (sibling) {
			if (sibling instanceof HTMLElement && isSpoilerContentElement(sibling)) return sibling
			const nested = sibling.querySelector<HTMLElement>(
				'div.spoiler, div.sp, .spoiler-content, .spoil-content, .sp-content'
			)
			if (nested) return nested
			sibling = sibling.nextElementSibling
		}
		current = current.parentElement
	}

	return null
}

function isSpoilerContentElement(element: HTMLElement): boolean {
	return (
		element.classList.contains('spoiler') ||
		element.classList.contains('sp') ||
		element.classList.contains('spoiler-content') ||
		element.classList.contains('spoil-content') ||
		element.classList.contains('sp-content')
	)
}

function findNearbySpoilerBlock(anchor: HTMLAnchorElement): HTMLElement | null {
	const parent = anchor.parentElement
	if (!parent) return null

	const candidates = Array.from(parent.querySelectorAll<HTMLElement>('div.spoiler, div.sp, .spoiler-content'))
	const anchorIndex = Array.from(parent.querySelectorAll('*')).indexOf(anchor)
	return candidates.find(candidate => Array.from(parent.querySelectorAll('*')).indexOf(candidate) > anchorIndex) ?? null
}
