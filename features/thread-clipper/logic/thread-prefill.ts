import { storage } from '#imports'
import { MV_SELECTORS, STORAGE_KEYS } from '@/constants'
import { toast } from '@/lib/lazy-toast'
import { logger } from '@/lib/logger'
import { readThreadClipperBaskets } from './basket-storage'
import { CLIPPER_EDITOR_HASH, type ClippedThreadPrefill } from './types'
import { sendMessage } from '@/lib/messaging'
import { VALID_SUBFORUM_SLUGS } from '@/lib/subforums'

export type { ClippedThreadPrefill } from './types'

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

// Content injections can run more than once while the editor mounts.
let applying: Promise<boolean> | undefined
let insertedTransfer: string | undefined
let finishedTransfer: string | undefined

export function applyClippedThreadPrefill(): Promise<boolean> {
	applying ??= applyPendingClip().catch(error => {
		logger.warn('Thread clipper: could not deliver clip', error)
		toast.error('No se pudo completar el recorte. Puedes volver a intentarlo.')
		return false
	}).finally(() => { applying = undefined })
	return applying
}

async function applyPendingClip(): Promise<boolean> {
	const currentSubforum = getCurrentNewThreadSubforum()
	if (!currentSubforum) return false
	const titleInput = document.querySelector<HTMLInputElement>(MV_SELECTORS.EDITOR.TITLE_INPUT)
	const textarea = document.querySelector<HTMLTextAreaElement>(MV_SELECTORS.EDITOR.TEXTAREA_ALL)
	if (!titleInput || !textarea) return false

	const tagged = location.hash.startsWith(CLIPPER_EDITOR_HASH)
	const id = location.hash.slice(CLIPPER_EDITOR_HASH.length)
	if (tagged && id === finishedTransfer) return false
	let prefill: Omit<ClippedThreadPrefill, 'createdAt'>
	if (tagged) {
		const basket = (await readThreadClipperBaskets()).find(entry => entry.sessionId === id)
		if (!basket?.pending) return false
		prefill = basket.pending
	} else {
		// Finish transfers created before the extension was updated.
		const legacy = await readPrefill()
		if (legacy.status !== 'ready') {
			if (legacy.status === 'invalid' || legacy.status === 'expired') await clearClippedThreadPrefill()
			return false
		}
		prefill = legacy.prefill
	}
	if (prefill.subforum !== currentSubforum || !textarea.isConnected) return false
	const finish = async () => {
		if (tagged) {
			await sendMessage('finishClipperTransfer', { id })
			finishedTransfer = id
		} else {
			await clearClippedThreadPrefill()
		}
	}

	const insertContent = () => {
		if (!titleInput.value.trim()) {
			titleInput.value = prefill.title
			dispatchTextInputEvents(titleInput)
		}
		textarea.value = textarea.value.trim() ? textarea.value + '\n\n' + prefill.body : prefill.body
		dispatchTextInputEvents(textarea)
		textarea.focus()
	}

	if (tagged && id === insertedTransfer) {
		await finish()
		return true
	}
	if (!titleInput.value.trim() && !textarea.value.trim()) {
		insertContent()
		if (tagged) insertedTransfer = id
		await finish()
		toast.success('Hilo preparado desde la página externa')
		return true
	}

	if (document.getElementById('mvp-thread-clipper-conflict')) return false
	const panel = document.createElement('fieldset')
	panel.id = 'mvp-thread-clipper-conflict'
	const legend = document.createElement('legend')
	legend.textContent = 'Ya hay contenido en este editor'
	const description = document.createElement('p')
	description.textContent = `Recorte pendiente: ${prefill.title || prefill.sourceUrl}`
	const append = document.createElement('button')
	append.type = 'button'
	append.className = 'btn'
	append.textContent = 'Añadir al final'
	const save = document.createElement('button')
	save.type = 'button'
	save.className = 'btn'
	save.textContent = 'Guardar para después'
	panel.append(legend, description, append, ' ', save)
	textarea.before(panel)

	let completed = false
	async function resolveConflict(asDraft: boolean): Promise<void> {
		append.disabled = save.disabled = true
		try {
			if (!completed) {
				if (asDraft) {
					const { createDraft } = await import('@/features/drafts/storage')
					await createDraft({ type: 'draft', title: prefill.title, content: prefill.body, subforum: prefill.subforum })
				} else {
					insertContent()
				}
				completed = true
			}
			await finish()
			panel.remove()
			toast.success(asDraft ? 'Recorte guardado en Borradores' : 'Recorte añadido al editor')
		} catch (error) {
			logger.warn('Thread clipper: could not finish pending clip', error)
			toast.error('No se pudo completar la acción. Vuelve a intentarlo.')
			append.disabled = completed && asDraft
			save.disabled = completed && !asDraft
		}
	}
	append.addEventListener('click', () => void resolveConflict(false))
	save.addEventListener('click', () => void resolveConflict(true))
	return false
}
