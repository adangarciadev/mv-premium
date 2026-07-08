import { ShadowWrapper } from '@/components/shadow-wrapper'
import { FEATURE_IDS } from '@/constants'
import { mountFeatureWithBoundary, unmountFeature } from '@/lib/content-modules/utils/react-helpers'
import { normalizeFragranticaPerfumeUrl } from '@/services/api/fragrantica'
import { FragranticaCard } from '../components/fragrantica-card'

const SOURCE_LINK_CLASS = 'mvp-fragrantica-source-link'
const PROCESSED_ATTR = 'data-mvp-fragrantica-processed'
const TAG_NAME_PATTERN = 'fragrance|fragance|frangance'
const OPEN_TAG_PATTERN = new RegExp(`\\[(${TAG_NAME_PATTERN})\\]$`, 'i')
const CLOSE_TAG_PATTERN = new RegExp(`^\\[\\/(${TAG_NAME_PATTERN})\\]`, 'i')
const FULL_TAG_PATTERN = new RegExp(`\\[(${TAG_NAME_PATTERN})\\]([\\s\\S]*?)\\[\\/(${TAG_NAME_PATTERN})\\]`, 'gi')
const SCAN_DEBOUNCE_MS = 100

let observer: MutationObserver | null = null
let scanTimer: ReturnType<typeof setTimeout> | null = null
let isInitialized = false
let cardCounter = 0
const mountedFeatureIds = new Set<string>()

function nextFeatureId(): string {
	cardCounter += 1
	return `${FEATURE_IDS.FRAGRANTICA_INLINE_CARD_PREFIX}${cardCounter}`
}

export function initFragranticaEmbeds(): void {
	if (isInitialized) {
		scheduleScan()
		return
	}

	isInitialized = true
	scanPage()

	observer = new MutationObserver(mutations => {
		if (mutations.some(mutation => mutation.addedNodes.length > 0)) scheduleScan()
	})
	observer.observe(document.body, { childList: true, subtree: true })
	window.addEventListener('beforeunload', cleanupFragranticaEmbeds)
}

export function cleanupFragranticaEmbeds(): void {
	if (scanTimer) {
		clearTimeout(scanTimer)
		scanTimer = null
	}
	observer?.disconnect()
	observer = null
	window.removeEventListener('beforeunload', cleanupFragranticaEmbeds)

	mountedFeatureIds.forEach(featureId => unmountFeature(featureId))
	mountedFeatureIds.clear()

	isInitialized = false
}

function scheduleScan(): void {
	if (scanTimer) clearTimeout(scanTimer)
	scanTimer = setTimeout(() => {
		scanTimer = null
		scanPage()
	}, SCAN_DEBOUNCE_MS)
}

function scanPage(): void {
	scanTaggedFragranceLinks()
	scanTaggedFragranceText()
	scanForFragranticaLinks()
}

function scanTaggedFragranceLinks(): void {
	for (const link of document.querySelectorAll<HTMLAnchorElement>(`a[href]:not([${PROCESSED_ATTR}])`)) {
		const url = normalizeFragranticaPerfumeUrl(link.href)
		if (!url || !stripSplitTagsAround(link)) continue

		link.href = url
		link.textContent = 'Fragrantica'
		link.classList.add(SOURCE_LINK_CLASS)
		link.style.fontWeight = '700'
		link.setAttribute(PROCESSED_ATTR, 'true')
		mountCard(link, url)
	}
}

function scanTaggedFragranceText(): void {
	const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
		acceptNode(node) {
			const text = node.nodeValue || ''
			FULL_TAG_PATTERN.lastIndex = 0
			if (!FULL_TAG_PATTERN.test(text)) return NodeFilter.FILTER_REJECT
			FULL_TAG_PATTERN.lastIndex = 0
			return shouldIgnoreNode(node.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
		},
	})

	const nodes: Text[] = []
	let node: Node | null
	while ((node = walker.nextNode())) nodes.push(node as Text)
	nodes.forEach(replaceTaggedTextNode)
}

function scanForFragranticaLinks(): void {
	for (const link of document.querySelectorAll<HTMLAnchorElement>(`a[href]:not([${PROCESSED_ATTR}])`)) {
		const url = normalizeFragranticaPerfumeUrl(link.href)
		if (!url) continue

		link.href = url
		link.setAttribute(PROCESSED_ATTR, 'true')
		mountCard(link, url)
	}
}

function replaceTaggedTextNode(textNode: Text): void {
	const text = textNode.nodeValue || ''
	const fragment = document.createDocumentFragment()
	const linksToMount: Array<{ link: HTMLAnchorElement; url: string }> = []
	let cursor = 0
	let match: RegExpExecArray | null

	FULL_TAG_PATTERN.lastIndex = 0
	while ((match = FULL_TAG_PATTERN.exec(text))) {
		const url = normalizeFragranticaPerfumeUrl(match[2].trim())
		if (!url) continue

		if (match.index > cursor) fragment.append(document.createTextNode(text.slice(cursor, match.index)))
		const link = createSourceLink(url)
		fragment.append(link)
		linksToMount.push({ link, url })
		cursor = match.index + match[0].length
	}

	if (!linksToMount.length || !textNode.parentNode) return
	if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)))
	textNode.parentNode.replaceChild(fragment, textNode)
	linksToMount.forEach(({ link, url }) => mountCard(link, url))
}

function stripSplitTagsAround(link: HTMLAnchorElement): boolean {
	const previous = link.previousSibling
	const next = link.nextSibling
	if (!previous || previous.nodeType !== Node.TEXT_NODE || !next || next.nodeType !== Node.TEXT_NODE) return false
	if (!OPEN_TAG_PATTERN.test(previous.nodeValue || '') || !CLOSE_TAG_PATTERN.test(next.nodeValue || '')) return false

	previous.nodeValue = (previous.nodeValue || '').replace(OPEN_TAG_PATTERN, '')
	next.nodeValue = (next.nodeValue || '').replace(CLOSE_TAG_PATTERN, '')
	return true
}

function createSourceLink(url: string): HTMLAnchorElement {
	const link = document.createElement('a')
	link.href = url
	link.target = '_blank'
	link.rel = 'noopener noreferrer'
	link.className = SOURCE_LINK_CLASS
	link.style.fontWeight = '700'
	link.setAttribute(PROCESSED_ATTR, 'true')
	link.textContent = 'Fragrantica'
	return link
}

function shouldIgnoreNode(element: Element | null): boolean {
	return Boolean(element?.closest(`script, style, textarea, input, select, option, [contenteditable='true']`))
}

function mountCard(link: HTMLAnchorElement, url: string): void {
	const container = document.createElement('div')
	const featureId = nextFeatureId()
	container.setAttribute('data-feature-id', featureId)

	const forumLine = findForumLine(link)
	forumLine.insertAdjacentElement('afterend', container)

	mountedFeatureIds.add(featureId)
	mountFeatureWithBoundary(
		featureId,
		container,
		<ShadowWrapper>
			<FragranticaCard url={url} />
		</ShadowWrapper>,
		'Ficha de Fragrantica'
	)
}

function findForumLine(link: HTMLAnchorElement): Element {
	return link.closest('p, li, blockquote, div') || link
}
