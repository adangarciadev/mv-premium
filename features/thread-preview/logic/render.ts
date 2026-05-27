import { setupGlobalEmbedListener } from '@/lib/content-modules/utils/reinitialize-embeds'
import {
	BODY_CLASS,
	BODY_CLAMPED_CLASS,
	CONTENT_CLASS,
	EXPAND_CLASS,
	LOADING_CLASS,
	ROW_ATTR,
	ROW_CLASS,
} from './constants'
import {
	applyPreviewFogTheme,
	observePreviewMediaResizes,
	updatePreviewClamp,
} from './clamp'
import {
	collapseEmptyPreviewEmbeds,
	preparePreviewStreamableEmbeds,
	preparePreviewTwitterEmbeds,
	reinitializePreviewEmbeds,
	wirePreviewYoutubeEmbeds,
} from './embeds'
import { repairPreviewPostShell } from './post-shell'
import { cleanupPreviewSharePanels, patchPreviewInternalLinks } from './share'
import type { ThreadPreviewData } from './types'

const rowCleanups = new WeakMap<HTMLTableRowElement, () => void>()

export function getPreviewRowForButton(button: HTMLElement): HTMLTableRowElement | null {
	const row = button.closest('tr')
	const next = row?.nextElementSibling
	if (next instanceof HTMLTableRowElement && next.hasAttribute(ROW_ATTR)) return next
	return null
}

export function createPreviewRow(sourceRow: HTMLTableRowElement): HTMLTableRowElement {
	const row = document.createElement('tr')
	row.className = ROW_CLASS
	row.setAttribute(ROW_ATTR, '')

	const cell = document.createElement('td')
	cell.colSpan = getColumnSpan(sourceRow)
	row.appendChild(cell)

	sourceRow.after(row)
	return row
}

function getColumnSpan(row: HTMLTableRowElement): number {
	return Math.max(1, row.children.length || 5)
}

export function renderLoading(row: HTMLTableRowElement): void {
	const cell = row.firstElementChild as HTMLTableCellElement | null
	if (!cell) return
	cell.textContent = ''
	const loading = document.createElement('div')
	loading.className = `${CONTENT_CLASS} ${LOADING_CLASS}`
	loading.textContent = 'Cargando primer post...'
	cell.appendChild(loading)
}

export function renderError(row: HTMLTableRowElement, message: string): void {
	const cell = row.firstElementChild as HTMLTableCellElement | null
	if (!cell) return
	cell.textContent = ''
	const error = document.createElement('div')
	error.className = `${CONTENT_CLASS} ${LOADING_CLASS}`
	error.textContent = `No se pudo cargar la preview: ${message}`
	cell.appendChild(error)
}

export function renderPreview(
	row: HTMLTableRowElement,
	preview: ThreadPreviewData,
	sourceRow?: HTMLTableRowElement
): void {
	rowCleanups.get(row)?.()
	rowCleanups.delete(row)

	const cell = row.firstElementChild as HTMLTableCellElement | null
	if (!cell) return

	cell.innerHTML = ''

	const container = document.createElement('div')
	container.className = CONTENT_CLASS

	const body = document.createElement('div')
	body.className = `${BODY_CLASS} ${BODY_CLAMPED_CLASS}`
	body.innerHTML = preview.postHtml
	repairPreviewPostShell(body, sourceRow)

	const expandButton = document.createElement('button')
	expandButton.type = 'button'
	expandButton.className = EXPAND_CLASS
	const expandIcon = document.createElement('i')
	expandIcon.className = 'fa fa-chevron-down'
	const expandText = document.createElement('span')
	expandText.textContent = 'Ver más'
	expandButton.append(expandIcon, expandText)
	expandButton.hidden = true
	expandButton.addEventListener('click', () => {
		const isExpanded = !body.classList.contains(BODY_CLAMPED_CLASS)
		body.classList.toggle(BODY_CLAMPED_CLASS, isExpanded)
		if (isExpanded) {
			updatePreviewClamp(body, expandButton)
		} else {
			body.style.maxHeight = ''
		}
		expandIcon.className = isExpanded ? 'fa fa-chevron-down' : 'fa fa-chevron-up'
		expandText.textContent = isExpanded ? 'Ver más' : 'Ver menos'
	})

	container.append(body, expandButton)
	cell.appendChild(container)
	applyPreviewFogTheme(body)
	setupGlobalEmbedListener()
	preparePreviewTwitterEmbeds(body)
	preparePreviewStreamableEmbeds(body)
	collapseEmptyPreviewEmbeds(body)
	reinitializePreviewEmbeds(body)

	const scheduleFrame =
		globalThis.requestAnimationFrame ?? ((callback: FrameRequestCallback) => window.setTimeout(callback, 0))
	const updateClamp = () => updatePreviewClamp(body, expandButton)
	const cleanupYoutubeEmbeds = wirePreviewYoutubeEmbeds(body, updateClamp)
	patchPreviewInternalLinks(body, preview.url, updateClamp)
	const cleanupMediaResizes = observePreviewMediaResizes(body, updateClamp)
	const mediaEvents = new AbortController()
	body
		.querySelectorAll<HTMLImageElement | HTMLIFrameElement | HTMLVideoElement>('img, iframe, video')
		.forEach(element => {
			element.addEventListener('load', updateClamp, { once: true, signal: mediaEvents.signal })
			element.addEventListener('loadedmetadata', updateClamp, { once: true, signal: mediaEvents.signal })
		})

	const timeoutIds = [
		window.setTimeout(updateClamp, 180),
		window.setTimeout(updateClamp, 650),
		window.setTimeout(updateClamp, 1400),
		window.setTimeout(updateClamp, 2600),
	]
	scheduleFrame(updateClamp)

	rowCleanups.set(row, () => {
		cleanupPreviewSharePanels(row)
		cleanupYoutubeEmbeds()
		cleanupMediaResizes()
		mediaEvents.abort()
		timeoutIds.forEach(timeoutId => window.clearTimeout(timeoutId))
	})
}

export function removePreviewRow(row: HTMLTableRowElement): void {
	rowCleanups.get(row)?.()
	rowCleanups.delete(row)
	row.remove()
}

export function cleanupRenderedPreviews(): void {
	document.querySelectorAll(`[${ROW_ATTR}]`).forEach(row => {
		if (row instanceof HTMLTableRowElement) {
			removePreviewRow(row)
		} else {
			row.remove()
		}
	})
}
