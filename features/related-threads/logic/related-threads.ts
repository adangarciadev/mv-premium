import { DOM_MARKERS, EARLY_STYLE_IDS, MV_SELECTORS, RUNTIME_CACHE_KEYS } from '@/constants'
import { useSettingsStore } from '@/store/settings-store'
import type { RelatedThreadsDisplay } from '@/store/settings-types'

const MODE_ATTRIBUTE = DOM_MARKERS.DATA_ATTRS.RELATED_THREADS_MODE
const OWNED_CONTENT_ID_ATTRIBUTE = DOM_MARKERS.DATA_ATTRS.RELATED_THREADS_CONTENT_ID
const TOGGLE_CLASS = DOM_MARKERS.CLASSES.RELATED_THREADS_TOGGLE
const LABEL_CLASS = DOM_MARKERS.CLASSES.RELATED_THREADS_LABEL
const CHEVRON_CLASS = DOM_MARKERS.CLASSES.RELATED_THREADS_CHEVRON
const EARLY_STYLE_ID = EARLY_STYLE_IDS.RELATED_THREADS
const CACHE_KEY = RUNTIME_CACHE_KEYS.RELATED_THREADS_DISPLAY

function updateEarlyCache(mode: RelatedThreadsDisplay): void {
	try {
		localStorage.setItem(CACHE_KEY, mode)
	} catch {
		// localStorage might be disabled
	}
}

function getDocument(root: ParentNode): Document {
	return root instanceof Document ? root : root.ownerDocument ?? document
}

function removeStyles(ownerDocument: Document): void {
	ownerDocument.getElementById(DOM_MARKERS.IDS.RELATED_THREADS_STYLES)?.remove()
}

function restoreBlock(block: HTMLElement): void {
	block.hidden = false
	block.removeAttribute(MODE_ATTRIBUTE)

	const heading = block.querySelector<HTMLElement>(MV_SELECTORS.THREAD.RELATED_THREADS_HEADING)
	const content = block.querySelector<HTMLElement>(MV_SELECTORS.THREAD.RELATED_THREADS_CONTENT)
	const button = heading?.querySelector<HTMLButtonElement>(`:scope > .${TOGGLE_CLASS}`)
	const label = button?.querySelector<HTMLElement>(`.${LABEL_CLASS}`)

	if (heading && button) {
		if (label) {
			while (label.firstChild) {
				heading.insertBefore(label.firstChild, button)
			}
		}
		button.remove()
	}

	if (content) {
		content.hidden = false
		if (content.hasAttribute(OWNED_CONTENT_ID_ATTRIBUTE)) {
			content.removeAttribute('id')
			content.removeAttribute(OWNED_CONTENT_ID_ATTRIBUTE)
		}
	}
}

function injectStyles(ownerDocument: Document): void {
	if (ownerDocument.getElementById(DOM_MARKERS.IDS.RELATED_THREADS_STYLES)) return

	const style = ownerDocument.createElement('style')
	style.id = DOM_MARKERS.IDS.RELATED_THREADS_STYLES
	style.textContent = `
		.hilos-relacionados[${MODE_ATTRIBUTE}='hidden'] {
			display: none !important;
		}
		.hilos-relacionados[${MODE_ATTRIBUTE}='collapsible'] .rel-head {
			padding: 0;
		}
		.hilos-relacionados .${TOGGLE_CLASS} {
			align-items: center;
			appearance: none;
			background: transparent;
			border: 0;
			color: inherit;
			cursor: pointer;
			display: flex;
			font: inherit;
			gap: 0.75rem;
			justify-content: space-between;
			min-height: 48px;
			padding: 0.5rem 0.75rem;
			text-align: left;
			width: 100%;
		}
		.hilos-relacionados .${LABEL_CLASS} {
			min-width: 0;
			overflow-wrap: anywhere;
		}
		.hilos-relacionados .${CHEVRON_CLASS} {
			border-bottom: 2px solid currentColor;
			border-right: 2px solid currentColor;
			flex: 0 0 auto;
			height: 0.55rem;
			margin-right: 0.2rem;
			transform: rotate(45deg);
			transition: transform 150ms ease-out;
			width: 0.55rem;
		}
		.hilos-relacionados .${TOGGLE_CLASS}[aria-expanded='true'] .${CHEVRON_CLASS} {
			transform: rotate(225deg);
		}
		@media (prefers-reduced-motion: reduce) {
			.hilos-relacionados .${CHEVRON_CLASS} { transition: none; }
		}
	`
	ownerDocument.head?.append(style)
}

export function teardownRelatedThreadsDisplay(root: ParentNode = document): void {
	root.querySelectorAll<HTMLElement>(MV_SELECTORS.THREAD.RELATED_THREADS).forEach(restoreBlock)
	removeStyles(getDocument(root))
}

export function applyRelatedThreadsDisplay(mode: RelatedThreadsDisplay, root: ParentNode = document): void {
	const ownerDocument = getDocument(root)
	updateEarlyCache(mode)
	ownerDocument.getElementById(EARLY_STYLE_ID)?.remove()
	const blocks = root.querySelectorAll<HTMLElement>(MV_SELECTORS.THREAD.RELATED_THREADS)
	let hasStyledBlock = false

	if (mode === 'original') {
		blocks.forEach(restoreBlock)
		removeStyles(ownerDocument)
		return
	}

	blocks.forEach((block, index) => {
		if (block.getAttribute(MODE_ATTRIBUTE) === mode) {
			if (mode === 'hidden' && block.hidden) {
				hasStyledBlock = true
				return
			}

			const existingButton = block.querySelector<HTMLButtonElement>(`.${TOGGLE_CLASS}`)
			const existingContent = block.querySelector<HTMLElement>(MV_SELECTORS.THREAD.RELATED_THREADS_CONTENT)
			if (mode === 'collapsible' && existingButton && existingContent) {
				hasStyledBlock = true
				return
			}
		}

		restoreBlock(block)

		if (mode === 'hidden') {
			block.hidden = true
			block.setAttribute(MODE_ATTRIBUTE, mode)
			hasStyledBlock = true
			return
		}

		const heading = block.querySelector<HTMLElement>(MV_SELECTORS.THREAD.RELATED_THREADS_HEADING)
		const content = block.querySelector<HTMLElement>(MV_SELECTORS.THREAD.RELATED_THREADS_CONTENT)
		if (!heading || !content) return

		if (!content.id) {
			content.id =
				index === 0 ? DOM_MARKERS.IDS.RELATED_THREADS_CONTENT : `${DOM_MARKERS.IDS.RELATED_THREADS_CONTENT}-${index + 1}`
			content.setAttribute(OWNED_CONTENT_ID_ATTRIBUTE, 'true')
		}

		const button = ownerDocument.createElement('button')
		button.type = 'button'
		button.className = TOGGLE_CLASS
		button.setAttribute('aria-label', 'Mostrar u ocultar hilos relacionados')
		button.setAttribute('aria-controls', content.id)
		button.setAttribute('aria-expanded', 'false')

		const label = ownerDocument.createElement('span')
		label.className = LABEL_CLASS
		while (heading.firstChild) label.append(heading.firstChild)

		const chevron = ownerDocument.createElement('span')
		chevron.className = CHEVRON_CLASS
		chevron.setAttribute('aria-hidden', 'true')

		button.append(label, chevron)
		heading.append(button)
		content.hidden = true
		block.setAttribute(MODE_ATTRIBUTE, mode)
		hasStyledBlock = true

		button.addEventListener('click', () => {
			const expanded = button.getAttribute('aria-expanded') === 'true'
			button.setAttribute('aria-expanded', String(!expanded))
			content.hidden = expanded
		})
	})

	if (hasStyledBlock) {
		injectStyles(ownerDocument)
	} else {
		removeStyles(ownerDocument)
	}
}

export function initRelatedThreadsDisplay(root: ParentNode = document): void {
	applyRelatedThreadsDisplay(useSettingsStore.getState().relatedThreadsDisplay, root)
}
