/**
 * Early Hidden Threads Filter
 *
 * Runs at document_start and uses a localStorage cache with numeric thread IDs
 * to hide rows as early as possible in forum lists and Spy-like pages.
 *
 * This minimizes (but may not always fully remove) the brief flicker before
 * the main content script applies the canonical hidden-thread filter.
 */
import { defineContentScript } from '#imports'
import { DOM_MARKERS, EARLY_STYLE_IDS, RUNTIME_CACHE_KEYS } from '@/constants'

const CACHE_KEY = RUNTIME_CACHE_KEYS.HIDDEN_THREADS
const EARLY_STYLE_ID = EARLY_STYLE_IDS.HIDDEN_THREADS
const FALLBACK_STYLE_ID = EARLY_STYLE_IDS.HIDDEN_THREADS_FALLBACK
const HIDDEN_CLASS = DOM_MARKERS.CLASSES.HIDDEN_THREAD
const THREAD_LINK_SELECTOR = 'td.col-th .thread a[href*="/foro/"]'
const THREAD_ROW_SELECTOR = 'tbody#temas tr, table#temas tbody tr'

function isListLikeForumPage(): boolean {
	const pathname = window.location.pathname

	// /foro
	if (pathname === '/foro' || pathname === '/foro/') return true

	// /foro/{slug} or /foro/{slug}/p2
	if (/^\/foro\/[^/]+(?:\/p\d+)?\/?$/.test(pathname)) return true

	// global views
	if (/^\/foro\/(spy|new|unread|top|featured)(?:\/.*)?$/.test(pathname)) return true

	// favorites
	if (/^\/foro\/favoritos(?:\/.*)?$/.test(pathname)) return true

	// profile pages can include thread lists (e.g., "Últimos posts")
	if (/^\/id\/[^/]+(?:\/.*)?$/.test(pathname)) return true

	return false
}

function readHiddenIdsFromCache(): Set<string> {
	try {
		const raw = localStorage.getItem(CACHE_KEY)
		if (!raw) return new Set()

		const parsed = JSON.parse(raw) as unknown
		if (!Array.isArray(parsed)) return new Set()

		const normalized = parsed.filter((item): item is string => {
			return typeof item === 'string' && /^\d+$/.test(item)
		})

		return new Set(normalized)
	} catch {
		return new Set()
	}
}

function supportsHasSelector(): boolean {
	try {
		return typeof CSS !== 'undefined' && CSS.supports('selector(:has(*))')
	} catch {
		return false
	}
}

function appendStyleElement(style: HTMLStyleElement): void {
	const append = () => {
		const target = document.head || document.documentElement
		if (target) {
			target.appendChild(style)
			return
		}

		// At document_start head/html may not exist yet.
		setTimeout(append, 0)
	}

	append()
}

function injectEarlySelectorStyle(hiddenIds: Set<string>, hasSelectorSupport: boolean): void {
	// Most MV list rows include <tr id="t{threadId}">. This avoids relying on :has().
	const rowIdSelectors = Array.from(hiddenIds).flatMap(id => [
		`tbody#temas tr#t${id}`,
		`table#temas tbody tr#t${id}`,
	])

	// Extra compatibility for lists without row IDs (e.g., profile widgets).
	const hasSelectors = hasSelectorSupport
		? Array.from(hiddenIds).flatMap(id =>
				['tbody#temas tr', 'table#temas tbody tr'].flatMap(rowSelector => [
					`${rowSelector}:has(a#a${id})`,
					`${rowSelector}:has(a[href$="-${id}"])`,
					`${rowSelector}:has(a[href*="-${id}/"])`,
					`${rowSelector}:has(a[href*="-${id}#"])`,
					`${rowSelector}:has(a[href*="-${id}?"])`,
				])
			)
		: []

	const selectors = [...rowIdSelectors, ...hasSelectors]
	if (selectors.length === 0) return

	const selectorChunks: string[] = []
	const chunkSize = 250
	for (let i = 0; i < selectors.length; i += chunkSize) {
		const chunk = selectors.slice(i, i + chunkSize).join(',\n')
		selectorChunks.push(`${chunk} {\n\t\tdisplay: none !important;\n\t}`)
	}

	const style = document.createElement('style')
	style.id = EARLY_STYLE_ID
	style.textContent = selectorChunks.join('\n')

	appendStyleElement(style)
}

function ensureFallbackClassStyle(): void {
	if (document.getElementById(FALLBACK_STYLE_ID)) return

	const style = document.createElement('style')
	style.id = FALLBACK_STYLE_ID
	style.textContent = `
		.${HIDDEN_CLASS} {
			display: none !important;
		}
	`

	appendStyleElement(style)
}

function extractThreadNumericIdFromRow(row: HTMLTableRowElement): string | null {
	const threadLink = row.querySelector<HTMLAnchorElement>(THREAD_LINK_SELECTOR)
	if (!threadLink) return null

	// Typical MV pattern: id="a731786"
	const idAttr = threadLink.getAttribute('id') || ''
	if (/^a\d+$/.test(idAttr)) {
		return idAttr.slice(1)
	}

	const href = threadLink.getAttribute('href') || threadLink.href
	const match = href.match(/\/foro\/[^/]+\/[^/?#]*-(\d+)(?:[/?#]|$)/)
	return match ? match[1] : null
}

function hideRowIfNeeded(row: HTMLTableRowElement, hiddenIds: Set<string>): void {
	const numericId = extractThreadNumericIdFromRow(row)
	if (!numericId || !hiddenIds.has(numericId)) return

	row.classList.add(HIDDEN_CLASS)
}

function scanAndHide(hiddenIds: Set<string>): void {
	document.querySelectorAll<HTMLTableRowElement>(THREAD_ROW_SELECTOR).forEach(row => {
		hideRowIfNeeded(row, hiddenIds)
	})
}

function setupEarlyObserver(hiddenIds: Set<string>): void {
	const observer = new MutationObserver(mutations => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (!(node instanceof HTMLElement)) continue

				if (node.matches('tr')) {
					hideRowIfNeeded(node as HTMLTableRowElement, hiddenIds)
					continue
				}

				node.querySelectorAll<HTMLTableRowElement>('tr').forEach(row => {
					hideRowIfNeeded(row, hiddenIds)
				})
			}
		}
	})

	observer.observe(document.documentElement, {
		childList: true,
		subtree: true,
	})
}

export default defineContentScript({
	matches: ['*://www.mediavida.com/*'],
	runAt: 'document_start',

	main() {
		if (!isListLikeForumPage()) return

		const hiddenIds = readHiddenIdsFromCache()
		if (hiddenIds.size === 0) return

		const hasSelectorSupport = supportsHasSelector()
		injectEarlySelectorStyle(hiddenIds, hasSelectorSupport)

		// Modern path: pure CSS hides rows as they are parsed (near-zero flicker).
		if (hasSelectorSupport) {
			return
		}

		// Fallback path for older selector engines.
		ensureFallbackClassStyle()
		scanAndHide(hiddenIds)
		setupEarlyObserver(hiddenIds)

		document.addEventListener('DOMContentLoaded', () => {
			scanAndHide(hiddenIds)
		})
	},
})
