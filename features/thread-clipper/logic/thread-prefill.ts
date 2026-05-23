import { storage } from '#imports'
import { MV_SELECTORS, STORAGE_KEYS } from '@/constants'
import { toast } from '@/lib/lazy-toast'
import { logger } from '@/lib/logger'
import { VALID_SUBFORUM_SLUGS } from '@/lib/subforums'

export interface ClippedThreadPrefill {
	subforum: string
	title: string
	body: string
	sourceUrl: string
	createdAt: number
}

const STORAGE_KEY = `local:${STORAGE_KEYS.PENDING_CLIPPED_THREAD_PREFILL}` as const
const MAX_PREFILL_AGE_MS = 10 * 60 * 1000
type PrefillReadResult =
	| { status: 'missing' | 'invalid' | 'expired' }
	| { status: 'ready'; prefill: ClippedThreadPrefill }

function dispatchTextInputEvents(element: HTMLInputElement | HTMLTextAreaElement): void {
	element.dispatchEvent(new Event('input', { bubbles: true }))
	element.dispatchEvent(new Event('change', { bubbles: true }))
}

function isValidPrefill(value: unknown): value is ClippedThreadPrefill {
	if (!value || typeof value !== 'object') return false
	const prefill = value as Partial<ClippedThreadPrefill>
	return (
		typeof prefill.subforum === 'string' &&
		VALID_SUBFORUM_SLUGS.has(prefill.subforum) &&
		typeof prefill.title === 'string' &&
		typeof prefill.body === 'string' &&
		typeof prefill.sourceUrl === 'string' &&
		typeof prefill.createdAt === 'number'
	)
}

function getCurrentNewThreadSubforum(): string | null {
	const match = window.location.pathname.match(/^\/foro\/([^/]+)\/nuevo-hilo\/?$/)
	if (!match) return null
	const subforum = decodeURIComponent(match[1])
	return VALID_SUBFORUM_SLUGS.has(subforum) ? subforum : null
}

async function readPrefill(): Promise<PrefillReadResult> {
	try {
		const prefill = await storage.getItem<ClippedThreadPrefill>(STORAGE_KEY)
		if (prefill == null) return { status: 'missing' }
		if (!isValidPrefill(prefill)) return { status: 'invalid' }

		if (Date.now() - prefill.createdAt > MAX_PREFILL_AGE_MS) {
			return { status: 'expired' }
		}

		return { status: 'ready', prefill }
	} catch (error) {
		logger.warn('Thread clipper: failed to read pending prefill', error)
		return { status: 'missing' }
	}
}

export async function saveClippedThreadPrefill(prefill: Omit<ClippedThreadPrefill, 'createdAt'>): Promise<void> {
	await storage.setItem(STORAGE_KEY, {
		...prefill,
		createdAt: Date.now(),
	})
}

export async function clearClippedThreadPrefill(): Promise<void> {
	await storage.removeItem(STORAGE_KEY)
}

export async function applyClippedThreadPrefill(): Promise<boolean> {
	const currentSubforum = getCurrentNewThreadSubforum()
	if (!currentSubforum) return false

	const result = await readPrefill()
	if (result.status !== 'ready') {
		if (result.status === 'invalid' || result.status === 'expired') {
			await clearClippedThreadPrefill()
		}
		return false
	}

	const { prefill } = result
	if (prefill.subforum !== currentSubforum) return false

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
	await clearClippedThreadPrefill()
	toast.success('Hilo preparado desde la página externa')
	return true
}
