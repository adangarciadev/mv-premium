import { logger } from '@/lib/logger'
import { sendMessage } from '@/lib/messaging'
import { ACTION_GROUP_CLASS, BUTTON_ATTR, BUTTON_CLASS, ROW_ATTR, STYLE_ID, THREAD_ROWS_SELECTOR } from './constants'
import { extractFirstPostPreview } from './extractor'
import {
	cleanupRenderedPreviews,
	createPreviewRow,
	getPreviewRowForButton,
	removePreviewRow,
	renderError,
	renderLoading,
	renderPreview,
} from './render'
import { ensureStyles } from './styles'
import type { ThreadPreviewData } from './types'
import { getThreadPreviewUrlFromRow, getThreadTitleLinkFromRow } from './url'

const previewCache = new Map<string, Promise<ThreadPreviewData> | ThreadPreviewData>()
let observer: MutationObserver | null = null
let observerTimer: ReturnType<typeof setTimeout> | null = null

function setButtonExpanded(button: HTMLElement, expanded: boolean): void {
	button.setAttribute('aria-expanded', expanded ? 'true' : 'false')
	button.title = expanded ? 'Cerrar preview del primer post' : 'Previsualizar primer post'
}

function createPreviewButton(): HTMLButtonElement {
	const button = document.createElement('button')
	button.className = BUTTON_CLASS
	button.type = 'button'
	button.setAttribute(BUTTON_ATTR, '')
	button.setAttribute('aria-label', 'Previsualizar primer post')
	button.setAttribute('aria-expanded', 'false')
	button.title = 'Previsualizar primer post'

	const icon = document.createElement('i')
	icon.className = 'fa fa-chevron-down'
	button.appendChild(icon)

	button.addEventListener('click', event => {
		event.preventDefault()
		event.stopPropagation()
		void togglePreview(button)
	})

	return button
}

function appendButtonToThread(threadDiv: HTMLElement, button: HTMLButtonElement): void {
	const titleLink = getThreadTitleLinkFromRow(threadDiv)
	if (!titleLink) {
		threadDiv.appendChild(button)
		return
	}

	const actionGroup = document.createElement('span')
	actionGroup.className = ACTION_GROUP_CLASS
	let nextNode = titleLink.nextSibling

	while (nextNode) {
		const node = nextNode
		nextNode = nextNode.nextSibling
		actionGroup.appendChild(node)
	}

	actionGroup.appendChild(button)
	threadDiv.appendChild(actionGroup)
}

async function loadPreview(url: string): Promise<ThreadPreviewData> {
	const cached = previewCache.get(url)
	if (cached) return cached

	const promise = (async () => {
		const result = await sendMessage('fetchThreadPageHtml', { url })
		if (!result?.success || !result.html) {
			throw new Error(result?.error || 'Respuesta vacía')
		}

		const doc = new DOMParser().parseFromString(result.html, 'text/html')
		const preview = extractFirstPostPreview(doc, url)
		if (!preview) {
			throw new Error('No se encontró el primer post')
		}
		previewCache.set(url, preview)
		return preview
	})()

	previewCache.set(url, promise)
	try {
		return await promise
	} catch (error) {
		previewCache.delete(url)
		throw error
	}
}

async function togglePreview(button: HTMLButtonElement): Promise<void> {
	const sourceRow = button.closest<HTMLTableRowElement>('tr')
	if (!sourceRow) return

	const existingRow = getPreviewRowForButton(button)
	if (existingRow) {
		removePreviewRow(existingRow)
		setButtonExpanded(button, false)
		button.blur()
		return
	}

	const url = getThreadPreviewUrlFromRow(sourceRow)
	if (!url) return

	const previewRow = createPreviewRow(sourceRow)
	renderLoading(previewRow)
	setButtonExpanded(button, true)

	try {
		const preview = await loadPreview(url)
		if (!previewRow.isConnected) return
		renderPreview(previewRow, preview, sourceRow)
	} catch (error) {
		logger.warn('Thread preview failed:', error)
		if (!previewRow.isConnected) return
		renderError(previewRow, error instanceof Error ? error.message : 'Error desconocido')
	}
}

function injectButtonsIntoRows(): void {
	ensureStyles()
	document.querySelectorAll<HTMLTableRowElement>(THREAD_ROWS_SELECTOR).forEach(row => {
		if (row.hasAttribute(ROW_ATTR)) return
		if (row.querySelector(`[${BUTTON_ATTR}]`)) return

		const titleLink = getThreadTitleLinkFromRow(row)
		if (!titleLink) return
		if (!getThreadPreviewUrlFromRow(row)) return

		const threadDiv = row.querySelector<HTMLElement>('.thread')
		if (!threadDiv) return

		const cell = row.querySelector<HTMLElement>('td.col-th') ?? threadDiv.closest<HTMLElement>('td')
		if (!cell) return

		cell.classList.add('mvp-preview-btn-cell')
		const button = createPreviewButton()
		button.title = 'Mostrar OP completo'
		button.setAttribute('aria-label', 'Mostrar OP completo')

		appendButtonToThread(threadDiv, button)
	})
}

function setupObserver(): void {
	if (observer) return

	const tbody = document.querySelector<HTMLElement>('tbody#temas')
	if (!tbody) return

	observer = new MutationObserver(mutations => {
		if (!mutations.some(mutation => mutation.addedNodes.length > 0)) return
		if (observerTimer) clearTimeout(observerTimer)
		observerTimer = setTimeout(() => {
			injectButtonsIntoRows()
			observerTimer = null
		}, 50)
	})

	observer.observe(tbody, {
		childList: true,
		subtree: true,
	})
}

export function injectThreadPreviewButtons(): void {
	injectButtonsIntoRows()
	setupObserver()
}

export function cleanupThreadPreview(): void {
	observer?.disconnect()
	observer = null
	if (observerTimer) {
		clearTimeout(observerTimer)
		observerTimer = null
	}
	document.querySelectorAll(`[${BUTTON_ATTR}]`).forEach(button => button.remove())
	cleanupRenderedPreviews()
	document.getElementById(STYLE_ID)?.remove()
	previewCache.clear()
}
