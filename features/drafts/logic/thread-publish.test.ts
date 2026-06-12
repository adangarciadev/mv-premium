import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@/constants'
import type { Draft } from '@/features/drafts/storage'

const mocks = vi.hoisted(() => ({
	storageMap: new Map<string, unknown>(),
	tabsCreate: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
	loggerWarn: vi.fn(),
}))

vi.mock('@wxt-dev/storage', () => ({
	storage: {
		getItem: vi.fn(async (key: string) => mocks.storageMap.get(key) ?? null),
		setItem: vi.fn(async (key: string, value: unknown) => {
			mocks.storageMap.set(key, value)
		}),
		removeItem: vi.fn(async (key: string) => {
			mocks.storageMap.delete(key)
		}),
	},
}))

vi.mock('wxt/browser', () => ({
	browser: {
		tabs: {
			create: mocks.tabsCreate,
		},
	},
}))

vi.mock('@/lib/lazy-toast', () => ({
	toast: {
		success: mocks.toastSuccess,
		error: mocks.toastError,
	},
}))

vi.mock('@/lib/logger', () => ({
	logger: {
		warn: mocks.loggerWarn,
	},
}))

import {
	applyDashboardThreadPublish,
	getDashboardThreadPublishValidationError,
	openDashboardThreadPublish,
	type DashboardThreadPublishPayload,
} from './thread-publish'

const STORAGE_KEY = `local:${STORAGE_KEYS.PENDING_DASHBOARD_THREAD_PUBLISH}`

function setPath(pathname: string) {
	window.history.replaceState({}, '', pathname)
}

function makeDraft(overrides: Partial<Draft> = {}): Draft {
	return {
		id: 'draft-1',
		title: 'Titulo del hilo',
		content: 'Contenido del hilo',
		type: 'draft',
		subforum: 'juegos',
		category: '156',
		createdAt: 1000,
		updatedAt: 1000,
		...overrides,
	}
}

function makePayload(overrides: Partial<DashboardThreadPublishPayload> = {}): DashboardThreadPublishPayload {
	return {
		draftId: 'draft-1',
		sourceType: 'draft',
		mode: 'dry-run',
		title: 'Titulo del hilo',
		body: 'Contenido del hilo',
		subforum: 'juegos',
		category: '156',
		createdAt: Date.now(),
		...overrides,
	}
}

function renderNewThreadForm() {
	document.body.innerHTML = `
		<form id="postform">
			<input id="cabecera" />
			<select id="tag">
				<option value="0">Sin categoria</option>
				<option value="156">Debate</option>
			</select>
			<textarea id="cuerpo" name="cuerpo"></textarea>
			<button type="submit" name="Submit">Crear tema</button>
		</form>
	`
}

describe('dashboard thread publish', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
		mocks.storageMap.clear()
		mocks.tabsCreate.mockReset().mockResolvedValue({ id: 1 })
		mocks.toastSuccess.mockReset()
		mocks.toastError.mockReset()
		mocks.loggerWarn.mockReset()
		setPath('/foro/juegos/nuevo-hilo')
	})

	it('validates required publish metadata before opening Mediavida', async () => {
		expect(getDashboardThreadPublishValidationError(makeDraft({ title: '' }))).toBe('El título es obligatorio')
		expect(getDashboardThreadPublishValidationError(makeDraft({ content: '' }))).toBe('El contenido es obligatorio')
		expect(getDashboardThreadPublishValidationError(makeDraft({ subforum: undefined }))).toBe(
			'Selecciona un subforo válido'
		)
		expect(getDashboardThreadPublishValidationError(makeDraft({ category: undefined }))).toBe(
			'Selecciona una categoría'
		)
	})

	it('stores a dry-run publish request and opens the matching new-thread page', async () => {
		await openDashboardThreadPublish(makeDraft(), 'dry-run')

		expect(mocks.tabsCreate).toHaveBeenCalledWith({
			url: 'https://www.mediavida.com/foro/juegos/nuevo-hilo',
		})

		const payload = mocks.storageMap.get(STORAGE_KEY) as DashboardThreadPublishPayload
		expect(payload).toMatchObject({
			draftId: 'draft-1',
			mode: 'dry-run',
			title: 'Titulo del hilo',
			body: 'Contenido del hilo',
			subforum: 'juegos',
			category: '156',
		})
	})

	it('fills the native form without submitting in dry-run mode', async () => {
		renderNewThreadForm()
		const form = document.querySelector<HTMLFormElement>('form')!
		const requestSubmit = vi.fn()
		form.requestSubmit = requestSubmit
		mocks.storageMap.set(STORAGE_KEY, makePayload({ mode: 'dry-run' }))

		expect(await applyDashboardThreadPublish()).toBe('dry-run-filled')
		expect(document.querySelector<HTMLInputElement>('#cabecera')!.value).toBe('Titulo del hilo')
		expect(document.querySelector<HTMLSelectElement>('#tag')!.value).toBe('156')
		expect(document.querySelector<HTMLTextAreaElement>('#cuerpo')!.value).toBe('Contenido del hilo')
		expect(requestSubmit).not.toHaveBeenCalled()
		expect(mocks.storageMap.has(STORAGE_KEY)).toBe(false)
		expect(mocks.toastSuccess).toHaveBeenCalledWith('Modo prueba: hilo preparado sin publicar')
	})

	it('submits the native Crear tema button in publish mode', async () => {
		renderNewThreadForm()
		const form = document.querySelector<HTMLFormElement>('form')!
		const submitButton = document.querySelector<HTMLButtonElement>('button[name="Submit"]')!
		const requestSubmit = vi.fn()
		form.requestSubmit = requestSubmit
		mocks.storageMap.set(STORAGE_KEY, makePayload({ mode: 'publish' }))

		expect(await applyDashboardThreadPublish()).toBe('submitted')
		expect(document.querySelector<HTMLInputElement>('#cabecera')!.value).toBe('Titulo del hilo')
		expect(document.querySelector<HTMLSelectElement>('#tag')!.value).toBe('156')
		expect(document.querySelector<HTMLTextAreaElement>('#cuerpo')!.value).toBe('Contenido del hilo')
		expect(requestSubmit).toHaveBeenCalledWith(submitButton)
		expect(mocks.storageMap.has(STORAGE_KEY)).toBe(false)
	})

	it('keeps pending data when Mediavida opens a different subforum', async () => {
		setPath('/foro/cine/nuevo-hilo')
		renderNewThreadForm()
		mocks.storageMap.set(STORAGE_KEY, makePayload({ subforum: 'juegos' }))

		expect(await applyDashboardThreadPublish()).toBe('wrong-subforum')
		expect(document.querySelector<HTMLInputElement>('#cabecera')!.value).toBe('')
		expect(mocks.storageMap.has(STORAGE_KEY)).toBe(true)
	})

	it('keeps pending data when the editor is not ready yet', async () => {
		mocks.storageMap.set(STORAGE_KEY, makePayload())

		expect(await applyDashboardThreadPublish()).toBe('editor-missing')
		expect(mocks.storageMap.has(STORAGE_KEY)).toBe(true)
	})
})
