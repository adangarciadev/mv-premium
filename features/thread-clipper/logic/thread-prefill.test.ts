import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CLIPPER_EDITOR_HASH } from './types'
import { sendMessage } from '@/lib/messaging'
import { createDraft } from '@/features/drafts/storage'
import { STORAGE_KEYS } from '@/constants'

const storageMap = new Map<string, unknown>()

vi.mock('#imports', () => ({
	storage: {
		getItem: vi.fn(async (key: string) => storageMap.get(key) ?? null),
		setItem: vi.fn(async (key: string, value: unknown) => {
			storageMap.set(key, value)
		}),
		removeItem: vi.fn(async (key: string) => {
			storageMap.delete(key)
		}),
	},
}))

vi.mock('@/lib/messaging', () => ({ sendMessage: vi.fn(async () => true) }))
vi.mock('@/features/drafts/storage', () => ({ createDraft: vi.fn() }))

vi.mock('@/lib/logger', () => ({
	logger: {
		warn: vi.fn(),
	},
}))

vi.mock('@/lib/lazy-toast', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}))

import {
	applyClippedThreadPrefill,
	clearClippedThreadPrefill,
	saveClippedThreadPrefill,
} from './thread-prefill'

const STORAGE_KEY = `local:${STORAGE_KEYS.PENDING_CLIPPED_THREAD_PREFILL}`

function setPath(pathname: string) {
	window.history.replaceState({}, '', pathname)
}

describe('clipped thread prefill', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
		storageMap.clear()
		setPath('/foro/juegos/nuevo-hilo')
	})

	it('applies title and body on new thread pages', async () => {
		document.body.innerHTML = `
			<input id="cabecera" />
			<textarea id="cuerpo" name="cuerpo"></textarea>
		`

		await saveClippedThreadPrefill({
			subforum: 'juegos',
			title: 'Noticia test',
			body: '[url=https://example.com]Noticia test[/url]',
			sourceUrl: 'https://example.com',
		})

		expect(await applyClippedThreadPrefill()).toBe(true)
		expect(document.querySelector<HTMLInputElement>('#cabecera')!.value).toBe('Noticia test')
		expect(document.querySelector<HTMLTextAreaElement>('#cuerpo')!.value).toBe(
			'[url=https://example.com]Noticia test[/url]'
		)
		expect(storageMap.has(STORAGE_KEY)).toBe(false)
	})

	it('does not inject extra review controls on Mediavida', async () => {
		document.body.innerHTML = `
			<div id="post-editor">
				<input id="cabecera" />
				<textarea id="cuerpo" name="cuerpo"></textarea>
			</div>
		`

		await saveClippedThreadPrefill({
			subforum: 'juegos',
			title: 'Noticia test',
			body:
				'[url=https://example.com]Titular completo[/url]\n\n' +
				'[media]https://www.youtube.com/watch?v=abc123[/media]\n\n' +
				'[quote]\nTexto citado\n[/quote]',
			sourceUrl: 'https://example.com',
		})

		expect(await applyClippedThreadPrefill()).toBe(true)

		const textarea = document.querySelector<HTMLTextAreaElement>('#cuerpo')!
		expect(document.getElementById('mvp-thread-clipper-review')).toBeNull()
		expect(textarea.value).toContain('[url=https://example.com]Titular completo[/url]')
		expect(textarea.value).toContain('[media]https://www.youtube.com/watch?v=abc123[/media]')
		expect(textarea.value).toContain('Texto citado')
	})

	it('keeps pending data when the editor is not ready yet', async () => {
		await saveClippedThreadPrefill({
			subforum: 'juegos',
			title: 'Noticia test',
			body: '[url=https://example.com]Noticia test[/url]',
			sourceUrl: 'https://example.com',
		})

		expect(await applyClippedThreadPrefill()).toBe(false)
		expect(storageMap.has(STORAGE_KEY)).toBe(true)
	})

	it('keeps pending data on a different new-thread subforum', async () => {
		setPath('/foro/cine/nuevo-hilo')
		document.body.innerHTML = `
			<input id="cabecera" />
			<textarea id="cuerpo" name="cuerpo"></textarea>
		`

		await saveClippedThreadPrefill({
			subforum: 'juegos',
			title: 'Noticia test',
			body: '[url=https://example.com]Noticia test[/url]',
			sourceUrl: 'https://example.com',
		})

		expect(await applyClippedThreadPrefill()).toBe(false)
		expect(document.querySelector<HTMLInputElement>('#cabecera')!.value).toBe('')
		expect(storageMap.has(STORAGE_KEY)).toBe(true)
	})

	it('does not overwrite existing user input', async () => {
		document.body.innerHTML = `
			<input id="cabecera" value="Mi titulo" />
			<textarea id="cuerpo" name="cuerpo">Mi texto</textarea>
		`

		await saveClippedThreadPrefill({
			subforum: 'juegos',
			title: 'Noticia test',
			body: '[url=https://example.com]Noticia test[/url]',
			sourceUrl: 'https://example.com',
		})

		expect(await applyClippedThreadPrefill()).toBe(false)
		expect(document.querySelector<HTMLInputElement>('#cabecera')!.value).toBe('Mi titulo')
		expect(document.querySelector<HTMLTextAreaElement>('#cuerpo')!.value).toBe('Mi texto')
		expect(storageMap.has(STORAGE_KEY)).toBe(true)
		document.querySelector<HTMLButtonElement>('#mvp-thread-clipper-conflict button')!.click()
		await vi.waitFor(() => expect(storageMap.has(STORAGE_KEY)).toBe(false))
		expect(document.querySelector<HTMLTextAreaElement>('#cuerpo')!.value).toBe(
			'Mi texto\n\n[url=https://example.com]Noticia test[/url]'
		)
		expect(document.querySelector<HTMLInputElement>('#cabecera')!.value).toBe('Mi titulo')
	})

	it('delivers only the addressed clip and saves it for later without changing the editor', async () => {
		const articles = ['uno', 'dos'].map(id => ({
			version: 1, sessionId: id, tabId: 10, sourceUrl: 'https://example.com/' + id,
			sourceTitle: id, items: [], createdAt: 0, updatedAt: 0,
			pending: { title: id, body: 'Contenido ' + id, subforum: 'juegos', sourceUrl: 'https://example.com/' + id },
		}))
		storageMap.set(`local:${STORAGE_KEYS.THREAD_CLIPPER_BASKET}`, articles)
		document.body.innerHTML = '<input id="cabecera"><textarea id="cuerpo">En curso</textarea>'
		expect(await applyClippedThreadPrefill()).toBe(false)
		expect(document.querySelector('fieldset')).toBeNull()
		setPath('/foro/juegos/nuevo-hilo' + CLIPPER_EDITOR_HASH + 'dos')
		await Promise.all([applyClippedThreadPrefill(), applyClippedThreadPrefill()])
		expect(document.querySelectorAll('fieldset')).toHaveLength(1)
		const keep = document.querySelector<HTMLButtonElement>('fieldset button:last-child')!
		vi.mocked(createDraft).mockRejectedValueOnce(new Error('storage unavailable'))
		keep.click()
		await vi.waitFor(() => expect(keep.disabled).toBe(false))
		expect(sendMessage).not.toHaveBeenCalled()
		keep.click()
		await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith('finishClipperTransfer', { id: 'dos' }))
		expect(createDraft).toHaveBeenCalledWith({ type: 'draft', title: 'dos', content: 'Contenido dos', subforum: 'juegos' })
		expect(document.querySelector<HTMLTextAreaElement>('#cuerpo')!.value).toBe('En curso')
		expect(document.querySelector<HTMLInputElement>('#cabecera')!.value).toBe('')
		setPath('/foro/juegos/nuevo-hilo' + CLIPPER_EDITOR_HASH + 'uno')
		document.querySelector<HTMLTextAreaElement>('#cuerpo')!.value = ''
		expect(await applyClippedThreadPrefill()).toBe(true)
		expect(document.querySelector<HTMLTextAreaElement>('#cuerpo')!.value).toBe('Contenido uno')
		expect(sendMessage).toHaveBeenLastCalledWith('finishClipperTransfer', { id: 'uno' })
	})

	it('ignores expired prefill data', async () => {
		document.body.innerHTML = `
			<input id="cabecera" />
			<textarea id="cuerpo" name="cuerpo"></textarea>
		`
		storageMap.set(STORAGE_KEY, {
			subforum: 'juegos',
			title: 'Old',
			body: 'Old body',
			sourceUrl: 'https://example.com',
			createdAt: Date.now() - 20 * 60 * 1000,
		})

		expect(await applyClippedThreadPrefill()).toBe(false)
		expect(document.querySelector<HTMLInputElement>('#cabecera')!.value).toBe('')
		expect(storageMap.has(STORAGE_KEY)).toBe(false)
	})

	it('clears invalid prefill data on new thread pages', async () => {
		document.body.innerHTML = `
			<input id="cabecera" />
			<textarea id="cuerpo" name="cuerpo"></textarea>
		`
		storageMap.set(STORAGE_KEY, {
			subforum: 'nope',
			title: 'Invalid',
			body: 'Invalid body',
			sourceUrl: 'https://example.com',
			createdAt: Date.now(),
		})

		expect(await applyClippedThreadPrefill()).toBe(false)
		expect(storageMap.has(STORAGE_KEY)).toBe(false)
	})

	it('keeps pending data outside new thread pages', async () => {
		setPath('/foro/juegos')
		await saveClippedThreadPrefill({
			subforum: 'juegos',
			title: 'Noticia test',
			body: '[url=https://example.com]Noticia test[/url]',
			sourceUrl: 'https://example.com',
		})

		expect(await applyClippedThreadPrefill()).toBe(false)
		expect(storageMap.has(STORAGE_KEY)).toBe(true)
		await clearClippedThreadPrefill()
	})
})
