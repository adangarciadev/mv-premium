import { MV_SELECTORS, STORAGE_KEYS } from '@/constants'
import { logger } from '@/lib/logger'

export interface ReleaseThreadPrefill {
	subforum: 'juegos' | 'cine'
	title: string
	body: string
	createdAt: number
}

const MAX_PREFILL_AGE_MS = 5 * 60 * 1000

function dispatchTextInputEvents(element: HTMLInputElement | HTMLTextAreaElement): void {
	element.dispatchEvent(new Event('input', { bubbles: true }))
	element.dispatchEvent(new Event('change', { bubbles: true }))
}

function readPrefill(): ReleaseThreadPrefill | null {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEYS.PENDING_RELEASE_THREAD_PREFILL)
		if (!raw) return null

		const prefill = JSON.parse(raw) as ReleaseThreadPrefill
		if (
			(prefill.subforum !== 'juegos' && prefill.subforum !== 'cine') ||
			typeof prefill.title !== 'string' ||
			typeof prefill.body !== 'string' ||
			typeof prefill.createdAt !== 'number'
		) {
			return null
		}

		if (Date.now() - prefill.createdAt > MAX_PREFILL_AGE_MS) {
			return null
		}

		return prefill
	} catch (error) {
		logger.warn('Release calendar: failed to read pending thread prefill', error)
		return null
	}
}

export function saveReleaseThreadPrefill(prefill: Omit<ReleaseThreadPrefill, 'createdAt'>): void {
	const payload: ReleaseThreadPrefill = {
		...prefill,
		createdAt: Date.now(),
	}
	sessionStorage.setItem(STORAGE_KEYS.PENDING_RELEASE_THREAD_PREFILL, JSON.stringify(payload))
}

export function clearReleaseThreadPrefill(): void {
	sessionStorage.removeItem(STORAGE_KEYS.PENDING_RELEASE_THREAD_PREFILL)
}

export function applyReleaseThreadPrefill(): boolean {
	if (!window.location.pathname.includes('/nuevo-hilo')) return false

	const prefill = readPrefill()
	clearReleaseThreadPrefill()
	if (!prefill) return false

	const currentSubforum = window.location.pathname.match(/^\/foro\/([^/]+)\/nuevo-hilo/)?.[1]
	if (currentSubforum && currentSubforum !== prefill.subforum) return false

	const titleInput = document.querySelector<HTMLInputElement>(MV_SELECTORS.EDITOR.TITLE_INPUT)
	const textarea = document.querySelector<HTMLTextAreaElement>(MV_SELECTORS.EDITOR.TEXTAREA_ALL)
	if (!titleInput || !textarea) return false

	if (!titleInput.value.trim()) {
		titleInput.value = prefill.title
		dispatchTextInputEvents(titleInput)
	}

	if (!textarea.value.trim()) {
		textarea.value = prefill.body
		dispatchTextInputEvents(textarea)
	}

	textarea.focus()
	return true
}
