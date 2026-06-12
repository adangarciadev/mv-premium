import { storage } from '@wxt-dev/storage'
import { browser } from 'wxt/browser'
import { MV_BASE_URL, MV_SELECTORS, STORAGE_KEYS } from '@/constants'
import { toast } from '@/lib/lazy-toast'
import { logger } from '@/lib/logger'
import { getCategoriesForSubforum } from '@/lib/subforum-categories'
import { getNewThreadUrl, VALID_SUBFORUM_SLUGS } from '@/lib/subforums'
import type { Draft } from '@/features/drafts/storage'

export type DashboardThreadPublishMode = 'publish' | 'dry-run'

export interface DashboardThreadPublishPayload {
	draftId: string
	sourceType: Draft['type']
	mode: DashboardThreadPublishMode
	title: string
	body: string
	subforum: string
	category?: string
	createdAt: number
}

export type DashboardThreadPublishApplyStatus =
	| 'missing'
	| 'invalid'
	| 'expired'
	| 'wrong-page'
	| 'wrong-subforum'
	| 'editor-missing'
	| 'category-missing'
	| 'submit-missing'
	| 'dry-run-filled'
	| 'submitted'

const STORAGE_KEY = `local:${STORAGE_KEYS.PENDING_DASHBOARD_THREAD_PUBLISH}` as const
const MAX_PENDING_AGE_MS = 10 * 60 * 1000
const MAX_THREAD_TITLE_LENGTH = 72

type PendingReadResult =
	| { status: 'missing' | 'invalid' | 'expired' }
	| { status: 'ready'; payload: DashboardThreadPublishPayload }

function dispatchValueEvents(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): void {
	element.dispatchEvent(new Event('input', { bubbles: true }))
	element.dispatchEvent(new Event('change', { bubbles: true }))
}

function isValidPayload(value: unknown): value is DashboardThreadPublishPayload {
	if (!value || typeof value !== 'object') return false
	const payload = value as Partial<DashboardThreadPublishPayload>
	return (
		typeof payload.draftId === 'string' &&
		(payload.sourceType === 'draft' || payload.sourceType === 'template') &&
		(payload.mode === 'publish' || payload.mode === 'dry-run') &&
		typeof payload.title === 'string' &&
		typeof payload.body === 'string' &&
		typeof payload.subforum === 'string' &&
		VALID_SUBFORUM_SLUGS.has(payload.subforum) &&
		(payload.category === undefined || typeof payload.category === 'string') &&
		typeof payload.createdAt === 'number'
	)
}

function getCurrentNewThreadSubforum(): string | null {
	const match = window.location.pathname.match(/^\/foro\/([^/]+)\/nuevo-hilo\/?$/)
	if (!match) return null
	const subforum = decodeURIComponent(match[1])
	return VALID_SUBFORUM_SLUGS.has(subforum) ? subforum : null
}

function findThreadForm(
	titleInput: HTMLInputElement,
	textarea: HTMLTextAreaElement
): HTMLFormElement | null {
	return (
		textarea.form ||
		titleInput.form ||
		document.querySelector<HTMLFormElement>(MV_SELECTORS.EDITOR.POSTFORM) ||
		textarea.closest<HTMLFormElement>('form') ||
		titleInput.closest<HTMLFormElement>('form')
	)
}

function fillTextInput(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
	element.value = value
	dispatchValueEvents(element)
}

function applyCategory(category: string | undefined): 'applied' | 'missing' | 'not-needed' {
	if (!category) return 'not-needed'

	const categorySelect = document.querySelector<HTMLSelectElement>(MV_SELECTORS.EDITOR.CATEGORY_SELECT)
	if (!categorySelect) return 'missing'

	const optionExists = Array.from(categorySelect.options).some(option => option.value === category)
	if (!optionExists) return 'missing'

	categorySelect.value = category
	dispatchValueEvents(categorySelect)
	return 'applied'
}

function submitThreadForm(form: HTMLFormElement, submitButton: HTMLButtonElement): void {
	if (typeof form.requestSubmit === 'function') {
		form.requestSubmit(submitButton)
		return
	}

	submitButton.click()
}

async function readPendingPublish(): Promise<PendingReadResult> {
	try {
		const payload = await storage.getItem<DashboardThreadPublishPayload>(STORAGE_KEY)
		if (payload == null) return { status: 'missing' }
		if (!isValidPayload(payload)) return { status: 'invalid' }
		if (Date.now() - payload.createdAt > MAX_PENDING_AGE_MS) return { status: 'expired' }
		return { status: 'ready', payload }
	} catch (error) {
		logger.warn('Dashboard thread publish: failed to read pending payload', error)
		return { status: 'missing' }
	}
}

export async function clearDashboardThreadPublish(): Promise<void> {
	await storage.removeItem(STORAGE_KEY)
}

export function getDashboardThreadPublishValidationError(draft: Draft): string | null {
	const title = draft.title.trim()
	const body = draft.content.trim()
	const subforum = draft.subforum?.trim()
	const category = draft.category?.trim()

	if (!title) return 'El título es obligatorio'
	if (title.length > MAX_THREAD_TITLE_LENGTH) return `El título no puede superar ${MAX_THREAD_TITLE_LENGTH} caracteres`
	if (!body) return 'El contenido es obligatorio'
	if (!subforum || !VALID_SUBFORUM_SLUGS.has(subforum)) return 'Selecciona un subforo válido'

	const categories = getCategoriesForSubforum(subforum)
	if (categories.length > 0) {
		if (!category || category === 'none') return 'Selecciona una categoría'
		if (!categories.some(item => item.value === category)) {
			return 'La categoría no pertenece al subforo seleccionado'
		}
	}

	return null
}

export async function saveDashboardThreadPublish(
	draft: Draft,
	mode: DashboardThreadPublishMode
): Promise<DashboardThreadPublishPayload> {
	const error = getDashboardThreadPublishValidationError(draft)
	if (error) throw new Error(error)

	const payload: DashboardThreadPublishPayload = {
		draftId: draft.id,
		sourceType: draft.type,
		mode,
		title: draft.title.trim(),
		body: draft.content.trim(),
		subforum: draft.subforum!.trim(),
		category: draft.category?.trim() && draft.category !== 'none' ? draft.category.trim() : undefined,
		createdAt: Date.now(),
	}

	await storage.setItem(STORAGE_KEY, payload)
	return payload
}

export async function openDashboardThreadPublish(
	draft: Draft,
	mode: DashboardThreadPublishMode
): Promise<void> {
	const payload = await saveDashboardThreadPublish(draft, mode)
	await browser.tabs.create({ url: `${MV_BASE_URL}${getNewThreadUrl(payload.subforum)}` })
}

export async function applyDashboardThreadPublish(): Promise<DashboardThreadPublishApplyStatus> {
	const currentSubforum = getCurrentNewThreadSubforum()
	if (!currentSubforum) return 'wrong-page'

	const result = await readPendingPublish()
	if (result.status !== 'ready') {
		if (result.status === 'invalid' || result.status === 'expired') {
			await clearDashboardThreadPublish()
		}
		return result.status
	}

	const { payload } = result
	if (payload.subforum !== currentSubforum) return 'wrong-subforum'

	const titleInput = document.querySelector<HTMLInputElement>(MV_SELECTORS.EDITOR.TITLE_INPUT)
	const textarea = document.querySelector<HTMLTextAreaElement>(MV_SELECTORS.EDITOR.TEXTAREA_ALL)
	if (!titleInput || !textarea) return 'editor-missing'

	fillTextInput(titleInput, payload.title)
	fillTextInput(textarea, payload.body)

	const categoryStatus = applyCategory(payload.category)
	if (categoryStatus === 'missing') {
		await clearDashboardThreadPublish()
		toast.error('No se pudo seleccionar la categoría del borrador')
		return 'category-missing'
	}

	if (payload.mode === 'dry-run') {
		await clearDashboardThreadPublish()
		toast.success('Modo prueba: hilo preparado sin publicar')
		textarea.focus()
		return 'dry-run-filled'
	}

	const form = findThreadForm(titleInput, textarea)
	const submitButton =
		form?.querySelector<HTMLButtonElement>(MV_SELECTORS.EDITOR.SUBMIT) ||
		document.querySelector<HTMLButtonElement>(MV_SELECTORS.EDITOR.SUBMIT)

	if (!form || !submitButton) {
		await clearDashboardThreadPublish()
		toast.error('No se encontró el botón Crear tema')
		textarea.focus()
		return 'submit-missing'
	}

	await clearDashboardThreadPublish()
	submitThreadForm(form, submitButton)
	return 'submitted'
}
